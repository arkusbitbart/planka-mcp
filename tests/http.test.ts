/**
 * Tests for the HTTP transport: mandatory bearer auth, uniform 401s,
 * per-IP rate limiting, unauthenticated health check, and the refusal
 * to start without MCP_AUTH_TOKEN.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Server as HttpServer } from "node:http";
import {
  startHttpServer,
  requireAuthToken,
  isAuthorized,
  resetRateLimiter,
  registerAuthFailure,
  isRateLimited,
} from "../src/http.js";

const TOKEN = "test-secret-token";
let server: HttpServer;
let baseUrl: string;

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.0" },
  },
};

function mcpRequest(headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...headers,
    },
    body: JSON.stringify(INITIALIZE),
  });
}

beforeAll(async () => {
  process.env.MCP_AUTH_TOKEN = TOKEN;
  server = startHttpServer(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("no port");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  resetRateLimiter();
});

describe("startup guard", () => {
  it("refuses to start without MCP_AUTH_TOKEN", () => {
    const saved = process.env.MCP_AUTH_TOKEN;
    delete process.env.MCP_AUTH_TOKEN;
    try {
      expect(() => requireAuthToken()).toThrow(/MCP_AUTH_TOKEN/);
      expect(() => startHttpServer(0)).toThrow(/MCP_AUTH_TOKEN/);
    } finally {
      process.env.MCP_AUTH_TOKEN = saved;
    }
  });

  it("refuses a blank token", () => {
    const saved = process.env.MCP_AUTH_TOKEN;
    process.env.MCP_AUTH_TOKEN = "   ";
    try {
      expect(() => requireAuthToken()).toThrow(/MCP_AUTH_TOKEN/);
    } finally {
      process.env.MCP_AUTH_TOKEN = saved;
    }
  });
});

describe("health check", () => {
  it("answers without authentication", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("authentication", () => {
  it("401 without a token, without hints", async () => {
    const res = await mcpRequest();
    expect(res.status).toBe(401);
    const body = await res.text();
    expect(body).toBe('{"error":"Unauthorized"}');
  });

  it("401 with a wrong token, same body as missing token", async () => {
    const res = await mcpRequest({ Authorization: "Bearer wrong-token" });
    expect(res.status).toBe(401);
    expect(await res.text()).toBe('{"error":"Unauthorized"}');
  });

  it("401 with a malformed Authorization header", async () => {
    const res = await mcpRequest({ Authorization: `Basic ${TOKEN}` });
    expect(res.status).toBe(401);
  });

  it("200 with the correct token (initialize round-trips)", async () => {
    const res = await mcpRequest({ Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("planka-mcp");
  });

  it("isAuthorized rejects prefixes and different lengths", () => {
    expect(isAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
    expect(isAuthorized(`Bearer ${TOKEN}x`, TOKEN)).toBe(false);
    expect(isAuthorized(`Bearer ${TOKEN.slice(0, -1)}`, TOKEN)).toBe(false);
    expect(isAuthorized(undefined, TOKEN)).toBe(false);
    expect(isAuthorized(TOKEN, TOKEN)).toBe(false); // missing Bearer prefix
  });
});

describe("rate limiting", () => {
  it("blocks an IP after repeated auth failures, even with a correct token", async () => {
    for (let i = 0; i < 10; i++) {
      const res = await mcpRequest({ Authorization: "Bearer wrong" });
      expect(res.status).toBe(401);
    }
    const blocked = await mcpRequest({ Authorization: "Bearer wrong" });
    expect(blocked.status).toBe(429);
    const blockedEvenCorrect = await mcpRequest({
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(blockedEvenCorrect.status).toBe(429);
  });

  it("the window expires", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) registerAuthFailure("1.2.3.4", now);
    expect(isRateLimited("1.2.3.4", now)).toBe(true);
    expect(isRateLimited("1.2.3.4", now + 61_000)).toBe(false);
  });

  it("health stays reachable for a rate-limited IP", async () => {
    for (let i = 0; i < 12; i++) {
      await mcpRequest({ Authorization: "Bearer wrong" });
    }
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
