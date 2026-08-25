/**
 * Regression tests for three bugs observed against a live PLANKA 2.2.1:
 *
 * 1. POST /boards/{id}/lists requires type (and position) — the request
 *    body must always carry both.
 * 2. Comments are not part of GET /cards/{id}; reading them must go through
 *    GET /cards/{cardId}/comments and its items field.
 * 3. POST /cards/{id}/duplicate rejects requests without position
 *    ("Position must be present") even though the spec marks nothing as
 *    required — position must always be sent.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { createList, updateList } from "../src/operations/lists.js";
import { getCommentsForCard } from "../src/operations/comments.js";
import { duplicateCard } from "../src/operations/cards.js";

const LIST = {
  id: "list1",
  boardId: "board1",
  name: "To Do",
  position: 65536,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const CARD = {
  id: "card1",
  boardId: "board1",
  listId: "list1",
  name: "Card 1",
  position: 65536,
  type: "project",
  createdAt: "2026-01-01T00:00:00.000Z",
};

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

describe("bug 1: list creation sends type and position", () => {
  it("sends type 'active' and position 65536 by default", async () => {
    const calls = mockFetch({ item: LIST });

    await createList({ boardId: "board1", name: "To Do" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://planka.test/api/boards/board1/lists");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({
      type: "active",
      name: "To Do",
      position: 65536,
    });
  });

  it("allows overriding the type", async () => {
    const calls = mockFetch({ item: LIST });

    await createList({ boardId: "board1", name: "Done", type: "closed" });

    expect((calls[0].body as Record<string, unknown>).type).toBe("closed");
  });

  it("update passes type, color, and boardId through", async () => {
    const calls = mockFetch({ item: LIST });

    await updateList("list1", {
      name: "Done",
      type: "closed",
      color: "turquoise-sea",
      boardId: "board2",
    });

    expect(calls[0].url).toBe("http://planka.test/api/lists/list1");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({
      name: "Done",
      type: "closed",
      color: "turquoise-sea",
      boardId: "board2",
    });
  });

  it("update rejects invalid list colors before any request", async () => {
    const calls = mockFetch({ item: LIST });

    await expect(
      updateList("list1", { color: "lagune-blue" as never })
    ).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("bug 2: comments are read from GET /cards/{cardId}/comments", () => {
  const COMMENTS_RESPONSE = {
    items: [
      {
        id: "c1",
        cardId: "card1",
        userId: "u1",
        text: "Hello",
        createdAt: "2026-01-02T00:00:00.000Z",
      },
    ],
    included: {
      users: [
        { id: "u1", name: "Alice", createdAt: "2026-01-01T00:00:00.000Z" },
      ],
    },
  };

  it("uses the dedicated comments endpoint and reads items", async () => {
    const calls = mockFetch(COMMENTS_RESPONSE);

    const page = await getCommentsForCard("card1");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("http://planka.test/api/cards/card1/comments");
    expect(calls[0].method).toBe("GET");
    expect(page.comments).toHaveLength(1);
    expect(page.comments[0].text).toBe("Hello");
    expect(page.users[0].name).toBe("Alice");
  });

  it("passes beforeId for pagination", async () => {
    const calls = mockFetch({ items: [], included: { users: [] } });

    await getCommentsForCard("card1", "c0");

    expect(calls[0].url).toBe(
      "http://planka.test/api/cards/card1/comments?beforeId=c0"
    );
  });
});

describe("bug 3: duplicate always sends position", () => {
  it("defaults position to 65536", async () => {
    const calls = mockFetch({ item: CARD });

    await duplicateCard({ cardId: "card1" });

    expect(calls[0].url).toBe("http://planka.test/api/cards/card1/duplicate");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].body).toEqual({ position: 65536 });
  });

  it("passes an explicit position through", async () => {
    const calls = mockFetch({ item: CARD });

    await duplicateCard({ cardId: "card1", position: 123, name: "Copy" });

    expect(calls[0].body).toEqual({ position: 123, name: "Copy" });
  });
});
