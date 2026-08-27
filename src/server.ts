/**
 * Shared MCP server factory used by both transports (stdio and HTTP).
 * All tool registration and error mapping lives here — the entry points
 * only choose the transport.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getToolDefinitions, getTool } from "./tools/index.js";
import { PlankaError, PlankaConfigError } from "./errors.js";

/**
 * Creates a PLANKA MCP server with all tools registered.
 */
export function createPlankaServer(): Server {
  const server = new Server(
    {
      name: "planka-mcp",
      version: "2.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handler for listing available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: getToolDefinitions(),
    };
  });

  // Handler for tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const tool = getTool(name);
    if (!tool) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args || {});
      return result;
    } catch (error) {
      // Handle configuration errors specifically
      if (error instanceof PlankaConfigError) {
        return {
          content: [
            {
              type: "text",
              text: `Configuration error: ${error.message}\n\nRequired environment variables:\n- PLANKA_BASE_URL\n- PLANKA_API_KEY (recommended)\n  or PLANKA_AGENT_EMAIL + PLANKA_AGENT_PASSWORD`,
            },
          ],
          isError: true,
        };
      }

      // Handle other PLANKA errors
      if (error instanceof PlankaError) {
        return {
          content: [
            {
              type: "text",
              text: `PLANKA error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      // Log unexpected errors and return generic message
      console.error(`Error in tool ${name}:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Unexpected error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}
