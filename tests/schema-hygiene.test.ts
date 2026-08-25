/**
 * Input schema hygiene for all tools.
 *
 * Live finding: MCP clients (Claude Desktop) drop properties whose JSON
 * Schema `type` is an array (e.g. ["boolean","null"]) — the model then
 * sees an untyped `{}`, guesses, and sends strings that the Zod layer
 * rejects ("Expected boolean, received string"). Unions must therefore
 * be expressed as `anyOf` with single-typed branches.
 *
 * Every property must declare a usable type:
 *  - `type` as a single string, or
 *  - `anyOf`/`oneOf` whose every branch itself passes this check,
 * and every top-level property must carry a description.
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
  items?: unknown;
  properties?: Record<string, unknown>;
  description?: unknown;
}

function assertTyped(node: SchemaNode, path: string): void {
  const union = (node.anyOf ?? node.oneOf) as SchemaNode[] | undefined;

  if (union !== undefined) {
    expect(Array.isArray(union), `${path}: anyOf/oneOf must be an array`).toBe(
      true
    );
    expect(union.length, `${path}: empty union`).toBeGreaterThan(0);
    union.forEach((branch, i) => assertTyped(branch, `${path}.anyOf[${i}]`));
    return;
  }

  // No union: type must be present and a plain string — arrays like
  // ["boolean","null"] are exactly what clients mangle into {}.
  expect(node.type, `${path}: property has no type`).toBeDefined();
  expect(
    typeof node.type,
    `${path}: type must be a single string, not ${JSON.stringify(node.type)}`
  ).toBe("string");

  if (node.type === "array") {
    expect(node.items, `${path}: array without items`).toBeDefined();
    assertTyped(node.items as SchemaNode, `${path}.items`);
  }
  if (node.type === "object" && node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      assertTyped(child as SchemaNode, `${path}.${key}`);
    }
  }
}

describe("input schema hygiene", () => {
  it("every property declares a single-string type (or a typed anyOf union)", () => {
    for (const tool of everyTool) {
      for (const [name, prop] of Object.entries(
        tool.inputSchema.properties ?? {}
      )) {
        assertTyped(prop as SchemaNode, `${tool.name}.${name}`);
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
