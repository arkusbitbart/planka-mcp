/**
 * Security tests: PLANKA_API_KEY must never appear in error messages,
 * error details, or anything a tool response or log could carry.
 *
 * The key is sent as the X-Api-Key header; these tests provoke every
 * error path of the client (network failure, 401, 404, 500 with a body)
 * and assert the key is absent from the thrown error, including its
 * enumerable fields (which console.error and JSON.stringify would print).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { plankaClient } from "../src/client.js";
import { PlankaError } from "../src/errors.js";

const SECRET = "super-secret-api-key-XyZ123";

function assertNoSecret(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  const err = error as PlankaError;
  // message (reaches tool responses and logs)
  expect(err.message).not.toContain(SECRET);
  // stack (reaches logs)
  expect(err.stack ?? "").not.toContain(SECRET);
  // enumerable fields incl. details/code/status (JSON.stringify, console.error)
  expect(JSON.stringify({ ...err, message: err.message })).not.toContain(
    SECRET
  );
  const details = (err as PlankaError).details;
  if (details !== undefined) {
    expect(JSON.stringify(details) ?? "").not.toContain(SECRET);
  }
}

beforeAll(() => {
  process.env.PLANKA_BASE_URL = "http://planka.test";
  process.env.PLANKA_API_KEY = SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PLANKA_API_KEY never leaks into errors", () => {
  it("sends the key as X-Api-Key header (sanity check)", async () => {
    let seenHeaders: Record<string, string> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        seenHeaders = (init?.headers ?? {}) as Record<string, string>;
        return new Response(JSON.stringify({ item: null }), { status: 200 });
      })
    );
    await plankaClient.get("/api/projects");
    expect(seenHeaders["X-Api-Key"]).toBe(SECRET);
  });

  it("network error does not contain the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      })
    );
    try {
      await plankaClient.get("/api/projects");
      expect.unreachable("should have thrown");
    } catch (error) {
      assertNoSecret(error);
    }
  });

  it("401 (rejected key) does not contain the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Unauthorized" }), {
            status: 401,
          })
      )
    );
    try {
      await plankaClient.get("/api/projects");
      expect.unreachable("should have thrown");
    } catch (error) {
      assertNoSecret(error);
      // the message may name the env var, but never its value
      expect((error as Error).message).toContain("PLANKA_API_KEY");
    }
  });

  it("404 does not contain the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: "Not found" }), {
            status: 404,
          })
      )
    );
    try {
      await plankaClient.get("/api/cards/1");
      expect.unreachable("should have thrown");
    } catch (error) {
      assertNoSecret(error);
    }
  });

  it("500 with a response body does not contain the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ message: "Internal error", detail: "boom" }),
            { status: 500 }
          )
      )
    );
    try {
      await plankaClient.post("/api/projects", { name: "x" });
      expect.unreachable("should have thrown");
    } catch (error) {
      assertNoSecret(error);
    }
  });
});
