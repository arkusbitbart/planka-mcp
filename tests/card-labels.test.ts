/**
 * Regression tests for the card label resolution and the attachment
 * schema, both observed against a live PLANKA 2.2.1:
 *
 * - GET /cards/{id} includes only cardLabels junction records, no label
 *   metadata — planka_get_card must resolve name/color via the board.
 * - Attachments per spec have type/data (no top-level url) and nullable
 *   timestamps; parsing a spec-shaped attachment must not throw.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { resolveCardLabels } from "../src/operations/labels.js";
import { getCard, CardDetails } from "../src/operations/cards.js";

const CARD = {
  id: "card1",
  boardId: "board1",
  listId: "list1",
  name: "Card 1",
  position: 65536,
  type: "project" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const LABEL = {
  id: "label1",
  boardId: "board1",
  name: "Bug",
  color: "berry-red" as const,
  position: 65536,
  createdAt: "2026-01-01T00:00:00.000Z",
};

function details(overrides: Partial<CardDetails>): CardDetails {
  return {
    card: CARD,
    taskLists: [],
    tasks: [],
    labels: [],
    cardLabels: [],
    attachments: [],
    cardMemberships: [],
    users: [],
    ...overrides,
  };
}

function mockFetch(responseBody: unknown) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
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

describe("resolveCardLabels", () => {
  it("returns [] without any request when the card has no labels", async () => {
    const calls = mockFetch({});
    const labels = await resolveCardLabels(details({}));
    expect(labels).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("resolves name and color via the board when metadata is missing", async () => {
    const calls = mockFetch({
      item: {
        id: "board1",
        projectId: "p1",
        name: "Board",
        position: 65536,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      included: { labels: [LABEL] },
    });

    const labels = await resolveCardLabels(
      details({
        cardLabels: [
          {
            id: "cl1",
            cardId: "card1",
            labelId: "label1",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    );

    expect(calls).toEqual(["http://planka.test/api/boards/board1"]);
    expect(labels).toEqual([
      { id: "label1", name: "Bug", color: "berry-red" },
    ]);
  });

  it("makes no request when the card details already carry the metadata", async () => {
    const calls = mockFetch({});
    const labels = await resolveCardLabels(
      details({
        labels: [LABEL],
        cardLabels: [
          {
            id: "cl1",
            cardId: "card1",
            labelId: "label1",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    );
    expect(calls).toHaveLength(0);
    expect(labels).toEqual([
      { id: "label1", name: "Bug", color: "berry-red" },
    ]);
  });

  it("falls back to null name/color for an unknown label", async () => {
    mockFetch({
      item: {
        id: "board1",
        projectId: "p1",
        name: "Board",
        position: 65536,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      included: { labels: [] },
    });

    const labels = await resolveCardLabels(
      details({
        cardLabels: [
          {
            id: "cl1",
            cardId: "card1",
            labelId: "ghost",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      })
    );
    expect(labels).toEqual([{ id: "ghost", name: null, color: null }]);
  });
});

describe("getCard tolerates spec-shaped included data", () => {
  it("parses attachments with type/data and null timestamps", async () => {
    mockFetch({
      item: CARD,
      included: {
        attachments: [
          {
            id: "a1",
            cardId: "card1",
            creatorUserId: null,
            type: "link",
            data: { url: "https://example.com" },
            name: "Example",
            createdAt: null,
            updatedAt: null,
          },
        ],
      },
    });

    const result = await getCard("card1");
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].type).toBe("link");
    expect(result.attachments[0].data?.url).toBe("https://example.com");
  });
});
