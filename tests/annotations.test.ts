/**
 * Tests for MCP tool annotations.
 *
 * Every tool must carry annotations so clients can auto-approve read-only
 * calls and warn on destructive ones.
 */
import { describe, it, expect } from "vitest";
import {
  allTools,
  attachmentTools,
  getToolDefinitions,
} from "../src/tools/index.js";

// attachmentTools covers planka_add_attachment even when PLANKA_UPLOAD_DIR
// is unset in the test environment and the tool is not in allTools.
const everyTool = [
  ...allTools,
  ...attachmentTools.filter((t) => !allTools.some((a) => a.name === t.name)),
];

/** Tools whose (possibly conditional) actions permanently destroy data. */
const EXPECTED_DESTRUCTIVE = new Set([
  "planka_delete_card",
  "planka_delete_task",
  "planka_delete_comment",
  "planka_manage_labels",
  "planka_manage_lists",
  "planka_manage_task_lists",
  "planka_manage_boards",
  "planka_clear_list",
]);

describe("tool annotations", () => {
  it("every tool has annotations", () => {
    for (const tool of everyTool) {
      expect(tool.annotations, `${tool.name} is missing annotations`).toBeDefined();
      expect(tool.annotations).toHaveProperty("readOnlyHint");
      expect(tool.annotations).toHaveProperty("destructiveHint");
      expect(tool.annotations).toHaveProperty("idempotentHint");
    }
  });

  it("exactly the expected tools are marked destructive", () => {
    const destructive = new Set(
      everyTool
        .filter((t) => t.annotations?.destructiveHint === true)
        .map((t) => t.name)
    );
    expect(destructive).toEqual(EXPECTED_DESTRUCTIVE);
  });

  it("all planka_get_* tools are read-only", () => {
    const getTools = everyTool.filter((t) => t.name.startsWith("planka_get_"));
    expect(getTools.length).toBeGreaterThan(0);
    for (const tool of getTools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name}`).toBe(true);
      expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(false);
    }
  });

  it("delete tools are marked destructive", () => {
    const deleteTools = everyTool.filter((t) => t.name.includes("delete"));
    for (const tool of deleteTools) {
      expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(true);
    }
  });

  it("read-only tools are never marked destructive", () => {
    for (const tool of everyTool) {
      if (tool.annotations?.readOnlyHint) {
        expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(false);
      }
    }
  });

  it("tool definitions expose annotations to the MCP client", () => {
    for (const def of getToolDefinitions()) {
      expect(def.annotations, `${def.name}`).toBeDefined();
    }
  });
});
