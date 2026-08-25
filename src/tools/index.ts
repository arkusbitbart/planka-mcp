/**
 * Tool registry for PLANKA MCP server.
 */
import { navigationTools } from "./navigation.js";
import { cardTools } from "./cards.js";
import { taskTools } from "./tasks.js";
import { labelTools } from "./labels.js";
import { commentTools } from "./comments.js";
import { listTools } from "./lists.js";
import { memberTools } from "./members.js";
import { activityTools } from "./activity.js";
import {
  addAttachmentTool,
  addLinkAttachmentTool,
  isAttachmentToolEnabled,
} from "./attachments.js";

/**
 * All registered tools.
 * The file attachment tool is only exposed when PLANKA_UPLOAD_DIR is
 * configured; link attachments are always available.
 */
export const allTools = [
  ...navigationTools,
  ...cardTools,
  ...taskTools,
  ...labelTools,
  ...commentTools,
  ...listTools,
  ...memberTools,
  ...activityTools,
  ...(isAttachmentToolEnabled() ? [addAttachmentTool] : []),
  addLinkAttachmentTool,
];

/**
 * MCP tool behavior hints. Clients use these to decide when to ask the user
 * for confirmation (e.g. read-only tools can be auto-approved).
 */
export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

/**
 * Tool type definition.
 */
export interface Tool {
  name: string;
  description: string;
  annotations?: ToolAnnotations;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (params: unknown) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
  }>;
}

/**
 * Get a tool by name.
 */
export function getTool(name: string): Tool | undefined {
  return allTools.find((tool) => tool.name === name) as Tool | undefined;
}

/**
 * Get all tool definitions (for MCP listTools).
 */
export function getToolDefinitions() {
  return allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }));
}

// Re-export individual tool groups
export { navigationTools } from "./navigation.js";
export { cardTools } from "./cards.js";
export { taskTools } from "./tasks.js";
export { labelTools } from "./labels.js";
export { commentTools } from "./comments.js";
export { listTools } from "./lists.js";
export { memberTools } from "./members.js";
export { attachmentTools } from "./attachments.js";
