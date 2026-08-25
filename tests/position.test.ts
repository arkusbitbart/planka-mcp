/**
 * Tests for card position resolution ("top" / "bottom" / number).
 * "top" and "bottom" fetch GET /lists/{id}; fetch is mocked here.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  resolveListPosition,
  DEFAULT_CARD_POSITION,
} from "../src/operations/cards.js";

function listResponse(positions: number[]) {
  return {
    item: {
      id: "list1",
      boardId: "board1",
      name: "List 1",
      position: 65536,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    included: {
      cards: positions.map((position, i) => ({
        id: `card${i}`,
        boardId: "board1",
        listId: "list1",
        name: `Card ${i}`,
        position,
        type: "project",
        createdAt: "2026-01-01T00:00:00.000Z",
      })),
    },
  };
}

function mockListFetch(positions: number[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(listResponse(positions)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
}

beforeAll(() => {
  process.env.PLANKA_BASE_URL = "http://planka.test";
  process.env.PLANKA_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resolveListPosition", () => {
  it("keeps the historical default when position is omitted (no request)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await resolveListPosition("list1")).toBe(DEFAULT_CARD_POSITION);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes numeric positions through unchanged (no request)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await resolveListPosition("list1", 12345)).toBe(12345);
    expect(await resolveListPosition("list1", 0)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('"top" halves the first card\'s position', async () => {
    mockListFetch([16384, 65536, 131072]);
    expect(await resolveListPosition("list1", "top")).toBe(8192);
  });

  it('"top" on an empty list uses the default', async () => {
    mockListFetch([]);
    expect(await resolveListPosition("list1", "top")).toBe(
      DEFAULT_CARD_POSITION
    );
  });

  it('"bottom" goes one gap after the last card', async () => {
    mockListFetch([16384, 65536]);
    expect(await resolveListPosition("list1", "bottom")).toBe(
      65536 + DEFAULT_CARD_POSITION
    );
  });

  it('"bottom" on an empty list uses the default', async () => {
    mockListFetch([]);
    expect(await resolveListPosition("list1", "bottom")).toBe(
      DEFAULT_CARD_POSITION
    );
  });
});
