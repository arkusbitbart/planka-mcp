/**
 * Input schema hygiene for all tools.
 *
 * Live findings (twice): MCP clients (Claude Desktop) mangle union-typed
 * properties into {} during schema translation — both array-valued `type`
 * (["boolean","null"]) and `anyOf`/`oneOf` unions arrived as untyped
 * fields, the model guessed, and the Zod layer rejected the guess
 * ("Expected boolean, received string").
 *
 * Rule: every property declares exactly one string `type` — no arrays,
 * no anyOf, no oneOf, anywhere in the schema tree. Null semantics are
 * expressed via sentinel values ("", "none") that the server translates,
 * and the server parses leniently (string booleans/numbers are coerced).
 * Every top-level property must carry a description.
 */
import { describe, it, expect } from "vitest";
import { allTools, attachmentTools } from "../src/tools/index.js";

const everyTool = [
  ...allTools,
  ...attachmentTools.filter((t) => !allTools.some((a) => a.name === t.name)),
];

interface SchemaNode {
  type?: unknown;
  anyOf?: unknown;
  oneOf?: unknown;
  allOf?: unknown;
  items?: unknown;
  properties?: Record<string, unknown>;
  description?: unknown;
}

function assertSingleTyped(node: SchemaNode, path: string): void {
  expect(node.anyOf, `${path}: anyOf is forbidden (clients mangle unions)`)
    .toBeUndefined();
  expect(node.oneOf, `${path}: oneOf is forbidden (clients mangle unions)`)
    .toBeUndefined();
  expect(node.allOf, `${path}: allOf is forbidden`).toBeUndefined();

  expect(node.type, `${path}: property has no type`).toBeDefined();
  expect(
    typeof node.type,
    `${path}: type must be exactly one string, not ${JSON.stringify(node.type)}`
  ).toBe("string");

  if (node.type === "array") {
    expect(node.items, `${path}: array without items`).toBeDefined();
    assertSingleTyped(node.items as SchemaNode, `${path}.items`);
  }
  if (node.type === "object" && node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      assertSingleTyped(child as SchemaNode, `${path}.${key}`);
    }
  }
}

describe("input schema hygiene", () => {
  it("every property declares exactly one string type — no unions of any spelling", () => {
    for (const tool of everyTool) {
      for (const [name, prop] of Object.entries(
        tool.inputSchema.properties ?? {}
      )) {
        assertSingleTyped(prop as SchemaNode, `${tool.name}.${name}`);
      }
    }
  });

  it("every top-level property has a description", () => {
    for (const tool of everyTool) {
      for (const [name, prop] of Object.entries(
        tool.inputSchema.properties ?? {}
      )) {
        const description = (prop as SchemaNode).description;
        expect(
          typeof description,
          `${tool.name}.${name} is missing a description`
        ).toBe("string");
        expect((description as string).length).toBeGreaterThan(0);
      }
    }
  });
});
