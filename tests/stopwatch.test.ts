/**
 * Tests for card time tracking (stopwatch) and the isDueCompleted fix.
 *
 * The stopwatch is a field on the card ({startedAt, total} via
 * PATCH /cards/{id}), not an endpoint. The PATCH body field for the due
 * checkbox is isDueCompleted — the previously sent isCompleted does not
 * exist in the API and was silently ignored.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  resolveStopwatchUpdate,
  formatStopwatch,
  updateCard,
} from "../src/operations/cards.js";

const NOW = Date.parse("2026-08-26T12:00:00.000Z");

function card(stopwatch: { startedAt: string | null; total: number } | null) {
  return {
    id: "card1",
    boardId: "board1",
    listId: "list1",
    name: "Card 1",
    position: 65536,
    type: "project",
    stopwatch,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

interface CapturedCall {
  url: string;
  method: string;
  body: unknown;
}

function mockFetch(responseBody: unknown): CapturedCall[] {
  const calls: CapturedCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body:
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })
  );
  return calls;
}

beforeAll(() => {
  process.env.PLANKA_BASE_URL = "http://planka.test";
  process.env.PLANKA_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatStopwatch", () => {
  it("returns null when there is no stopwatch", () => {
    expect(formatStopwatch(null, NOW)).toBeNull();
    expect(formatStopwatch(undefined, NOW)).toBeNull();
  });

  it("formats a paused stopwatch from total seconds", () => {
    expect(formatStopwatch({ startedAt: null, total: 3661 }, NOW)).toEqual({
      running: false,
      elapsed: "1h 1m 1s",
    });
    expect(formatStopwatch({ startedAt: null, total: 45 }, NOW)).toEqual({
      running: false,
      elapsed: "45s",
    });
  });

  it("adds the running time since startedAt", () => {
    const startedAt = new Date(NOW - 90_000).toISOString();
    expect(formatStopwatch({ startedAt, total: 30 }, NOW)).toEqual({
      running: true,
      elapsed: "2m 0s",
      startedAt,
    });
  });
});

describe("resolveStopwatchUpdate", () => {
  it('"reset" and raw values need no request', async () => {
    const calls = mockFetch({});
    expect(await resolveStopwatchUpdate("card1", "reset", NOW)).toBeNull();
    expect(await resolveStopwatchUpdate("card1", null, NOW)).toBeNull();
    const raw = { startedAt: null, total: 120 };
    expect(await resolveStopwatchUpdate("card1", raw, NOW)).toBe(raw);
    expect(calls).toHaveLength(0);
  });

  it('"start" on a card without a stopwatch begins at total 0', async () => {
    const calls = mockFetch({ item: card(null), included: {} });

    const result = await resolveStopwatchUpdate("card1", "start", NOW);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://planka.test/api/cards/card1");
    expect(result).toEqual({
      startedAt: new Date(NOW).toISOString(),
      total: 0,
    });
  });

  it('"start" while already running keeps the current state', async () => {
    const startedAt = new Date(NOW - 60_000).toISOString();
    mockFetch({ item: card({ startedAt, total: 100 }), included: {} });

    expect(await resolveStopwatchUpdate("card1", "start", NOW)).toEqual({
      startedAt,
      total: 100,
    });
  });

  it('"stop" adds the elapsed time to the total and pauses', async () => {
    const startedAt = new Date(NOW - 90_000).toISOString();
    mockFetch({ item: card({ startedAt, total: 30 }), included: {} });

    expect(await resolveStopwatchUpdate("card1", "stop", NOW)).toEqual({
      startedAt: null,
      total: 120,
    });
  });

  it('"stop" while paused keeps the total', async () => {
    mockFetch({ item: card({ startedAt: null, total: 300 }), included: {} });

    expect(await resolveStopwatchUpdate("card1", "stop", NOW)).toEqual({
      startedAt: null,
      total: 300,
    });
  });
});

describe("updateCard PATCH body", () => {
  it("sends isDueCompleted and stopwatch as-is", async () => {
    const calls = mockFetch({
      item: card({ startedAt: null, total: 60 }),
    });

    await updateCard("card1", {
      isDueCompleted: true,
      stopwatch: { startedAt: null, total: 60 },
    });

    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({
      isDueCompleted: true,
      stopwatch: { startedAt: null, total: 60 },
    });
  });

  it("rejects the nonexistent isCompleted field at the schema level", async () => {
    const calls = mockFetch({ item: card(null) });

    await updateCard("card1", { isCompleted: true } as never);

    // zod strips unknown keys, so the dead field never reaches the API
    expect(calls[0].body).toEqual({});
  });
});
