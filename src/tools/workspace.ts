/**
 * Project and board management tools for PLANKA MCP server.
 * Project deletion is deliberately not exposed.
 */
import { createProject, updateProject } from "../operations/projects.js";
import {
  createBoard,
  updateBoard,
  deleteBoard,
} from "../operations/boards.js";
import { PlankaError } from "../errors.js";

const fail = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true,
});

/**
 * Tool: planka_manage_projects
 * Create or update projects (no delete).
 */
export const manageProjectsTool = {
  name: "planka_manage_projects",
  description:
    "Create a project or update its name/description. Deleting projects is intentionally not supported.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "update"],
        description: "Action to perform",
      },
      projectId: {
        type: "string",
        description: "Project ID (required for update)",
      },
      name: {
        type: "string",
        description: "Project name (required for create)",
      },
      type: {
        type: "string",
        enum: ["private", "shared"],
        description:
          'Project visibility (create only): "private" (default) or "shared"',
      },
      description: {
        type: "string",
        description: "Project description",
      },
    },
    required: ["action"],
  },
  handler: async (params: {
    action: "create" | "update";
    projectId?: string;
    name?: string;
    type?: "private" | "shared";
    description?: string;
  }) => {
    try {
      switch (params.action) {
        case "create": {
          if (!params.name)
            return fail("Error: name is required for create action");

          const project = await createProject({
            name: params.name,
            type: params.type,
            description: params.description,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    project: { id: project.id, name: project.name },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "update": {
          if (!params.projectId)
            return fail("Error: projectId is required for update action");

          const updates: Record<string, unknown> = {};
          if (params.name !== undefined) updates.name = params.name;
          if (params.description !== undefined)
            updates.description = params.description;

          const project = await updateProject(params.projectId, updates);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    project: { id: project.id, name: project.name },
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

/**
 * Tool: planka_manage_boards
 * Create, update, or delete boards.
 */
export const manageBoardsTool = {
  name: "planka_manage_boards",
  description:
    "Create a board in a project, rename/reposition a board, or delete a board (deleting removes all its lists and cards).",
  annotations: {
    readOnlyHint: false,
    destructiveHint: true, // the delete action removes the board with all content
    idempotentHint: false,
  },
  inputSchema: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "update", "delete"],
        description: "Action to perform",
      },
      projectId: {
        type: "string",
        description: "Project ID (required for create)",
      },
      boardId: {
        type: "string",
        description: "Board ID (required for update/delete)",
      },
      name: {
        type: "string",
        description: "Board name (required for create)",
      },
      position: {
        type: "number",
        description: "Numeric position within the project (default 65536)",
      },
    },
    required: ["action"],
  },
  handler: async (params: {
    action: "create" | "update" | "delete";
    projectId?: string;
    boardId?: string;
    name?: string;
    position?: number;
  }) => {
    try {
      switch (params.action) {
        case "create": {
          if (!params.projectId)
            return fail("Error: projectId is required for create action");
          if (!params.name)
            return fail("Error: name is required for create action");

          const board = await createBoard({
            projectId: params.projectId,
            name: params.name,
            position: params.position,
          });

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    board: {
                      id: board.id,
                      projectId: board.projectId,
                      name: board.name,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "update": {
          if (!params.boardId)
            return fail("Error: boardId is required for update action");

          const updates: Record<string, unknown> = {};
          if (params.name !== undefined) updates.name = params.name;
          if (params.position !== undefined) updates.position = params.position;

          const board = await updateBoard(params.boardId, updates);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    board: { id: board.id, name: board.name },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case "delete": {
          if (!params.boardId)
            return fail("Error: boardId is required for delete action");

          await deleteBoard(params.boardId);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: true,
                    message: `Board ${params.boardId} and all its content deleted`,
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

export const workspaceTools = [manageProjectsTool, manageBoardsTool];
