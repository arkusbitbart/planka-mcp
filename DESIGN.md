> **⚠️ Historisches Dokument — nicht aktuell.**
> Dies ist das ursprüngliche Design-Dokument des Originalprojekts
> [gogogadgetbytes/planka-mcp](https://github.com/gogogadgetbytes/planka-mcp)
> (Stand v1.0.0: 15 Tools, nur E-Mail/Passwort-Authentifizierung). Der Fork
> [arkusbitbart/planka-mcp](https://github.com/arkusbitbart/planka-mcp) weicht
> inzwischen erheblich davon ab (32 Tools, API-Key-Auth, geänderte Schemas und
> Ausgabeformate). **Maßgeblich für den aktuellen Stand sind der Code in
> `src/` und die README** — dieses Dokument wird nicht gepflegt und dient nur
> noch als Architektur-Begründung des Originals.

# PLANKA MCP Server - Design Document

A clean-room MCP server for PLANKA 2.0, purpose-built for Claude agent workflows.

## Overview

### What We're Building

A Model Context Protocol (MCP) server that provides Claude agents with full access to PLANKA kanban boards. This is a clean-room implementation, not a fork of the existing kanban-mcp.

### Why Rewrite

The current kanban-mcp has accumulated patches for PLANKA 2.0 compatibility. A purpose-built implementation will be:
- ~700 lines vs ~5000 lines (simpler, maintainable)
- Type-safe with Zod schemas matching PLANKA's actual API
- Optimized for agent workflows (combined operations, sensible defaults)
- Well-documented for community release via gogogadgetbytes

### Target Version

PLANKA 2.0.0-rc.4 and later. Key 2.0 API differences are documented in the Appendix.

---

## Architecture

### File Structure

```
planka-mcp/
├── package.json
├── tsconfig.json
├── DESIGN.md            # This file
├── README.md            # User-facing docs
├── LOCAL_MODIFICATIONS.md  # Migration notes from kanban-mcp
├── src/
│   ├── index.ts         # MCP server setup and tool registration
│   ├── client.ts        # HTTP client with auth token management
│   ├── errors.ts        # Typed error classes
│   ├── schemas/
│   │   ├── entities.ts  # Core entity schemas (Project, Board, Card, etc.)
│   │   ├── requests.ts  # Request body schemas
│   │   └── responses.ts # API response schemas
│   ├── operations/
│   │   ├── projects.ts  # Project operations
│   │   ├── boards.ts    # Board operations
│   │   ├── lists.ts     # List operations
│   │   ├── cards.ts     # Card operations
│   │   ├── tasks.ts     # Task (checklist) operations
│   │   ├── labels.ts    # Label operations
│   │   └── comments.ts  # Comment operations
│   └── tools/
│       ├── index.ts     # Tool registry
│       ├── navigation.ts    # planka_get_structure, planka_get_board
│       ├── cards.ts         # Card CRUD tools
│       ├── tasks.ts         # Task tools
│       ├── labels.ts        # Label tools
│       ├── comments.ts      # Comment tools
│       └── lists.ts         # List tools
└── tests/
    ├── unit/
    └── integration/
```

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

---

## API Reference

### Base URL

`${PLANKA_BASE_URL}/api`

### Authentication

POST `/api/access-tokens` with `{ emailOrUsername, password }` returns JWT token.
All subsequent requests include `Authorization: Bearer <token>`.

### Endpoints Used

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/access-tokens` | Authenticate and get JWT |
| GET | `/projects` | List all projects with boards |
| GET | `/projects/:id` | Get project details |
| GET | `/boards/:id` | Get board with lists, cards, labels |
| POST | `/lists/:listId/cards` | Create card |
| GET | `/cards/:id` | Get card details |
| PATCH | `/cards/:id` | Update card |
| DELETE | `/cards/:id` | Delete card |
| POST | `/cards/:cardId/tasks` | Create task |
| PATCH | `/tasks/:id` | Update task |
| DELETE | `/tasks/:id` | Delete task |
| POST | `/boards/:boardId/labels` | Create label |
| PATCH | `/labels/:id` | Update label |
| DELETE | `/labels/:id` | Delete label |
| POST | `/cards/:cardId/card-labels` | Add label to card (2.0) |
| DELETE | `/cards/:cardId/card-labels/:cardLabelId` | Remove label (2.0) |
| POST | `/cards/:cardId/comments` | Add comment |
| PATCH | `/comments/:id` | Update comment |
| DELETE | `/comments/:id` | Delete comment |
| POST | `/boards/:boardId/lists` | Create list |
| PATCH | `/lists/:id` | Update list |
| DELETE | `/lists/:id` | Delete list |

---

## Type Definitions

### Entity Schemas

```typescript
// src/schemas/entities.ts
import { z } from "zod";

// Card type enum - required for PLANKA 2.0
export const CardTypeSchema = z.enum(["project", "story"]);
export type CardType = z.infer<typeof CardTypeSchema>;

// Label colors - all 25 valid PLANKA colors
export const LabelColorSchema = z.enum([
  "berry-red", "pumpkin-orange", "lagoon-blue", "pink-tulip", "light-mud",
  "orange-peel", "bright-moss", "antique-blue", "dark-granite", "lagune-blue",
  "sunny-grass", "morning-sky", "light-orange", "midnight-blue", "tank-green",
  "gun-metal", "wet-moss", "red-burgundy", "light-concrete", "apricot-red",
  "desert-sand", "navy-blue", "egg-yellow", "coral-green", "light-cocoa"
]);
export type LabelColor = z.infer<typeof LabelColorSchema>;

// User schema
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  username: z.string().optional(),
  name: z.string(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
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
  name: z.string().nullable(),  // Can be null for archive/trash
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

// Task (checklist item) schema
export const TaskSchema = z.object({
  id: z.string(),
  cardId: z.string(),
  name: z.string(),
  position: z.number(),
  isCompleted: z.boolean(),
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
```

### Request Schemas

```typescript
// src/schemas/requests.ts
import { z } from "zod";
import { CardTypeSchema, LabelColorSchema } from "./entities.js";

// Card requests
export const CreateCardSchema = z.object({
  listId: z.string(),
  name: z.string().min(1, "Card name required"),
  description: z.string().optional(),
  position: z.number().default(65536),
  type: CardTypeSchema.default("project"),  // Required for PLANKA 2.0
  dueDate: z.string().optional(),
});

export const UpdateCardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
  listId: z.string().optional(),  // For moving cards
  boardId: z.string().optional(),  // For moving across boards
});

export const MoveCardSchema = z.object({
  cardId: z.string(),
  listId: z.string(),
  position: z.number().default(65536),
  boardId: z.string().optional(),
});

// Task requests
export const CreateTaskSchema = z.object({
  cardId: z.string(),
  name: z.string().min(1, "Task name required"),
  position: z.number().default(65536),
});

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
});

export const BatchCreateTasksSchema = z.object({
  cardId: z.string(),
  tasks: z.array(z.object({
    name: z.string().min(1),
    position: z.number().optional(),
  })),
});

// Label requests
export const CreateLabelSchema = z.object({
  boardId: z.string(),
  name: z.string().min(1, "Label name required"),
  color: LabelColorSchema,
  position: z.number().default(65536),
});

export const UpdateLabelSchema = z.object({
  name: z.string().min(1).optional(),
  color: LabelColorSchema.optional(),
  position: z.number().optional(),
});

export const AddLabelToCardSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
});

export const RemoveLabelFromCardSchema = z.object({
  cardId: z.string(),
  labelId: z.string(),
});

// Comment requests
export const CreateCommentSchema = z.object({
  cardId: z.string(),
  text: z.string().min(1, "Comment text required"),
});

export const UpdateCommentSchema = z.object({
  text: z.string().min(1),
});
```

### Response Schemas

```typescript
// src/schemas/responses.ts
import { z } from "zod";
import {
  ProjectSchema,
  BoardSchema,
  ListSchema,
  CardSchema,
  TaskSchema,
  LabelSchema,
  CommentSchema,
  UserSchema,
  CardLabelSchema,
  AttachmentSchema,
} from "./entities.js";

// Generic response wrappers
export const SingleItemResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    item: itemSchema,
    included: z.record(z.any()).optional(),
  });

export const MultiItemResponse = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    included: z.record(z.any()).optional(),
  });

// Specific response types
export const ProjectResponse = SingleItemResponse(ProjectSchema);
export const ProjectsResponse = MultiItemResponse(ProjectSchema);

export const BoardResponse = SingleItemResponse(BoardSchema);
export const BoardsResponse = MultiItemResponse(BoardSchema);

export const ListResponse = SingleItemResponse(ListSchema);
export const ListsResponse = MultiItemResponse(ListSchema);

export const CardResponse = SingleItemResponse(CardSchema);
export const CardsResponse = MultiItemResponse(CardSchema);

export const TaskResponse = SingleItemResponse(TaskSchema);
export const TasksResponse = MultiItemResponse(TaskSchema);

export const LabelResponse = SingleItemResponse(LabelSchema);
export const LabelsResponse = MultiItemResponse(LabelSchema);

export const CommentResponse = SingleItemResponse(CommentSchema);
export const CommentsResponse = MultiItemResponse(CommentSchema);

export const CardLabelResponse = SingleItemResponse(CardLabelSchema);

// Auth response
export const AuthResponse = z.object({
  item: z.string(),  // JWT token
});

// Included entities schema for board details
export const BoardIncludedSchema = z.object({
  lists: z.array(ListSchema).optional(),
  cards: z.array(CardSchema).optional(),
  labels: z.array(LabelSchema).optional(),
  cardLabels: z.array(CardLabelSchema).optional(),
  tasks: z.array(TaskSchema).optional(),
  users: z.array(UserSchema).optional(),
}).passthrough();  // Allow additional fields

// Included entities schema for card details
export const CardIncludedSchema = z.object({
  tasks: z.array(TaskSchema).optional(),
  comments: z.array(CommentSchema).optional(),
  labels: z.array(LabelSchema).optional(),
  cardLabels: z.array(CardLabelSchema).optional(),
  attachments: z.array(AttachmentSchema).optional(),
  users: z.array(UserSchema).optional(),
}).passthrough();

// Projects response includes boards
export const ProjectsIncludedSchema = z.object({
  boards: z.array(BoardSchema).optional(),
  users: z.array(UserSchema).optional(),
}).passthrough();
```

---

## Operations

Each operation module follows this pattern:
1. Import schemas and client
2. Define operation functions that call the client
3. Parse and validate responses
4. Return typed data or throw typed errors

### Example: Card Operations

```typescript
// src/operations/cards.ts
import { plankaClient } from "../client.js";
import { CardSchema, Card } from "../schemas/entities.js";
import { CreateCardSchema, UpdateCardSchema, MoveCardSchema } from "../schemas/requests.js";
import { CardResponse, CardIncludedSchema } from "../schemas/responses.js";
import { z } from "zod";

export type CreateCardInput = z.infer<typeof CreateCardSchema>;
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
export type MoveCardInput = z.infer<typeof MoveCardSchema>;

/**
 * Create a new card in a list
 */
export async function createCard(input: CreateCardInput): Promise<Card> {
  const validated = CreateCardSchema.parse(input);

  const response = await plankaClient.post(
    `/api/lists/${validated.listId}/cards`,
    {
      name: validated.name,
      description: validated.description,
      position: validated.position,
      type: validated.type,  // Required for PLANKA 2.0
      dueDate: validated.dueDate,
    }
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Get a card by ID with all related entities
 */
export async function getCard(cardId: string): Promise<{
  card: Card;
  included: z.infer<typeof CardIncludedSchema>;
}> {
  const response = await plankaClient.get(`/api/cards/${cardId}`);
  const parsed = CardResponse.parse(response);
  const included = CardIncludedSchema.parse(response.included || {});

  return {
    card: parsed.item,
    included,
  };
}

/**
 * Update a card's properties
 */
export async function updateCard(
  cardId: string,
  input: UpdateCardInput
): Promise<Card> {
  const validated = UpdateCardSchema.parse(input);

  const response = await plankaClient.patch(
    `/api/cards/${cardId}`,
    validated
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Move a card to a different list/position
 */
export async function moveCard(input: MoveCardInput): Promise<Card> {
  const validated = MoveCardSchema.parse(input);

  const response = await plankaClient.patch(
    `/api/cards/${validated.cardId}`,
    {
      listId: validated.listId,
      position: validated.position,
      boardId: validated.boardId,
    }
  );

  const parsed = CardResponse.parse(response);
  return parsed.item;
}

/**
 * Delete a card
 */
export async function deleteCard(cardId: string): Promise<void> {
  await plankaClient.delete(`/api/cards/${cardId}`);
}

/**
 * Get all cards in a board
 * (Cards are included in board response, not a separate endpoint)
 */
export async function getCardsForBoard(boardId: string): Promise<Card[]> {
  const response = await plankaClient.get(`/api/boards/${boardId}`);
  const included = response.included || {};

  if (!included.cards || !Array.isArray(included.cards)) {
    return [];
  }

  return z.array(CardSchema).parse(included.cards);
}

/**
 * Get all cards in a specific list
 */
export async function getCardsForList(
  boardId: string,
  listId: string
): Promise<Card[]> {
  const cards = await getCardsForBoard(boardId);
  return cards.filter(card => card.listId === listId);
}
```

---

## MCP Tool Definitions

Tools are the agent-facing interface. We optimize for:
- **Discoverability** - Clear names and descriptions
- **Efficiency** - Fewer tools that do more
- **Consistency** - Similar patterns across tools

### Tool Registry

```typescript
// src/tools/index.ts

// Navigation Tools
planka_get_structure      // Get projects, boards, lists hierarchy
planka_get_board          // Get board with all cards, lists, labels

// Card Tools
planka_create_card        // Create a card (with optional tasks)
planka_update_card        // Update card properties
planka_move_card          // Move card to different list/board
planka_delete_card        // Delete a card
planka_get_card           // Get card details with tasks/comments

// Task Tools
planka_create_tasks       // Create one or more tasks on a card
planka_update_task        // Update task (name, completion, position)
planka_delete_task        // Delete a task

// Label Tools
planka_manage_labels      // Create/update/delete board labels
planka_set_card_labels    // Add/remove labels from a card

// Comment Tools
planka_add_comment        // Add comment to a card
planka_get_comments       // Get comments on a card

// List Tools
planka_manage_lists       // Create/update/delete lists on a board
```

### Tool Definitions

#### Navigation Tools

```typescript
// planka_get_structure
{
  name: "planka_get_structure",
  description: "Get the full project/board/list structure. Use this to understand what projects and boards exist before working with cards.",
  parameters: z.object({
    projectId: z.string().optional().describe(
      "Optional: Get structure for a specific project only"
    ),
  }),
  returns: "Projects with their boards and lists",
}

// planka_get_board
{
  name: "planka_get_board",
  description: "Get a board with all its lists, cards, and labels. Use this to see everything on a board.",
  parameters: z.object({
    boardId: z.string().describe("The board ID"),
    includeTaskCounts: z.boolean().default(true).describe(
      "Include task completion counts for each card"
    ),
  }),
  returns: "Board details with lists, cards, and labels",
}
```

#### Card Tools

```typescript
// planka_create_card
{
  name: "planka_create_card",
  description: "Create a new card on a board. Optionally add tasks (checklist items) at the same time.",
  parameters: z.object({
    listId: z.string().describe("The list to create the card in"),
    name: z.string().describe("Card title"),
    description: z.string().optional().describe("Card description (markdown supported)"),
    tasks: z.array(z.string()).optional().describe(
      "Optional: Task names to add as a checklist"
    ),
    dueDate: z.string().optional().describe("Due date in ISO format"),
    labelIds: z.array(z.string()).optional().describe(
      "Optional: Label IDs to attach"
    ),
  }),
}

// planka_update_card
{
  name: "planka_update_card",
  description: "Update a card's properties (name, description, due date, completion status).",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
    name: z.string().optional().describe("New card title"),
    description: z.string().nullable().optional().describe(
      "New description (null to clear)"
    ),
    dueDate: z.string().nullable().optional().describe(
      "New due date (null to clear)"
    ),
    isCompleted: z.boolean().optional().describe("Mark card as complete/incomplete"),
  }),
}

// planka_move_card
{
  name: "planka_move_card",
  description: "Move a card to a different list or position. Use this for workflow transitions (e.g., 'To Do' -> 'In Progress').",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
    listId: z.string().describe("Target list ID"),
    position: z.number().optional().describe(
      "Position in the list (lower = higher). Default: end of list"
    ),
  }),
}

// planka_get_card
{
  name: "planka_get_card",
  description: "Get full details of a card including tasks, comments, labels, and attachments.",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
  }),
}

// planka_delete_card
{
  name: "planka_delete_card",
  description: "Permanently delete a card. This cannot be undone.",
  parameters: z.object({
    cardId: z.string().describe("The card ID to delete"),
  }),
}
```

#### Task Tools

```typescript
// planka_create_tasks
{
  name: "planka_create_tasks",
  description: "Add one or more tasks (checklist items) to a card.",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
    tasks: z.array(z.string()).min(1).describe("Task names to create"),
  }),
}

// planka_update_task
{
  name: "planka_update_task",
  description: "Update a task's name or completion status.",
  parameters: z.object({
    taskId: z.string().describe("The task ID"),
    name: z.string().optional().describe("New task name"),
    isCompleted: z.boolean().optional().describe("Mark as complete/incomplete"),
  }),
}

// planka_delete_task
{
  name: "planka_delete_task",
  description: "Delete a task from a card.",
  parameters: z.object({
    taskId: z.string().describe("The task ID to delete"),
  }),
}
```

#### Label Tools

```typescript
// planka_manage_labels
{
  name: "planka_manage_labels",
  description: "Create, update, or delete labels on a board.",
  parameters: z.object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    boardId: z.string().optional().describe("Board ID (required for create)"),
    labelId: z.string().optional().describe("Label ID (required for update/delete)"),
    name: z.string().optional().describe("Label name"),
    color: LabelColorSchema.optional().describe("Label color"),
  }),
}

// planka_set_card_labels
{
  name: "planka_set_card_labels",
  description: "Add or remove labels from a card.",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
    addLabelIds: z.array(z.string()).optional().describe("Label IDs to add"),
    removeLabelIds: z.array(z.string()).optional().describe("Label IDs to remove"),
  }),
}
```

#### Comment Tools

```typescript
// planka_add_comment
{
  name: "planka_add_comment",
  description: "Add a comment to a card. Use this for status updates, notes, or agent activity logs.",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
    text: z.string().describe("Comment text (markdown supported)"),
  }),
}

// planka_get_comments
{
  name: "planka_get_comments",
  description: "Get all comments on a card.",
  parameters: z.object({
    cardId: z.string().describe("The card ID"),
  }),
}
```

#### List Tools

```typescript
// planka_manage_lists
{
  name: "planka_manage_lists",
  description: "Create, update, or delete lists on a board.",
  parameters: z.object({
    action: z.enum(["create", "update", "delete"]).describe("Action to perform"),
    boardId: z.string().optional().describe("Board ID (required for create)"),
    listId: z.string().optional().describe("List ID (required for update/delete)"),
    name: z.string().optional().describe("List name"),
    position: z.number().optional().describe("List position"),
  }),
}
```

---

## Error Handling

### Error Types

```typescript
// src/errors.ts

export class PlankaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PlankaError";
  }
}

// Specific error classes
export class PlankaAuthError extends PlankaError {
  constructor(message = "Authentication failed") {
    super(message, "AUTH_FAILED", 401);
    this.name = "PlankaAuthError";
  }
}

export class PlankaNotFoundError extends PlankaError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404);
    this.name = "PlankaNotFoundError";
  }
}

export class PlankaValidationError extends PlankaError {
  constructor(message: string, details?: unknown) {
    super(message, "VALIDATION_ERROR", 422, details);
    this.name = "PlankaValidationError";
  }
}

export class PlankaPermissionError extends PlankaError {
  constructor(message = "Insufficient permissions") {
    super(message, "PERMISSION_DENIED", 403);
    this.name = "PlankaPermissionError";
  }
}

// Factory function
export function createPlankaError(status: number, body: unknown): PlankaError {
  const message = (body as any)?.message || "Unknown error";

  switch (status) {
    case 401:
      return new PlankaAuthError(message);
    case 403:
      return new PlankaPermissionError(message);
    case 404:
      return new PlankaNotFoundError("Resource", "unknown");
    case 422:
      return new PlankaValidationError(message, body);
    default:
      return new PlankaError(message, "API_ERROR", status, body);
  }
}
```

### Error Handling in Tools

Tools should catch errors and return meaningful messages:

```typescript
async function handleToolCall(params: unknown) {
  try {
    const result = await someOperation(params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    if (error instanceof PlankaNotFoundError) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
    if (error instanceof PlankaValidationError) {
      return {
        content: [{
          type: "text",
          text: `Validation error: ${error.message}\nDetails: ${JSON.stringify(error.details)}`
        }],
        isError: true,
      };
    }
    // Re-throw unexpected errors
    throw error;
  }
}
```

---

## Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `PLANKA_BASE_URL` | Yes | PLANKA server URL | `https://planka.example.com` |
| `PLANKA_AGENT_EMAIL` | Yes | Agent user email | `agent@example.com` |
| `PLANKA_AGENT_PASSWORD` | Yes | Agent user password | `secret` |

### MCP Configuration

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "planka": {
      "command": "node",
      "args": ["/path/to/planka-mcp/dist/index.js"],
      "env": {
        "PLANKA_BASE_URL": "https://planka.example.com",
        "PLANKA_AGENT_EMAIL": "claude@example.com",
        "PLANKA_AGENT_PASSWORD": "your-password"
      }
    }
  }
}
```

### Validation at Startup

```typescript
// src/client.ts

function validateConfig(): void {
  const required = [
    "PLANKA_BASE_URL",
    "PLANKA_AGENT_EMAIL",
    "PLANKA_AGENT_PASSWORD"
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
```

---

## Implementation Notes

### Patterns to Follow

1. **Validate early**: Use Zod schemas to validate all inputs before making API calls
2. **Parse responses**: Validate API responses to catch schema drift early
3. **Type everything**: Derive types from Zod schemas, don't duplicate
4. **Fail fast**: Throw typed errors rather than returning null/undefined
5. **Log sparingly**: Only log errors and important state changes

### Patterns to Avoid

1. **Don't cache tokens forever**: PLANKA tokens may expire
2. **Don't swallow errors**: Always propagate or handle explicitly
3. **Don't use `any`**: Use `unknown` and narrow with type guards
4. **Don't iterate all boards to find cards**: Use the included data in responses

### Position Values

PLANKA uses numeric positions for ordering. Convention:
- Start at `65536` (allows room for insertions)
- To insert between items at positions 1000 and 2000, use 1500
- To insert at the beginning, use `existingFirst / 2`
- To insert at the end, use `existingLast + 65536`

### PLANKA 2.0 Gotchas

1. **Card type is required**: Always include `type: "project"` when creating cards
2. **Label endpoints changed**: Use `/card-labels` not `/labels` for card-label operations
3. **Optional fields may be absent**: Use `.optional()` in schemas for fields that might not exist
4. **Archive lists have null names**: Handle `name: null` gracefully

---

## Testing Strategy

### Unit Tests

Mock the HTTP client and test:
- Schema validation
- Error handling
- Business logic in operations

### Integration Tests

Against a real PLANKA instance:
- Full CRUD cycles for each entity
- Error scenarios (not found, validation, auth)
- Cross-entity operations (create card with tasks)

### Test Environment

```bash
# Use a separate test project
PLANKA_TEST_PROJECT_ID=xxx npm test
```

---

## Appendix: PLANKA 2.0 API Diff

Reference from LOCAL_MODIFICATIONS.md:

| Operation | PLANKA 1.x | PLANKA 2.0 |
|-----------|------------|------------|
| Create card | No type field | Requires `type: "project"` or `"story"` |
| Add label to card | `POST /api/cards/{id}/labels` | `POST /api/cards/{id}/card-labels` |
| Remove label from card | `DELETE /api/cards/{id}/labels/{labelId}` | `DELETE /api/cards/{id}/card-labels/{labelId}` |
| Project background field | Always present (null if unset) | May be undefined (field absent) |
| Archive/trash list name | Present (null) | Present (null) |
| Archive/trash list position | Present (null) | Present (null) |
