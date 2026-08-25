/**
 * Task tools for PLANKA MCP server.
 */
import {
  createTasks,
  updateTask,
  deleteTask,
  createTaskList,
  updateTaskList,
  deleteTaskList,
} from "../operations/tasks.js";
import { PlankaError } from "../errors.js";

/**
 * Tool: planka_create_tasks
 * Add one or more tasks (checklist items) to a card.
 */
export const createTasksTool = {
  name: "planka_create_tasks",
  description: "Add one or more tasks (checklist items) to a card.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      cardId: {
        type: "string",
        description: "The card ID",
      },
      tasks: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        description: "Task names to create",
      },
    },
    required: ["cardId", "tasks"],
  },
  handler: async (params: { cardId: string; tasks: string[] }) => {
    try {
      const tasks = await createTasks({
        cardId: params.cardId,
        tasks: params.tasks.map((name) => ({ name })),
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                tasksCreated: tasks.length,
                tasks: tasks.map((t) => ({
                  id: t.id,
                  name: t.name,
                  isCompleted: t.isCompleted,
                })),
              },
              null,
              2
            ),
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
  },
};

/**
 * Tool: planka_update_task
 * Update a task's name or completion status.
 */
export const updateTaskTool = {
  name: "planka_update_task",
  description:
    "Update a task's name, completion status, or assignee.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      taskId: {
        type: "string",
        description: "The task ID",
      },
      name: {
        type: "string",
        description: "New task name",
      },
      isCompleted: {
        type: "boolean",
        description: "Mark as complete/incomplete",
      },
      assigneeUserId: {
        type: ["string", "null"],
        description:
          "Assign the task to a board member (userId from planka_get_board_members); null to unassign",
      },
    },
    required: ["taskId"],
  },
  handler: async (params: {
    taskId: string;
    name?: string;
    isCompleted?: boolean;
    assigneeUserId?: string | null;
  }) => {
    try {
      const { taskId, ...updates } = params;

      // Only include defined fields
      const filteredUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) filteredUpdates.name = updates.name;
      if (updates.isCompleted !== undefined)
        filteredUpdates.isCompleted = updates.isCompleted;
      if (updates.assigneeUserId !== undefined)
        filteredUpdates.assigneeUserId = updates.assigneeUserId;

      const task = await updateTask(taskId, filteredUpdates);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                task: {
                  id: task.id,
                  name: task.name,
                  isCompleted: task.isCompleted,
                  assigneeUserId: task.assigneeUserId ?? null,
                },
              },
              null,
              2
            ),
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
  },
};

/**
 * Tool: planka_delete_task
 * Delete a task from a card.
 */
export const deleteTaskTool = {
  name: "planka_delete_task",
  description: "Delete a task from a card.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      taskId: {
        type: "string",
        description: "The task ID to delete",
      },
    },
    required: ["taskId"],
  },
  handler: async (params: { taskId: string }) => {
    try {
      await deleteTask(params.taskId);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                message: `Task ${params.taskId} deleted`,
              },
              null,
              2
            ),
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
  },
};

/**
 * Tool: planka_manage_task_lists
 * Create, rename, or delete task lists (checklists) on a card.
 */
export const manageTaskListsTool = {
  name: "planka_manage_task_lists",
  description:
    "Create, rename, or delete task lists (checklists) on a card. PLANKA supports multiple checklists per card; planka_create_tasks adds tasks to the first one. Task list IDs come from planka_get_card.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true, // the delete action removes the checklist and its tasks
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "rename", "delete"],
        description: "Action to perform",
      },
      cardId: {
        type: "string",
        description: "Card ID (required for create)",
      },
      taskListId: {
        type: "string",
        description: "Task list ID (required for rename/delete)",
      },
      name: {
        type: "string",
        description: "Task list name (required for create/rename)",
      },
      position: {
        type: "number",
        description: "Optional: numeric position (create only, default 65536)",
      },
    },
    required: ["action"],
  },
  handler: async (params: {
    action: "create" | "rename" | "delete";
    cardId?: string;
    taskListId?: string;
    name?: string;
    position?: number;
  }) => {
    const fail = (text: string) => ({
      content: [{ type: "text" as const, text }],
      isError: true,
    });

    try {
      switch (params.action) {
        case "create": {
          if (!params.cardId)
            return fail("Error: cardId is required for create action");
          if (!params.name)
            return fail("Error: name is required for create action");

          const taskList = await createTaskList(
            params.cardId,
            params.name,
            params.position
          );

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    taskList: {
                      id: taskList.id,
                      cardId: taskList.cardId,
                      name: taskList.name,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "rename": {
          if (!params.taskListId)
            return fail("Error: taskListId is required for rename action");
          if (!params.name)
            return fail("Error: name is required for rename action");

          const taskList = await updateTaskList(params.taskListId, {
            name: params.name,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    taskList: {
                      id: taskList.id,
                      name: taskList.name,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "delete": {
          if (!params.taskListId)
            return fail("Error: taskListId is required for delete action");

          await deleteTaskList(params.taskListId);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Task list ${params.taskListId} and its tasks deleted`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          return fail(`Error: Unknown action '${params.action}'`);
      }
    } catch (error) {
      if (error instanceof PlankaError) {
        return fail(`Error: ${error.message}`);
      }
      throw error;
    }
  },
};

export const taskTools = [
  createTasksTool,
  updateTaskTool,
  deleteTaskTool,
  manageTaskListsTool,
];
