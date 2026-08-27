#!/usr/bin/env node
/**
 * PLANKA MCP Server — stdio entry point.
 *
 * A Model Context Protocol server for PLANKA kanban boards.
 * For the HTTP transport (custom connector deployments), see http.ts.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createPlankaServer } from "./server.js";

/**
 * Main entry point.
 */
async function main() {
  const server = createPlankaServer();

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log startup (to stderr so it doesn't interfere with MCP protocol)
  console.error("PLANKA MCP server started");
}

// Run the server
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
