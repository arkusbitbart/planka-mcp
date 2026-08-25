/**
 * Activity (actions) and notification operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import { Action, Notification, User } from "../schemas/entities.js";
import {
  ActionsResponse,
  NotificationsResponse,
  UsersIncludedSchema,
} from "../schemas/responses.js";

export interface ActivityPage {
  actions: Action[];
  users: User[];
}

function parseActivity(response: unknown): ActivityPage {
  const parsed = ActionsResponse.parse(response);
  const included = UsersIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );
  return { actions: parsed.items, users: included.users || [] };
}

/**
 * Get the activity log of a card.
 * GET /cards/{cardId}/actions (paginated via beforeId).
 */
export async function getCardActivity(
  cardId: string,
  beforeId?: string
): Promise<ActivityPage> {
  const query = beforeId ? `?beforeId=${encodeURIComponent(beforeId)}` : "";
  const response = await plankaClient.get<unknown>(
    `/api/cards/${cardId}/actions${query}`
  );
  return parseActivity(response);
}

/**
 * Get the activity log of a board.
 * GET /boards/{boardId}/actions (paginated via beforeId).
 */
export async function getBoardActivity(
  boardId: string,
  beforeId?: string
): Promise<ActivityPage> {
  const query = beforeId ? `?beforeId=${encodeURIComponent(beforeId)}` : "";
  const response = await plankaClient.get<unknown>(
    `/api/boards/${boardId}/actions${query}`
  );
  return parseActivity(response);
}

/**
 * Builds a short human-readable summary for an action.
 * The data payload is polymorphic; unknown types fall back to the type name.
 */
export function summarizeAction(action: Action): string {
  const data = (action.data || {}) as Record<string, any>;
  const cardName = data.card?.name;
  const card = cardName ? `card "${cardName}"` : "a card";

  switch (action.type) {
    case "createCard":
      return `created ${card}${data.list?.name ? ` in "${data.list.name}"` : ""}`;
    case "moveCard":
      return `moved ${card}${data.fromList?.name ? ` from "${data.fromList.name}"` : ""}${data.toList?.name ? ` to "${data.toList.name}"` : ""}`;
    case "addMemberToCard":
      return `added ${data.user?.name ?? "a member"} to ${card}`;
    case "removeMemberFromCard":
      return `removed ${data.user?.name ?? "a member"} from ${card}`;
    case "completeTask":
      return `completed task${data.task?.name ? ` "${data.task.name}"` : ""} on ${card}`;
    case "uncompleteTask":
      return `reopened task${data.task?.name ? ` "${data.task.name}"` : ""} on ${card}`;
    case "commentCard":
      return `commented on ${card}${typeof data.text === "string" ? `: ${data.text.slice(0, 80)}` : ""}`;
    default:
      return `${action.type}${cardName ? ` (${card})` : ""}`;
  }
}

export interface NotificationsPage {
  notifications: Notification[];
  users: User[];
}

/**
 * Get the current user's notifications.
 * GET /notifications
 */
export async function getNotifications(): Promise<NotificationsPage> {
  const response = await plankaClient.get<unknown>("/api/notifications");
  const parsed = NotificationsResponse.parse(response);
  const included = UsersIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );
  return { notifications: parsed.items, users: included.users || [] };
}

/**
 * Mark all notifications as read.
 * POST /notifications/read-all
 */
export async function markAllNotificationsRead(): Promise<number> {
  const response = await plankaClient.post<unknown>(
    "/api/notifications/read-all",
    {}
  );
  const parsed = NotificationsResponse.parse(response);
  return parsed.items.length;
}

/**
 * Builds a short human-readable summary for a notification.
 */
export function summarizeNotification(notification: Notification): string {
  const data = (notification.data || {}) as Record<string, any>;
  const cardName = data.card?.name;
  const card = cardName ? `card "${cardName}"` : "a card";

  switch (notification.type) {
    case "moveCard":
      return `${card} was moved${data.toList?.name ? ` to "${data.toList.name}"` : ""}`;
    case "commentCard":
      return `new comment on ${card}${typeof data.text === "string" ? `: ${data.text.slice(0, 80)}` : ""}`;
    case "addMemberToCard":
      return `you were added to ${card}`;
    case "mentionInComment":
      return `you were mentioned on ${card}${typeof data.text === "string" ? `: ${data.text.slice(0, 80)}` : ""}`;
    default:
      return `${notification.type}${cardName ? ` (${card})` : ""}`;
  }
}
