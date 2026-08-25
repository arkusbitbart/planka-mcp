/**
 * Request body schemas for PLANKA API operations.
 */
import { z } from "zod";
import { CardTypeSchema, LabelColorSchema } from "./entities.js";

// Card requests
export const CreateCardSchema = z.object({
  listId: z.string(),
  name: z.string().min(1, "Card name required"),
  description: z.string().optional(),
  position: z.number().optional().default(65536),
  type: CardTypeSchema.optional().default("project"), // Required for PLANKA 2.0
  dueDate: z.string().optional(),
});
export type CreateCardInput = z.input<typeof CreateCardSchema>;

export const UpdateCardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  listId: z.string().optional(), // For moving cards
  boardId: z.string().optional(), // For moving across boards
  position: z.number().optional(),
});
export type UpdateCardInput = z.input<typeof UpdateCardSchema>;

export const MoveCardSchema = z.object({
  cardId: z.string(),
  listId: z.string(),
  position: z.number().optional().default(65536),
  boardId: z.string().optional(),
});
export type MoveCardInput = z.input<typeof MoveCardSchema>;

// Task requests
export const CreateTaskSchema = z.object({
  cardId: z.string(),
  name: z.string().min(1, "Task name required"),
  position: z.number().optional().default(65536),
});
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
  assigneeUserId: z.string().nullable().optional(),
});
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>;

export const UpdateTaskListSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().optional(),
  showOnFrontOfCard: z.boolean().optional(),
  hideCompletedTasks: z.boolean().optional(),
});
export type UpdateTaskListInput = z.input<typeof UpdateTaskListSchema>;

export const BatchCreateTasksSchema = z.object({
  cardId: z.string(),
  tasks: z.array(
    z.object({
      name: z.string().min(1),
      position: z.number().optional(),
    })
  ),
});
export type BatchCreateTasksInput = z.input<typeof BatchCreateTasksSchema>;

// Label requests
export const CreateLabelSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1, "Label name required"),
  color: LabelColorSchema,
  position: z.number().optional().default(65536),
});
export type CreateLabelInput = z.input<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  color: LabelColorSchema.optional(),
  position: z.number().optional(),
});
export type UpdateLabelInput = z.input<typeof UpdateLabelSchema>;

export const AddLabelToCardSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
});
export type AddLabelToCardInput = z.input<typeof AddLabelToCardSchema>;

export const RemoveLabelFromCardSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
});
export type RemoveLabelFromCardInput = z.input<typeof RemoveLabelFromCardSchema>;

// Card duplication
export const DuplicateCardSchema = z.object({
  cardId: z.string(),
  name: z.string().min(1).optional(),
  listId: z.string().optional(),
  position: z.number().optional(),
});
export type DuplicateCardInput = z.input<typeof DuplicateCardSchema>;

// List actions
export const SortListSchema = z.object({
  listId: z.string(),
  fieldName: z.enum(["name", "dueDate", "createdAt"]),
  order: z.enum(["asc", "desc"]).optional(),
});
export type SortListInput = z.input<typeof SortListSchema>;

export const MoveListCardsSchema = z.object({
  listId: z.string(),
  targetListId: z.string(),
});
export type MoveListCardsInput = z.input<typeof MoveListCardsSchema>;

// Card membership requests
export const AssignCardSchema = z.object({
  cardId: z.string(),
  userId: z.string(),
});
export type AssignCardInput = z.input<typeof AssignCardSchema>;

export const UnassignCardSchema = z.object({
  cardId: z.string(),
  userId: z.string(),
});
export type UnassignCardInput = z.input<typeof UnassignCardSchema>;

// Attachment requests
export const AddAttachmentSchema = z.object({
  cardId: z.string(),
  filePath: z.string().min(1, "filePath required"),
  name: z.string().max(128).optional(),
});
export type AddAttachmentInput = z.input<typeof AddAttachmentSchema>;

export const AddLinkAttachmentSchema = z.object({
  cardId: z.string(),
  url: z.string().url("url must be a valid URL").max(2048),
  name: z.string().max(128).optional(),
});
export type AddLinkAttachmentInput = z.input<typeof AddLinkAttachmentSchema>;

// Comment requests
export const CreateCommentSchema = z.object({
  cardId: z.string(),
  text: z.string().min(1, "Comment text required"),
});
export type CreateCommentInput = z.input<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  text: z.string().min(1),
});
export type UpdateCommentInput = z.input<typeof UpdateCommentSchema>;

// List requests
export const CreateListSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1, "List name required"),
  position: z.number().optional().default(65536),
});
export type CreateListInput = z.input<typeof CreateListSchema>;

export const UpdateListSchema = z.object({
  name: z.string().min(1).optional(),
  position: z.number().optional(),
});
export type UpdateListInput = z.input<typeof UpdateListSchema>;
