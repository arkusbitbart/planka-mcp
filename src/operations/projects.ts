/**
 * Project operations for PLANKA API.
 */
import { plankaClient } from "../client.js";
import { Project, Board, List } from "../schemas/entities.js";
import { ProjectsResponse, ProjectsIncludedSchema } from "../schemas/responses.js";
import { getBoard } from "./boards.js";

/**
 * Full project structure with boards and (optionally) lists.
 */
export interface ProjectStructure {
  project: Project;
  boards: Array<{
    board: Board;
    lists: List[];
  }>;
}

/**
 * Get all projects with their boards.
 * GET /projects returns the boards in the included part, so this is a
 * single request.
 */
export async function getProjects(): Promise<{
  projects: Project[];
  boards: Board[];
}> {
  const response = await plankaClient.get<unknown>("/api/projects");
  const parsed = ProjectsResponse.parse(response);
  const included = ProjectsIncludedSchema.parse(
    (response as Record<string, unknown>).included || {}
  );

  return {
    projects: parsed.items,
    boards: included.boards || [],
  };
}

/**
 * Get the structure: projects -> boards, optionally with each board's lists.
 * Without includeLists this is a single GET /projects; with it, one extra
 * GET /boards/{id} per board (lists are only available there).
 */
export async function getStructure(
  projectId?: string,
  includeLists = false
): Promise<ProjectStructure[]> {
  const { projects, boards } = await getProjects();

  // Filter to specific project if requested
  const targetProjects = projectId
    ? projects.filter((p) => p.id === projectId)
    : projects;

  const structures: ProjectStructure[] = [];

  for (const project of targetProjects) {
    const projectBoards = boards
      .filter((b) => b.projectId === project.id)
      .sort((a, b) => a.position - b.position);

    const boardsWithLists: ProjectStructure["boards"] = [];
    for (const board of projectBoards) {
      let lists: List[] = [];
      if (includeLists) {
        lists = (await getBoard(board.id)).lists;
      }
      boardsWithLists.push({ board, lists });
    }

    structures.push({ project, boards: boardsWithLists });
  }

  return structures;
}
