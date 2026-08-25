/**
 * Card membership operations for PLANKA API.
 *
 * PLANKA has no dedicated GET endpoint for memberships; board members and
 * card assignments come from GET /boards/{id} via the `included` part of
 * the response (users, boardMemberships, cardMemberships).
 */
import { plankaClient } from "../client.js";
import { CardMembership } from "../schemas/entities.js";
import {
  AssignCardSchema,
  UnassignCardSchema,
  AssignCardInput,
  UnassignCardInput,
} from "../schemas/requests.js";
import {
  BoardResponse,
  BoardIncludedSchema,
  CardMembershipResponse,
} from "../schemas/responses.js";
import { PlankaError } from "../errors.js";

/**
 * A board member with their board role.
 */
export interface BoardMember {
  userId: string;
  name: string;
  username?: string;
  email?: string;
  role: "editor" | "viewer";
  canComment: boolean | null;
}

/**
 * Get all members of a board (users with a board membership).
 * Uses GET /boards/{id} and joins included.users with included.boardMemberships.
 */
export async function getBoardMembers(boardId: string): Promise<BoardMember[]> {
  const response = await plankaClient.get<unknown>(`/api/boards/${boardId}`);
  BoardResponse.parse(response);
  const included = BoardIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );

  const userById = new Map((included.users || []).map((u) => [u.id, u]));

  return (included.boardMemberships || []).map((membership) => {
    const user = userById.get(membership.userId);
    return {
      userId: membership.userId,
      name: user?.name ?? "(unknown user)",
      username: user?.username ?? undefined,
      email: user?.email,
      role: membership.role,
      canComment: membership.canComment ?? null,
    };
  });
}

/**
 * Assign a user to a card.
 * POST /cards/{cardId}/card-memberships
 * A 409 Conflict (user already assigned) is treated as success.
 */
export async function assignCardMember(
  input: AssignCardInput
): Promise<{ membership: CardMembership | null; alreadyAssigned: boolean }> {
  const validated = AssignCardSchema.parse(input);

  try {
    const response = await plankaClient.post<unknown>(
      `/api/cards/${validated.cardId}/card-memberships`,
      { userId: validated.userId }
    );
    const parsed = CardMembershipResponse.parse(response);
    return { membership: parsed.item, alreadyAssigned: false };
  } catch (error) {
    if (error instanceof PlankaError && error.status === 409) {
      return { membership: null, alreadyAssigned: true };
    }
    throw error;
  }
}

/**
 * Remove a user from a card.
 * DELETE /cards/{cardId}/card-memberships/userId:{userId}
 * (PLANKA uses the literal "userId:" prefix in the path.)
 */
export async function unassignCardMember(
  input: UnassignCardInput
): Promise<void> {
  const validated = UnassignCardSchema.parse(input);

  await plankaClient.delete(
    `/api/cards/${validated.cardId}/card-memberships/userId:${validated.userId}`
  );
}
