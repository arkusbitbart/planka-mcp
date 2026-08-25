/**
 * Request body schemas for PLANKA API operations.
 */
import { z } from "zod";
import {
  CardTypeSchema,
  LabelColorSchema,
  ListTypeSchema,
  ListColorSchema,
} from "./entities.js";

// Tool input schemas avoid JSON Schema unions (clients mangle them), so
// the server parses leniently instead: the server knows what it wants,
// the client guesses.

/** Accepts "true"/"false" strings alongside real booleans. */
const lenientBoolean = z.preprocess(
  (v) => (v === "true" ? true : v === "false" ? false : v),
  z.boolean()
);

/** Accepts numeric strings alongside real numbers. */
const lenientNumber = z.preprocess(
  (v) =>
    typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : v,
  z.number()
);

/** Clients that cannot express null send "" instead. */
const emptyToNull = (v: unknown) => (v === "" ? null : v);

/** For ID/date fields, "" and "none" both mean null. */
const noneToNull = (v: unknown) => (v === "" || v === "none" ? null : v);

// Card requests
export const CreateCardSchema = z.object({
  listId: z.string(),
  name: z.string().min(1, "Card name required"),
  description: z.string().optional(),
  position: lenientNumber.optional().default(65536),
  type: CardTypeSchema.optional().default("project"), // Required for PLANKA 2.0
  dueDate: z.string().optional(),
});
export type CreateCardInput = z.input<typeof CreateCardSchema>;

export const UpdateCardSchema = z.object({
  name: z.string().min(1).optional(),
  // "" clears the description (clients cannot express null)
  description: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  // "" or "none" clears the due date
  dueDate: z.preprocess(noneToNull, z.string().nullable()).optional(),
  // Per spec the PATCH field is isDueCompleted (there is no isCompleted)
  isDueCompleted: z
    .preprocess(
      (v) => (v === "true" ? true : v === "false" ? false : v),
      z.boolean().nullable()
    )
    .optional(),
  stopwatch: z
    .object({
      startedAt: z.string().nullable(),
      total: z.number(),
    })
    .nullable()
    .optional(),
  listId: z.string().optional(), // For moving cards
  boardId: z.string().optional(), // For moving across boards
  position: lenientNumber.optional(),
});
export type UpdateCardInput = z.input<typeof UpdateCardSchema>;

export const MoveCardSchema = z.object({
  cardId: z.string(),
  listId: z.string(),
  position: lenientNumber.optional().default(65536),
  boardId: z.string().optional(),
});
export type MoveCardInput = z.input<typeof MoveCardSchema>;

// Task requests
export const CreateTaskSchema = z.object({
  cardId: z.string(),
  name: z.string().min(1, "Task name required"),
  position: lenientNumber.optional().default(65536),
});
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  isCompleted: lenientBoolean.optional(),
  position: lenientNumber.optional(),
  // "" or "none" unassigns
  assigneeUserId: z.preprocess(noneToNull, z.string().nullable()).optional(),
});
export type UpdateTaskInput = z.input<typeof UpdateTaskSchema>;

export const UpdateTaskListSchema = z.object({
  name: z.string().min(1).optional(),
  position: lenientNumber.optional(),
  showOnFrontOfCard: lenientBoolean.optional(),
  hideCompletedTasks: lenientBoolean.optional(),
});
export type UpdateTaskListInput = z.input<typeof UpdateTaskListSchema>;

export const BatchCreateTasksSchema = z.object({
  cardId: z.string(),
  tasks: z.array(
    z.object({
      name: z.string().min(1),
      position: lenientNumber.optional(),
    })
  ),
});
export type BatchCreateTasksInput = z.input<typeof BatchCreateTasksSchema>;

// Label requests
export const CreateLabelSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1, "Label name required"),
  color: LabelColorSchema,
  position: lenientNumber.optional().default(65536),
});
export type CreateLabelInput = z.input<typeof CreateLabelSchema>;

export const UpdateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  color: LabelColorSchema.optional(),
  position: lenientNumber.optional(),
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

// Card duplication.
// position looks optional in the spec (no required array there), but a live
// PLANKA 2.2.1 rejects the request with "Position must be present" — so it
// always gets the standard default.
export const DuplicateCardSchema = z.object({
  cardId: z.string(),
  name: z.string().min(1).optional(),
  listId: z.string().optional(),
  position: lenientNumber.optional().default(65536),
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

// Project requests
export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name required"),
  type: z.enum(["private", "shared"]).optional().default("private"),
  description: z.string().optional(),
});
export type CreateProjectInput = z.input<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});
export type UpdateProjectInput = z.input<typeof UpdateProjectSchema>;

// Board requests
export const CreateBoardSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1, "Board name required").max(128),
  position: lenientNumber.optional().default(65536),
});
export type CreateBoardInput = z.input<typeof CreateBoardSchema>;

export const UpdateBoardSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  position: lenientNumber.optional(),
});
export type UpdateBoardInput = z.input<typeof UpdateBoardSchema>;

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
// POST /boards/{boardId}/lists requires type, position, and name
export const CreateListSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1, "List name required"),
  type: ListTypeSchema.optional().default("active"),
  position: lenientNumber.optional().default(65536),
});
export type CreateListInput = z.input<typeof CreateListSchema>;

export const UpdateListSchema = z.object({
  name: z.string().min(1).optional(),
  position: lenientNumber.optional(),
  type: ListTypeSchema.optional(),
  color: ListColorSchema.nullable().optional(),
  boardId: z.string().optional(),
});
export type UpdateListInput = z.input<typeof UpdateListSchema>;
