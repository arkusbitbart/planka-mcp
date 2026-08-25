/**
 * Tests for actionable 404 error messages.
 *
 * A 404 must say which resource/ID was not found and which tool lists
 * valid IDs, instead of just echoing the request path.
 */
import { describe, it, expect } from "vitest";
import { createPlankaError, PlankaNotFoundError } from "../src/errors.js";

function message404(context: string): string {
  const error = createPlankaError(404, null, context);
  expect(error).toBeInstanceOf(PlankaNotFoundError);
  return error.message;
}

describe("404 error messages", () => {
  it("names the card and points to planka_get_board", () => {
    const msg = message404("GET /api/cards/123");
    expect(msg).toContain("Card 123 not found");
    expect(msg).toContain("planka_get_board");
  });

  it("names the board and points to planka_get_structure", () => {
    const msg = message404("GET /api/boards/42");
    expect(msg).toContain("Board 42 not found");
    expect(msg).toContain("planka_get_structure");
  });

  it("names the list on card creation in a missing list", () => {
    const msg = message404("POST /api/lists/7/cards");
    expect(msg).toContain("List 7 not found");
    expect(msg).toContain("planka_get_board");
  });

  it("names the task and points to planka_get_card", () => {
    const msg = message404("DELETE /api/tasks/99");
    expect(msg).toContain("Task 99 not found");
    expect(msg).toContain("planka_get_card");
  });

  it("names the comment and points to planka_get_comments", () => {
    const msg = message404("PATCH /api/comments/5");
    expect(msg).toContain("Comment 5 not found");
    expect(msg).toContain("planka_get_comments");
  });

  it("explains an unassign 404 with both possible causes", () => {
    const msg = message404(
      "DELETE /api/cards/123/card-memberships/userId:456"
    );
    expect(msg).toContain("User 456 not found");
    expect(msg).toContain("card 123");
    expect(msg).toContain("planka_get_board_members");
  });

  it("blames the card when adding a membership to a missing card", () => {
    const msg = message404("POST /api/cards/123/card-memberships");
    expect(msg).toContain("Card 123 not found");
    expect(msg).toContain("planka_get_board");
  });

  it("explains a card-label 404", () => {
    const msg = message404("DELETE /api/cards/123/card-labels/labelId:456");
    expect(msg).toContain("Label 456 not found");
    expect(msg).toContain("card 123");
  });

  it("falls back to a generic message for unknown paths", () => {
    const msg = message404("GET /api/unknown-things/1");
    expect(msg).toContain("not found");
  });
});
