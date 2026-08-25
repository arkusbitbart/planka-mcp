/**
 * Navigation tools for PLANKA MCP server.
 */
import { getStructure } from "../operations/projects.js";
import { getBoardWithTaskCounts } from "../operations/boards.js";
import { getListDetails } from "../operations/lists.js";
import { PlankaError } from "../errors.js";

/** Truncate long card descriptions for overview output (b9). */
function truncateDescription(description: string): string {
  return description.length > 100
    ? description.substring(0, 100) +
        "… [truncated — planka_get_card returns the full description]"
    : description;
}

/**
 * Tool: planka_get_structure
 * Get the full project/board/list hierarchy.
 */
export const getStructureTool = {
  name: "planka_get_structure",
  description:
    "Get the project/board structure in a single request. Use this to understand what projects and boards exist. Set includeLists=true to also fetch each board's lists (one extra request per board); planka_get_board also returns a single board's lists.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      projectId: {
        type: "string",
        description: "Optional: Get structure for a specific project only",
      },
      includeLists: {
        type: "boolean",
        description:
          "Also include each board's lists (default false; costs one extra request per board)",
        default: false,
      },
    },
  },
  handler: async (params: { projectId?: string; includeLists?: boolean }) => {
    const includeLists = params.includeLists === true;
    const structure = await getStructure(params.projectId, includeLists);

    // Format for readability
    const formatted = structure.map((project) => ({
      project: {
        id: project.project.id,
        name: project.project.name,
      },
      boards: project.boards.map((b) => ({
        id: b.board.id,
        name: b.board.name,
        ...(includeLists && {
          lists: b.lists
            .filter((l) => l.name !== null) // Filter out archive/trash
            .map((l) => ({
              id: l.id,
              name: l.name,
            })),
        }),
      })),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(formatted, null, 2),
        },
      ],
    };
  },
};

/**
 * Tool: planka_get_board
 * Get a board with all its lists, cards, and labels.
 */
export const getBoardTool = {
  name: "planka_get_board",
  description:
    "Get a board with all its lists, cards, and labels. Use this to see everything on a board. On large boards, pass listId to load only one list's cards (note: labels then appear as IDs, since the list endpoint carries no label metadata).",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      boardId: {
        type: "string",
        description: "The board ID",
      },
      listId: {
        type: "string",
        description:
          "Optional: only load this list's cards (uses GET /lists/{id} instead of the full board)",
      },
      includeTaskCounts: {
        type: "boolean",
        description: "Include task completion counts for each card",
        default: true,
      },
    },
    required: ["boardId"],
  },
  handler: async (params: {
    boardId: string;
    listId?: string;
    includeTaskCounts?: boolean;
  }) => {
    if (params.listId) {
      return getSingleListView(params.listId, params.includeTaskCounts);
    }

    const details = await getBoardWithTaskCounts(params.boardId);

    // Group cards by list for readability
    const cardsByList = new Map<string, typeof details.cards>();
    for (const card of details.cards) {
      const listCards = cardsByList.get(card.listId) || [];
      listCards.push(card);
      cardsByList.set(card.listId, listCards);
    }

    // Build label lookup
    const labelById = new Map(details.labels.map((l) => [l.id, l]));

    // Build card-label lookup
    const labelsByCard = new Map<string, string[]>();
    for (const cl of details.cardLabels) {
      const labels = labelsByCard.get(cl.cardId) || [];
      const label = labelById.get(cl.labelId);
      if (label) {
        labels.push(label.name || label.color);
      }
      labelsByCard.set(cl.cardId, labels);
    }

    // Build card-assignee lookup (names only; userIds via planka_get_board_members)
    const userById = new Map(details.users.map((u) => [u.id, u]));
    const assigneesByCard = new Map<string, string[]>();
    for (const cm of details.cardMemberships) {
      const assignees = assigneesByCard.get(cm.cardId) || [];
      assignees.push(userById.get(cm.userId)?.name ?? "(unknown user)");
      assigneesByCard.set(cm.cardId, assignees);
    }

    const formatted = {
      board: {
        id: details.board.id,
        name: details.board.name,
      },
      labels: details.labels.map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      })),
      lists: details.lists
        .filter((l) => l.name !== null) // Filter archive/trash
        .map((list) => {
          const listCards = (cardsByList.get(list.id) || []).sort(
            (a, b) => a.position - b.position
          );
          return {
            id: list.id,
            name: list.name,
            cards: listCards.map((card) => {
              const cardData: Record<string, unknown> = {
                id: card.id,
                name: card.name,
              };

              if (card.description) {
                cardData.description = truncateDescription(card.description);
              }

              if (card.dueDate) {
                cardData.dueDate = card.dueDate;
              }

              if (card.isCompleted) {
                cardData.isCompleted = card.isCompleted;
              }

              const cardLabels = labelsByCard.get(card.id);
              if (cardLabels && cardLabels.length > 0) {
                cardData.labels = cardLabels;
              }

              const assignees = assigneesByCard.get(card.id);
              if (assignees && assignees.length > 0) {
                cardData.assignees = assignees;
              }

              if (params.includeTaskCounts !== false && card.taskCount > 0) {
                cardData.tasks = `${card.completedTaskCount}/${card.taskCount}`;
              }

              return cardData;
            }),
          };
        }),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(formatted, null, 2),
        },
      ],
    };
  },
};

/**
 * Single-list view for planka_get_board with listId set.
 * Uses GET /lists/{id}; label metadata is not included there, so labels
 * are reported as IDs.
 */
async function getSingleListView(listId: string, includeTaskCounts?: boolean) {
  try {
    const details = await getListDetails(listId);

    const userById = new Map(details.users.map((u) => [u.id, u]));
    const assigneesByCard = new Map<string, string[]>();
    for (const cm of details.cardMemberships) {
      const assignees = assigneesByCard.get(cm.cardId) || [];
      assignees.push(userById.get(cm.userId)?.name ?? "(unknown user)");
      assigneesByCard.set(cm.cardId, assignees);
    }

    const labelIdsByCard = new Map<string, string[]>();
    for (const cl of details.cardLabels) {
      const labelIds = labelIdsByCard.get(cl.cardId) || [];
      labelIds.push(cl.labelId);
      labelIdsByCard.set(cl.cardId, labelIds);
    }

    // Task counts: tasks belong to taskLists, taskLists to cards
    const taskListToCard = new Map(
      details.taskLists.map((tl) => [tl.id, tl.cardId])
    );
    const taskCountsByCard = new Map<string, { total: number; completed: number }>();
    for (const task of details.tasks) {
      const cardId = taskListToCard.get(task.taskListId);
      if (!cardId) continue;
      const counts = taskCountsByCard.get(cardId) || { total: 0, completed: 0 };
      counts.total++;
      if (task.isCompleted) counts.completed++;
      taskCountsByCard.set(cardId, counts);
    }

    const formatted = {
      list: {
        id: details.list.id,
        name: details.list.name,
        boardId: details.list.boardId,
      },
      note: "Labels are shown as IDs in list view; call planka_get_board without listId for label names.",
      cards: details.cards.map((card) => {
        const cardData: Record<string, unknown> = {
          id: card.id,
          name: card.name,
        };

        if (card.description) {
          cardData.description = truncateDescription(card.description);
        }
        if (card.dueDate) {
          cardData.dueDate = card.dueDate;
        }
        if (card.isCompleted) {
          cardData.isCompleted = card.isCompleted;
        }

        const labelIds = labelIdsByCard.get(card.id);
        if (labelIds && labelIds.length > 0) {
          cardData.labelIds = labelIds;
        }

        const assignees = assigneesByCard.get(card.id);
        if (assignees && assignees.length > 0) {
          cardData.assignees = assignees;
        }

        if (includeTaskCounts !== false) {
          const counts = taskCountsByCard.get(card.id);
          if (counts && counts.total > 0) {
            cardData.tasks = `${counts.completed}/${counts.total}`;
          }
        }

        return cardData;
      }),
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(formatted, null, 2),
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
}

export const navigationTools = [getStructureTool, getBoardTool];
