/**
 * Tests for card position resolution ("top" / "bottom" / number).
 * Only the branches without network access are covered here; "bottom"
 * requires a GET /lists/{id} against a live instance.
 */
import { describe, it, expect } from "vitest";
import {
  resolveListPosition,
  DEFAULT_CARD_POSITION,
} from "../src/operations/cards.js";

describe("resolveListPosition", () => {
  it("keeps the historical default when position is omitted", async () => {
    expect(await resolveListPosition("list1")).toBe(DEFAULT_CARD_POSITION);
  });

  it('maps "top" to position 0', async () => {
    expect(await resolveListPosition("list1", "top")).toBe(0);
  });

  it("passes numeric positions through unchanged", async () => {
    expect(await resolveListPosition("list1", 12345)).toBe(12345);
    expect(await resolveListPosition("list1", 0)).toBe(0);
  });
});
