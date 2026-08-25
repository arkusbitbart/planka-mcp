/**
 * Tests for MCP tool annotations.
 *
 * Every tool must carry annotations so clients can auto-approve read-only
 * calls and warn on destructive ones.
 */
import { describe, it, expect } from "vitest";
import { allTools, getToolDefinitions } from "../src/tools/index.js";

describe("tool annotations", () => {
  it("every registered tool has annotations", () => {
    for (const tool of allTools) {
      expect(tool.annotations, `${tool.name} is missing annotations`).toBeDefined();
      expect(tool.annotations).toHaveProperty("readOnlyHint");
      expect(tool.annotations).toHaveProperty("destructiveHint");
      expect(tool.annotations).toHaveProperty("idempotentHint");
    }
  });

  it("all planka_get_* tools are read-only", () => {
    const getTools = allTools.filter((t) => t.name.startsWith("planka_get_"));
    expect(getTools.length).toBeGreaterThan(0);
    for (const tool of getTools) {
      expect(tool.annotations?.readOnlyHint, `${tool.name}`).toBe(true);
      expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(false);
    }
  });

  it("delete tools are marked destructive", () => {
    const deleteTools = allTools.filter((t) => t.name.includes("delete"));
    for (const tool of deleteTools) {
      expect(tool.annotations?.destructiveHint, `${tool.name}`).toBe(true);
    }
  });

  it("read-only tools are never marked destructive", () => {
    for (const tool of allTools) {
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
