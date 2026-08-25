/**
 * Comment operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import { Comment, User } from "../schemas/entities.js";
import {
  CreateCommentSchema,
  UpdateCommentSchema,
  CreateCommentInput,
  UpdateCommentInput,
} from "../schemas/requests.js";
import {
  CommentResponse,
  CommentsResponse,
  UsersIncludedSchema,
} from "../schemas/responses.js";

/**
 * Add a comment to a card.
 */
export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const validated = CreateCommentSchema.parse(input);

  const response = await plankaClient.post<unknown>(
    `/api/cards/${validated.cardId}/comments`,
    {
      text: validated.text,
    }
  );

  const parsed = CommentResponse.parse(response);
  return parsed.item;
}

/**
 * Update a comment's text.
 */
export async function updateComment(
  commentId: string,
  input: UpdateCommentInput
): Promise<Comment> {
  const validated = UpdateCommentSchema.parse(input);

  const response = await plankaClient.patch<unknown>(
    `/api/comments/${commentId}`,
    validated
  );

  const parsed = CommentResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a comment.
 */
export async function deleteComment(commentId: string): Promise<void> {
  await plankaClient.delete(`/api/comments/${commentId}`);
}

/**
 * A page of comments with the users needed to resolve author names.
 */
export interface CommentsPage {
  comments: Comment[];
  users: User[];
}

/**
 * Get comments for a card.
 * GET /cards/{cardId}/comments — comments are NOT part of the card detail
 * response's included data; this dedicated endpoint returns them as items
 * (recent first) with the authors under included.users. Paginated via
 * beforeId.
 */
export async function getCommentsForCard(
  cardId: string,
  beforeId?: string
): Promise<CommentsPage> {
  const query = beforeId ? `?beforeId=${encodeURIComponent(beforeId)}` : "";
  const response = await plankaClient.get<unknown>(
    `/api/cards/${cardId}/comments${query}`
  );
  const parsed = CommentsResponse.parse(response);
  const included = UsersIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );
  return { comments: parsed.items, users: included.users || [] };
}
