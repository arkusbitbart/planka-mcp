/**
 * Tests for label removal via the spec path
 * DELETE /cards/{cardId}/card-labels/labelId:{labelId}.
 *
 * A 404 must not be silently treated as success: the card is re-checked,
 * and if the label is still attached, an honest error names the path used.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { removeLabelFromCard } from "../src/operations/labels.js";
import { PlankaError } from "../src/errors.js";

const CARD = {
  id: "card1",
  boardId: "board1",
  listId: "list1",
  name: "Card 1",
  position: 65536,
  type: "project",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: Response[]) {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      const next = responses.shift();
      if (!next) throw new Error("unexpected extra fetch call");
      return next;
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

describe("removeLabelFromCard", () => {
  it("uses the spec path and needs no extra request on success", async () => {
    const calls = mockFetchSequence([
      json(200, {
        item: {
          id: "cl1",
          cardId: "card1",
          labelId: "label1",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    ]);

    await removeLabelFromCard("card1", "label1");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("DELETE");
    expect(calls[0].url).toBe(
      "http://planka.test/api/cards/card1/card-labels/labelId:label1"
    );
  });

  it("treats a 404 as no-op when the label is confirmed gone", async () => {
    mockFetchSequence([
      json(404, { message: "Not found" }),
      json(200, { item: CARD, included: { cardLabels: [] } }),
    ]);

    await expect(
      removeLabelFromCard("card1", "label1")
    ).resolves.toBeUndefined();
  });

  it("raises an honest error when 404 but the label is still on the card", async () => {
    mockFetchSequence([
      json(404, { message: "Not found" }),
      json(200, {
        item: CARD,
        included: {
          cardLabels: [
            {
              id: "cl1",
              cardId: "card1",
              labelId: "label1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    ]);

    await expect(removeLabelFromCard("card1", "label1")).rejects.toThrow(
      PlankaError
    );
  });

  it("the unconfirmed-removal error names the path used", async () => {
    mockFetchSequence([
      json(404, { message: "Not found" }),
      json(200, {
        item: CARD,
        included: {
          cardLabels: [
            {
              id: "cl1",
              cardId: "card1",
              labelId: "label1",
              createdAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
    ]);

    await expect(removeLabelFromCard("card1", "label1")).rejects.toThrow(
      /could not be confirmed.*card-labels\/labelId:label1/s
    );
  });
});
