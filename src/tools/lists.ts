/**
 * List tools for PLANKA MCP server.
 */
import {
  createList,
  updateList,
  deleteList,
  sortList,
  moveListCards,
  clearList,
} from "../operations/lists.js";
import { PlankaError } from "../errors.js";
import { ListColorSchema } from "../schemas/entities.js";

const validListColors = ListColorSchema.options.join(", ");

/**
 * Tool: planka_manage_lists
 * Create, update, or delete lists on a board.
 */
export const manageListsTool = {
  name: "planka_manage_lists",
  description: "Create, update, or delete lists on a board.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true, // the delete action removes a list and its cards
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "delete"],
        description: "Action to perform",
      },
      boardId: {
        type: "string",
        description: "Board ID (required for create)",
      },
      listId: {
        type: "string",
        description: "List ID (required for update/delete)",
      },
      name: {
        type: "string",
        description: "List name",
      },
      position: {
        type: "number",
        description: "List position (default 65536 for create)",
      },
      type: {
        type: "string",
        enum: ["active", "closed"],
        description:
          'List type: "active" (default for create) or "closed" (done column)',
      },
      color: {
        anyOf: [
          { type: "string", enum: ListColorSchema.options },
          { type: "null" },
        ],
        description: `List color (update only, null to clear). Valid colors: ${validListColors}`,
      },
      targetBoardId: {
        type: "string",
        description: "Update only: move the list to this board",
      },
    },
    required: ["action"],
  },
  handler: async (params: {
    action: "create" | "update" | "delete";
    boardId?: string;
    listId?: string;
    name?: string;
    position?: number;
    type?: "active" | "closed";
    color?: string | null;
    targetBoardId?: string;
  }) => {
    try {
      switch (params.action) {
        case "create": {
          if (!params.boardId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: boardId is required for create action",
                },
              ],
              isError: true,
            };
          }
          if (!params.name) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: name is required for create action",
                },
              ],
              isError: true,
            };
          }

          const list = await createList({
            boardId: params.boardId,
            name: params.name,
            type: params.type,
            position: params.position,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    list: {
                      id: list.id,
                      name: list.name,
                      position: list.position,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "update": {
          if (!params.listId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: listId is required for update action",
                },
              ],
              isError: true,
            };
          }

          const updates: Record<string, unknown> = {};
          if (params.name !== undefined) updates.name = params.name;
          if (params.position !== undefined) updates.position = params.position;
          if (params.type !== undefined) updates.type = params.type;
          if (params.targetBoardId !== undefined)
            updates.boardId = params.targetBoardId;
          if (params.color !== undefined) {
            if (params.color !== null) {
              const colorParse = ListColorSchema.safeParse(params.color);
              if (!colorParse.success) {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: `Error: Invalid list color '${params.color}'. Valid colors: ${validListColors}`,
                    },
                  ],
                  isError: true,
                };
              }
            }
            updates.color = params.color;
          }

          const list = await updateList(params.listId, updates);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    list: {
                      id: list.id,
                      name: list.name,
                      position: list.position,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "delete": {
          if (!params.listId) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "Error: listId is required for delete action",
                },
              ],
              isError: true,
            };
          }

          await deleteList(params.listId);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    message: `List ${params.listId} deleted`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: Unknown action '${params.action}'`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      if (error instanceof PlankaError) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
      throw error;
    }
  },
};

/**
 * Tool: planka_sort_list
 * Sort a list's cards by a field.
 */
export const sortListTool = {
  name: "planka_sort_list",
  description:
    "Sort all cards of a list by name, dueDate, or createdAt.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      listId: {
        type: "string",
        description: "The list ID",
      },
      fieldName: {
        type: "string",
        enum: ["name", "dueDate", "createdAt"],
        description: "Field to sort by",
      },
      order: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Sort order (default: asc)",
      },
    },
    required: ["listId", "fieldName"],
  },
  handler: async (params: {
    listId: string;
    fieldName: "name" | "dueDate" | "createdAt";
    order?: "asc" | "desc";
  }) => {
    try {
      await sortList(params);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `List ${params.listId} sorted by ${params.fieldName}${params.order ? ` (${params.order})` : ""}`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof PlankaError) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
      throw error;
    }
  },
};

/**
 * Tool: planka_move_list_cards
 * Move all cards from one list to another.
 */
export const moveListCardsTool = {
  name: "planka_move_list_cards",
  description:
    "Move ALL cards from one list into another list in a single call.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      listId: {
        type: "string",
        description: "Source list ID (will be emptied)",
      },
      targetListId: {
        type: "string",
        description: "Target list ID (receives all cards)",
      },
    },
    required: ["listId", "targetListId"],
  },
  handler: async (params: { listId: string; targetListId: string }) => {
    try {
      await moveListCards(params);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `All cards moved from list ${params.listId} to list ${params.targetListId}`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof PlankaError) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
      throw error;
    }
  },
};

/**
 * Tool: planka_clear_list
 * Move all cards of a list to the trash.
 */
export const clearListTool = {
  name: "planka_clear_list",
  description:
    "Clear a list: moves ALL its cards to the trash. Use with care.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true, // sends every card in the list to the trash
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      listId: {
        type: "string",
        description: "The list ID to clear",
      },
    },
    required: ["listId"],
  },
  handler: async (params: { listId: string }) => {
    try {
      await clearList(params.listId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `All cards of list ${params.listId} moved to trash`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof PlankaError) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }
      throw error;
    }
  },
};

export const listTools = [
  manageListsTool,
  sortListTool,
  moveListCardsTool,
  clearListTool,
];
