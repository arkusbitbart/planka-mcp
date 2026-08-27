#!/usr/bin/env node
/**
 * PLANKA MCP Server — HTTP entry point (Streamable HTTP transport).
 *
 * Runs the same tool registry as the stdio entry point (see server.ts)
 * behind an HTTP endpoint, so the server can be used as a remote custom
 * connector.
 *
 * Security: this process is meant to face the open internet with write
 * access to a kanban board. It therefore REFUSES to start without
 * MCP_AUTH_TOKEN, requires the token on the MCP endpoint — either as
 * `Authorization: Bearer <token>` or as the raw `X-API-Key` value —
 * compared in constant time, and rate-limits failed attempts per IP.
 * Only GET /health is unauthenticated.
 */
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createPlankaServer } from "./server.js";

/**
 * Returns the required bearer token, or throws with a clear message.
 * There is deliberately no way to start the HTTP server without it.
 */
export function requireAuthToken(): string {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token || token.trim() === "") {
    throw new Error(
      "Refusing to start: MCP_AUTH_TOKEN is not set. The HTTP transport " +
        "exposes write access to your PLANKA boards and must never run " +
        "unauthenticated. Set MCP_AUTH_TOKEN to a long random secret; " +
        "clients must send it as 'Authorization: Bearer <token>'."
    );
  }
  return token;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest();

/**
 * Constant-time token comparison. Both sides are hashed first so
 * timingSafeEqual always compares equal-length buffers and the token
 * length is not leaked either.
 */
function matchesToken(provided: string, token: string): boolean {
  return timingSafeEqual(sha256(provided), sha256(token));
}

/**
 * Bearer check for the Authorization header.
 */
export function isAuthorized(
  authorizationHeader: string | undefined,
  token: string
): boolean {
  if (
    typeof authorizationHeader !== "string" ||
    !authorizationHeader.startsWith("Bearer ")
  ) {
    return false;
  }
  return matchesToken(authorizationHeader.slice("Bearer ".length), token);
}

/**
 * Request-level auth: accepts the token either as
 * "Authorization: Bearer <token>" or as the raw value of "X-API-Key"
 * (connector UIs often cannot set the Authorization header). Both paths
 * check the same MCP_AUTH_TOKEN with the same constant-time comparison;
 * one matching header is sufficient.
 */
export function isRequestAuthorized(
  headers: {
    authorization?: string;
    "x-api-key"?: string | string[];
  },
  token: string
): boolean {
  if (isAuthorized(headers.authorization, token)) {
    return true;
  }
  const apiKey = headers["x-api-key"];
  if (typeof apiKey === "string" && matchesToken(apiKey, token)) {
    return true;
  }
  return false;
}

// --- Rate limiting of failed auth attempts, per IP ---------------------

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_FAILURES = 10;
const authFailures = new Map<string, { count: number; resetAt: number }>();

export function registerAuthFailure(ip: string, nowMs = Date.now()): void {
  // Lazy pruning keeps the map bounded under scanning traffic
  if (authFailures.size > 10_000) {
    for (const [key, entry] of authFailures) {
      if (entry.resetAt <= nowMs) authFailures.delete(key);
    }
  }
  const entry = authFailures.get(ip);
  if (!entry || entry.resetAt <= nowMs) {
    authFailures.set(ip, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS });
    return;
  }
  entry.count++;
}

export function isRateLimited(ip: string, nowMs = Date.now()): boolean {
  const entry = authFailures.get(ip);
  if (!entry || entry.resetAt <= nowMs) return false;
  return entry.count >= RATE_LIMIT_MAX_FAILURES;
}

/** Test helper: clears the rate limiter state. */
export function resetRateLimiter(): void {
  authFailures.clear();
}

// ----------------------------------------------------------------------

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (raw.trim() === "") return undefined;
  return JSON.parse(raw);
}

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  token: string
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");

  // Health check: unauthenticated, no board access involved
  if (req.method === "GET" && url.pathname === "/health") {
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify({ status: "ok" }));
    return;
  }

  const ip = req.socket.remoteAddress ?? "unknown";
  if (isRateLimited(ip)) {
    res
      .writeHead(429, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Too many requests" }));
    return;
  }

  // Deliberately uniform 401 — no hint whether the token was missing,
  // malformed, wrong, or sent via the wrong header
  if (!isRequestAuthorized(req.headers, token)) {
    registerAuthFailure(ip);
    res
      .writeHead(401, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (url.pathname !== "/mcp" && url.pathname !== "/") {
    res
      .writeHead(404, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    res
      .writeHead(400, { "Content-Type": "application/json" })
      .end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  // Stateless mode: one server + transport per request, torn down with it
  const server = createPlankaServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

/**
 * Starts the HTTP server. Throws before binding when MCP_AUTH_TOKEN is
 * missing — there is no unauthenticated mode.
 */
export function startHttpServer(
  port: number = Number(process.env.PORT) || 3000
): HttpServer {
  const token = requireAuthToken();

  const httpServer = createServer((req, res) => {
    handleHttpRequest(req, res, token).catch((error) => {
      console.error("HTTP request error:", error);
      if (!res.headersSent) {
        res
          .writeHead(500, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Internal server error" }));
      } else {
        res.end();
      }
    });
  });

  httpServer.listen(port, () => {
    const address = httpServer.address();
    const boundPort =
      address !== null && typeof address === "object" ? address.port : port;
    console.error(
      `PLANKA MCP HTTP server listening on port ${boundPort} (MCP endpoint: POST /mcp, health: GET /health)`
    );
  });
  return httpServer;
}

// Start only when executed directly (node dist/http.js), not when imported
const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  try {
    startHttpServer();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
