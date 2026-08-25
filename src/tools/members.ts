/**
 * Card membership tools for PLANKA MCP server.
 */
import {
  getBoardMembers,
  assignCardMember,
  unassignCardMember,
} from "../operations/members.js";
import { PlankaError } from "../errors.js";

/**
 * Tool: planka_get_board_members
 * List all members of a board.
 */
export const getBoardMembersTool = {
  name: "planka_get_board_members",
  description:
    "List all members of a board with their user IDs and roles. Use this to find the userId before assigning someone to a card.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      boardId: {
        type: "string",
        description: "The board ID",
      },
    },
    required: ["boardId"],
  },
  handler: async (params: { boardId: string }) => {
    try {
      const members = await getBoardMembers(params.boardId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                boardId: params.boardId,
                memberCount: members.length,
                members,
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
 * Tool: planka_assign_card
 * Assign a user to a card.
 */
export const assignCardTool = {
  name: "planka_assign_card",
  description:
    "Assign a user to a card. Get valid userIds from planka_get_board_members first. Assigning an already-assigned user is a no-op.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      cardId: {
        type: "string",
        description: "The card ID",
      },
      userId: {
        type: "string",
        description: "The user ID to assign (must be a board member)",
      },
    },
    required: ["cardId", "userId"],
  },
  handler: async (params: { cardId: string; userId: string }) => {
    try {
      const result = await assignCardMember({
        cardId: params.cardId,
        userId: params.userId,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                cardId: params.cardId,
                userId: params.userId,
                ...(result.alreadyAssigned && {
                  note: "User was already assigned to this card",
                }),
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
 * Tool: planka_unassign_card
 * Remove a user from a card.
 */
export const unassignCardTool = {
  name: "planka_unassign_card",
  description: "Remove an assigned user from a card.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      cardId: {
        type: "string",
        description: "The card ID",
      },
      userId: {
        type: "string",
        description: "The user ID to unassign",
      },
    },
    required: ["cardId", "userId"],
  },
  handler: async (params: { cardId: string; userId: string }) => {
    try {
      await unassignCardMember({
        cardId: params.cardId,
        userId: params.userId,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                cardId: params.cardId,
                userId: params.userId,
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

export const memberTools = [
  getBoardMembersTool,
  assignCardTool,
  unassignCardTool,
];
