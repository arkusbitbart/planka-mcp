/**
 * Tests for the human-readable activity/notification summaries.
 * The action data payload is polymorphic; unknown types must not throw.
 */
import { describe, it, expect } from "vitest";
import {
  summarizeAction,
  summarizeNotification,
} from "../src/operations/activity.js";

const base = { id: "a1", userId: "u1", createdAt: "2026-01-01T00:00:00.000Z" };

describe("summarizeAction", () => {
  it("summarizes moveCard with lists", () => {
    const summary = summarizeAction({
      ...base,
      type: "moveCard",
      data: {
        card: { name: "Fix login" },
        fromList: { name: "To Do" },
        toList: { name: "Doing" },
      },
    });
    expect(summary).toBe('moved card "Fix login" from "To Do" to "Doing"');
  });

  it("summarizes createCard", () => {
    const summary = summarizeAction({
      ...base,
      type: "createCard",
      data: { card: { name: "Fix login" }, list: { name: "To Do" } },
    });
    expect(summary).toBe('created card "Fix login" in "To Do"');
  });

  it("falls back to the type name for unknown types", () => {
    const summary = summarizeAction({
      ...base,
      type: "someFutureType",
      data: { card: { name: "X" } },
    });
    expect(summary).toContain("someFutureType");
    expect(summary).toContain('"X"');
  });

  it("copes with missing data", () => {
    expect(() =>
      summarizeAction({ ...base, type: "moveCard", data: null })
    ).not.toThrow();
  });
});

describe("summarizeNotification", () => {
  it("summarizes a mention with comment text", () => {
    const summary = summarizeNotification({
      id: "n1",
      userId: "u1",
      type: "mentionInComment",
      data: { card: { name: "Fix login" }, text: "please look at this" },
      isRead: false,
    });
    expect(summary).toContain('card "Fix login"');
    expect(summary).toContain("please look at this");
  });

  it("falls back gracefully for unknown types", () => {
    expect(() =>
      summarizeNotification({
        id: "n1",
        userId: "u1",
        type: "somethingNew",
        data: null,
        isRead: true,
      })
    ).not.toThrow();
  });
});
