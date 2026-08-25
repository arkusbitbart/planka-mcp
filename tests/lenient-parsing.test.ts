/**
 * Tests for lenient server-side parsing and null sentinels.
 *
 * Tool schemas declare exactly one type per property; clients that guess
 * (or cannot express null) send strings. The server translates instead of
 * rejecting: "true"/"false" become booleans, numeric strings become
 * numbers, and "" / "none" become null where clearing is meaningful.
 */
import { describe, it, expect } from "vitest";
import {
  UpdateCardSchema,
  UpdateTaskSchema,
  UpdateTaskListSchema,
  CreateListSchema,
  CreateCardSchema,
} from "../src/schemas/requests.js";

describe("lenient booleans", () => {
  it('accepts "true"/"false" strings for isDueCompleted', () => {
    expect(UpdateCardSchema.parse({ isDueCompleted: "true" })).toEqual({
      isDueCompleted: true,
    });
    expect(UpdateCardSchema.parse({ isDueCompleted: "false" })).toEqual({
      isDueCompleted: false,
    });
    expect(UpdateCardSchema.parse({ isDueCompleted: true })).toEqual({
      isDueCompleted: true,
    });
  });

  it('accepts "true" for task isCompleted and checklist flags', () => {
    expect(UpdateTaskSchema.parse({ isCompleted: "true" })).toEqual({
      isCompleted: true,
    });
    expect(UpdateTaskListSchema.parse({ showOnFrontOfCard: "false" })).toEqual(
      { showOnFrontOfCard: false }
    );
  });

  it("still rejects non-boolean junk", () => {
    expect(() => UpdateCardSchema.parse({ isDueCompleted: "yes" })).toThrow();
  });
});

describe("lenient numbers", () => {
  it("accepts numeric strings for positions", () => {
    expect(CreateListSchema.parse({ boardId: "b", name: "L", position: "123" }))
      .toMatchObject({ position: 123 });
    expect(
      CreateCardSchema.parse({ listId: "l", name: "C", position: "42" })
    ).toMatchObject({ position: 42 });
  });

  it("still rejects non-numeric strings", () => {
    expect(() =>
      CreateListSchema.parse({ boardId: "b", name: "L", position: "abc" })
    ).toThrow();
  });
});

describe("null sentinels", () => {
  it('"" clears the card description', () => {
    expect(UpdateCardSchema.parse({ description: "" })).toEqual({
      description: null,
    });
    expect(UpdateCardSchema.parse({ description: "text" })).toEqual({
      description: "text",
    });
  });

  it('"" and "none" clear the due date', () => {
    expect(UpdateCardSchema.parse({ dueDate: "" })).toEqual({ dueDate: null });
    expect(UpdateCardSchema.parse({ dueDate: "none" })).toEqual({
      dueDate: null,
    });
    expect(
      UpdateCardSchema.parse({ dueDate: "2026-08-31T17:00:00.000Z" })
    ).toEqual({ dueDate: "2026-08-31T17:00:00.000Z" });
  });

  it('"" and "none" unassign a task', () => {
    expect(UpdateTaskSchema.parse({ assigneeUserId: "" })).toEqual({
      assigneeUserId: null,
    });
    expect(UpdateTaskSchema.parse({ assigneeUserId: "none" })).toEqual({
      assigneeUserId: null,
    });
    expect(UpdateTaskSchema.parse({ assigneeUserId: "u1" })).toEqual({
      assigneeUserId: "u1",
    });
  });
});
