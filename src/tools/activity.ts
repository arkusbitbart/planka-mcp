/**
 * Activity and notification tools for PLANKA MCP server.
 */
import {
  getCardActivity,
  getBoardActivity,
  summarizeAction,
  getNotifications,
  markAllNotificationsRead,
  summarizeNotification,
} from "../operations/activity.js";
import { PlankaError } from "../errors.js";

/**
 * Tool: planka_get_activity
 * Activity log of a card or a board, reduced to readable entries.
 */
export const getActivityTool = {
  name: "planka_get_activity",
  description:
    "Get the activity log of a card OR a board (recent first). Pass exactly one of cardId/boardId. For older entries, pass the beforeId returned by the previous call.",
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
        description: "Card ID to get activity for",
      },
      boardId: {
        type: "string",
        description: "Board ID to get activity for",
      },
      beforeId: {
        type: "string",
        description:
          "Pagination: only return actions older than this action ID",
      },
    },
  },
  handler: async (params: {
    cardId?: string;
    boardId?: string;
    beforeId?: string;
  }) => {
    if (!params.cardId === !params.boardId) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: Pass exactly one of cardId or boardId.",
          },
        ],
        isError: true,
      };
    }

    try {
      const page = params.cardId
        ? await getCardActivity(params.cardId, params.beforeId)
        : await getBoardActivity(params.boardId!, params.beforeId);

      const userById = new Map(page.users.map((u) => [u.id, u]));
      const entries = page.actions.map((action) => ({
        at: action.createdAt ?? null,
        user: action.userId
          ? (userById.get(action.userId)?.name ?? action.userId)
          : null,
        type: action.type,
        summary: summarizeAction(action),
        ...(params.boardId && action.cardId && { cardId: action.cardId }),
      }));

      const lastId = page.actions[page.actions.length - 1]?.id;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: entries.length,
                activity: entries,
                ...(lastId && {
                  beforeId: lastId,
                  note: "Pass beforeId to fetch older entries.",
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
 * Tool: planka_get_notifications
 * The agent user's notification inbox.
 */
export const getNotificationsTool = {
  name: "planka_get_notifications",
  description:
    "Get the agent user's notifications (mentions, comments, card moves, assignments). Use unreadOnly=true to see only new ones.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      unreadOnly: {
        type: "boolean",
        description: "Only return unread notifications (default false)",
        default: false,
      },
    },
  },
  handler: async (params: { unreadOnly?: boolean }) => {
    try {
      const page = await getNotifications();
      const userById = new Map(page.users.map((u) => [u.id, u]));

      const notifications = page.notifications
        .filter((n) => (params.unreadOnly ? !n.isRead : true))
        .map((n) => ({
          id: n.id,
          at: n.createdAt ?? null,
          isRead: n.isRead,
          type: n.type,
          from: n.creatorUserId
            ? (userById.get(n.creatorUserId)?.name ?? n.creatorUserId)
            : null,
          cardId: n.cardId ?? null,
          summary: summarizeNotification(n),
        }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                count: notifications.length,
                unreadCount: page.notifications.filter((n) => !n.isRead).length,
                notifications,
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
 * Tool: planka_mark_notifications_read
 * Mark all notifications as read.
 */
export const markNotificationsReadTool = {
  name: "planka_mark_notifications_read",
  description: "Mark all of the agent user's notifications as read.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
  handler: async () => {
    try {
      const count = await markAllNotificationsRead();

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                markedRead: count,
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

export const activityTools = [
  getActivityTool,
  getNotificationsTool,
  markNotificationsReadTool,
];
