/**
 * Core entity schemas for PLANKA 2.0
 * All types are derived from these Zod schemas.
 */
import { z } from "zod";

// Card type enum - required for PLANKA 2.0
export const CardTypeSchema = z.enum(["project", "story"]);
export type CardType = z.infer<typeof CardTypeSchema>;

// Label colors - all valid PLANKA 2.0 colors
export const LabelColorSchema = z.enum([
  "berry-red",
  "pumpkin-orange",
  "lagoon-blue",
  "pink-tulip",
  "light-mud",
  "orange-peel",
  "bright-moss",
  "antique-blue",
  "dark-granite",
  "lagune-blue",
  "sunny-grass",
  "morning-sky",
  "light-orange",
  "midnight-blue",
  "tank-green",
  "gun-metal",
  "wet-moss",
  "red-burgundy",
  "light-concrete",
  "apricot-red",
  "desert-sand",
  "navy-blue",
  "egg-yellow",
  "coral-green",
  "light-cocoa",
  "modern-green",
  "piggy-red",
]);
export type LabelColor = z.infer<typeof LabelColorSchema>;

// List types - PLANKA 2.x (archive/trash are system lists, not creatable)
export const ListTypeSchema = z.enum(["active", "closed"]);
export type ListType = z.infer<typeof ListTypeSchema>;

// List colors - distinct from label colors
export const ListColorSchema = z.enum([
  "berry-red",
  "pumpkin-orange",
  "lagoon-blue",
  "pink-tulip",
  "light-mud",
  "orange-peel",
  "bright-moss",
  "antique-blue",
  "dark-granite",
  "turquoise-sea",
]);
export type ListColor = z.infer<typeof ListColorSchema>;

// User schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  // Per the OpenAPI spec, user timestamps can be null
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type User = z.infer<typeof UserSchema>;

// Project schema
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  background: z.string().nullable().optional(),
  backgroundImage: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// Board schema
export const BoardSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  position: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Board = z.infer<typeof BoardSchema>;

// List schema
export const ListSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  name: z.string().nullable(), // Can be null for archive/trash
  position: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type List = z.infer<typeof ListSchema>;

// Card schema
export const CardSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  listId: z.string(),
  creatorUserId: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  position: z.number(),
  type: CardTypeSchema,
  dueDate: z.string().nullable().optional(),
  isDueDateCompleted: z.boolean().optional(),
  isCompleted: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Card = z.infer<typeof CardSchema>;

// TaskList (checklist container) schema - PLANKA 2.0
export const TaskListSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  name: z.string(),
  position: z.number(),
  showOnFrontOfCard: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type TaskList = z.infer<typeof TaskListSchema>;

// Task (checklist item) schema - PLANKA 2.0 uses taskListId instead of cardId
export const TaskSchema = z.object({
  id: z.string(),
  taskListId: z.string(),
  name: z.string(),
  position: z.number(),
  isCompleted: z.boolean(),
  assigneeUserId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Task = z.infer<typeof TaskSchema>;

// Label schema
export const LabelSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  name: z.string().nullable(),
  color: LabelColorSchema,
  position: z.number(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Label = z.infer<typeof LabelSchema>;

// Card-Label relationship (junction table)
export const CardLabelSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  labelId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type CardLabel = z.infer<typeof CardLabelSchema>;

// Board membership schema (user's access to a board)
export const BoardMembershipSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  boardId: z.string(),
  userId: z.string(),
  role: z.enum(["editor", "viewer"]),
  canComment: z.boolean().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type BoardMembership = z.infer<typeof BoardMembershipSchema>;

// Card-Membership relationship (user assigned to a card)
export const CardMembershipSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  userId: z.string(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type CardMembership = z.infer<typeof CardMembershipSchema>;

// Comment schema
export const CommentSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  userId: z.string(),
  text: z.string(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Comment = z.infer<typeof CommentSchema>;

// Action (activity log entry) schema.
// The type enum in the spec is not exhaustive across versions, so type is
// kept as a plain string and data as a free-form object.
export const ActionSchema = z.object({
  id: z.string(),
  boardId: z.string().nullable().optional(),
  cardId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  type: z.string(),
  data: z.record(z.any()).nullable().optional(),
  createdAt: z.string().nullable().optional(),
});
export type Action = z.infer<typeof ActionSchema>;

// Notification schema
export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  creatorUserId: z.string().nullable().optional(),
  boardId: z.string().nullable().optional(),
  cardId: z.string().nullable().optional(),
  commentId: z.string().nullable().optional(),
  type: z.string(),
  data: z.record(z.any()).nullable().optional(),
  isRead: z.boolean(),
  createdAt: z.string().nullable().optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

// Attachment schema
export const AttachmentSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  creatorUserId: z.string().optional(),
  name: z.string(),
  url: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().nullable().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
