/**
 * Comment tools for PLANKA MCP server.
 */
import {
  createComment,
  updateComment,
  deleteComment,
  getCommentsForCard,
} from "../operations/comments.js";
import { PlankaError } from "../errors.js";

/**
 * Tool: planka_add_comment
 * Add a comment to a card.
 */
export const addCommentTool = {
  name: "planka_add_comment",
  description:
    "Add a comment to a card. Use this for status updates, notes, or agent activity logs.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      cardId: {
        type: "string",
        description: "The card ID",
      },
      text: {
        type: "string",
        description: "Comment text (markdown supported)",
      },
    },
    required: ["cardId", "text"],
  },
  handler: async (params: { cardId: string; text: string }) => {
    try {
      const comment = await createComment({
        cardId: params.cardId,
        text: params.text,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                comment: {
                  id: comment.id,
                  text: comment.text,
                  createdAt: comment.createdAt,
                },
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
 * Tool: planka_get_comments
 * Get all comments on a card.
 */
export const getCommentsTool = {
  name: "planka_get_comments",
  description: "Get all comments on a card.",
  annotations: {
    readOnlyHint: true,
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
    },
    required: ["cardId"],
  },
  handler: async (params: { cardId: string }) => {
    try {
      const comments = await getCommentsForCard(params.cardId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                cardId: params.cardId,
                commentCount: comments.length,
                comments: comments.map((c) => ({
                  id: c.id,
                  text: c.text,
                  createdAt: c.createdAt,
                })),
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
 * Tool: planka_update_comment
 * Edit an existing comment.
 */
export const updateCommentTool = {
  name: "planka_update_comment",
  description:
    "Edit the text of an existing comment. Get comment IDs from planka_get_comments.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      commentId: {
        type: "string",
        description: "The comment ID",
      },
      text: {
        type: "string",
        description: "New comment text (markdown supported)",
      },
    },
    required: ["commentId", "text"],
  },
  handler: async (params: { commentId: string; text: string }) => {
    try {
      const comment = await updateComment(params.commentId, {
        text: params.text,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                comment: {
                  id: comment.id,
                  text: comment.text,
                },
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
 * Tool: planka_delete_comment
 * Delete a comment.
 */
export const deleteCommentTool = {
  name: "planka_delete_comment",
  description: "Permanently delete a comment.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      commentId: {
        type: "string",
        description: "The comment ID to delete",
      },
    },
    required: ["commentId"],
  },
  handler: async (params: { commentId: string }) => {
    try {
      await deleteComment(params.commentId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `Comment ${params.commentId} deleted`,
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

export const commentTools = [
  addCommentTool,
  getCommentsTool,
  updateCommentTool,
  deleteCommentTool,
];
