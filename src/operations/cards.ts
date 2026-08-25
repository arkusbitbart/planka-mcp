/**
 * Card operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import {
  Card,
  TaskList,
  Task,
  Label,
  CardLabel,
  Attachment,
  CardMembership,
  User,
} from "../schemas/entities.js";
import {
  CreateCardSchema,
  UpdateCardSchema,
  MoveCardSchema,
  DuplicateCardSchema,
  CreateCardInput,
  UpdateCardInput,
  MoveCardInput,
  DuplicateCardInput,
} from "../schemas/requests.js";
import {
  CardResponse,
  CardIncludedSchema,
  ListIncludedSchema,
} from "../schemas/responses.js";

/** PLANKA's standard position gap; also the historical default for new cards. */
export const DEFAULT_CARD_POSITION = 65536;

/** Position for a new card: named slot or explicit numeric position. */
export type CardPosition = "top" | "bottom" | number;

/**
 * Resolves a card position to a number.
 * "top" -> half the first card's position, "bottom" -> after the last card
 * (each one extra GET /lists/{id}); numbers pass through; undefined keeps
 * the historical default of 65536.
 *
 * Positions are numbers with minimum 0 (per the OpenAPI spec); fractions
 * are fine — the server repositions cards when gaps get too small
 * (server/api/helpers/utils/insert-to-positionables.js). Edge case: if the
 * first card sits exactly at position 0, no position strictly before it
 * exists and the server slots the new card right after it.
 */
export async function resolveListPosition(
  listId: string,
  position?: CardPosition
): Promise<number> {
  if (position === undefined) return DEFAULT_CARD_POSITION;
  if (typeof position === "number") return position;

  const response = await plankaClient.get<unknown>(`/api/lists/${listId}`);
  const included = ListIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );
  const positions = (included.cards || []).map((card) => card.position);
  if (positions.length === 0) return DEFAULT_CARD_POSITION;

  if (position === "top") {
    return Math.min(...positions) / 2;
  }
  return Math.max(...positions) + DEFAULT_CARD_POSITION;
}

/**
 * Card details with all related entities.
 */
// Note: comments are NOT included in GET /cards/{id}; they come from the
// dedicated GET /cards/{cardId}/comments endpoint (operations/comments.ts).
export interface CardDetails {
  card: Card;
  taskLists: TaskList[];
  tasks: Task[];
  labels: Label[];
  cardLabels: CardLabel[];
  attachments: Attachment[];
  cardMemberships: CardMembership[];
  users: User[];
}

/**
 * Create a new card in a list.
 */
export async function createCard(input: CreateCardInput): Promise<Card> {
  const validated = CreateCardSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/lists/${validated.listId}/cards`,
    {
      name: validated.name,
      description: validated.description,
      position: validated.position,
      type: validated.type, // Required for PLANKA 2.0
      dueDate: validated.dueDate,
    }
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Get a card by ID with all related entities.
 */
export async function getCard(cardId: string): Promise<CardDetails> {
  const response = await plankaClient.get<unknown>(`/api/cards/${cardId}`);
  const parsed = CardResponse.parse(response);
  const included = CardIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );

  return {
    card: parsed.item,
    taskLists: (included.taskLists || []).sort((a, b) => a.position - b.position),
    tasks: (included.tasks || []).sort((a, b) => a.position - b.position),
    labels: included.labels || [],
    cardLabels: included.cardLabels || [],
    attachments: included.attachments || [],
    cardMemberships: included.cardMemberships || [],
    users: included.users || [],
  };
}

/**
 * Update a card's properties.
 */
export async function updateCard(
  cardId: string,
  input: UpdateCardInput
): Promise<Card> {
  const validated = UpdateCardSchema.parse(input);

  const response = await plankaClient.patch<unknown>(
    `/api/cards/${cardId}`,
    validated
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Move a card to a different list/position.
 */
export async function moveCard(input: MoveCardInput): Promise<Card> {
  const validated = MoveCardSchema.parse(input);

  const updatePayload: Record<string, unknown> = {
    listId: validated.listId,
    position: validated.position,
  };

  if (validated.boardId) {
    updatePayload.boardId = validated.boardId;
  }

  const response = await plankaClient.patch<unknown>(
    `/api/cards/${validated.cardId}`,
    updatePayload
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a card.
 */
export async function deleteCard(cardId: string): Promise<void> {
  await plankaClient.delete(`/api/cards/${cardId}`);
}

/**
 * Duplicate a card.
 * POST /cards/{id}/duplicate — copies the card including its content;
 * optional overrides for name and target list. position is always sent:
 * live instances require it ("Position must be present") even though the
 * spec marks nothing as required for this endpoint.
 */
export async function duplicateCard(input: DuplicateCardInput): Promise<Card> {
  const validated = DuplicateCardSchema.parse(input);

  const body: Record<string, unknown> = { position: validated.position };
  if (validated.name !== undefined) body.name = validated.name;
  if (validated.listId !== undefined) body.listId = validated.listId;

  const response = await plankaClient.post<unknown>(
    `/api/cards/${validated.cardId}/duplicate`,
    body
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}
