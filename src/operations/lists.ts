/**
 * List operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import {
  List,
  Card,
  User,
  CardMembership,
  CardLabel,
  TaskList,
  Task,
} from "../schemas/entities.js";
import { ListResponse, ListIncludedSchema } from "../schemas/responses.js";
import {
  CreateListSchema,
  UpdateListSchema,
  CreateListInput,
  UpdateListInput,
} from "../schemas/requests.js";

/**
 * Create a new list on a board.
 */
export async function createList(input: CreateListInput): Promise<List> {
  const validated = CreateListSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/boards/${validated.boardId}/lists`,
    {
      name: validated.name,
      position: validated.position,
    }
  );

  const parsed = ListResponse.parse(response);
  return parsed.item;
}

/**
 * Update a list's properties.
 */
export async function updateList(
  listId: string,
  input: UpdateListInput
): Promise<List> {
  const validated = UpdateListSchema.parse(input);

  const response = await plankaClient.patch<unknown>(
    `/api/lists/${listId}`,
    validated
  );

  const parsed = ListResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a list.
 */
export async function deleteList(listId: string): Promise<void> {
  await plankaClient.delete(`/api/lists/${listId}`);
}

/**
 * List details with the list's cards and related entities.
 * Note: GET /lists/{id} does not include label metadata (only the
 * cardLabels junction records), so label names are not available here.
 */
export interface ListDetails {
  list: List;
  cards: Card[];
  users: User[];
  cardMemberships: CardMembership[];
  cardLabels: CardLabel[];
  taskLists: TaskList[];
  tasks: Task[];
}

/**
 * Get a single list with its cards.
 * GET /lists/{id} — works for any list and avoids loading the whole board.
 */
export async function getListDetails(listId: string): Promise<ListDetails> {
  const response = await plankaClient.get<unknown>(`/api/lists/${listId}`);
  const parsed = ListResponse.parse(response);
  const included = ListIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );

  return {
    list: parsed.item,
    cards: (included.cards || []).sort((a, b) => a.position - b.position),
    users: included.users || [],
    cardMemberships: included.cardMemberships || [],
    cardLabels: included.cardLabels || [],
    taskLists: included.taskLists || [],
    tasks: included.tasks || [],
  };
}
