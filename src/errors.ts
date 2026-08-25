/**
 * Typed error classes for PLANKA API operations.
 */

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

export class PlankaAuthError extends PlankaError {
  constructor(message = "Authentication failed") {
    super(message, "AUTH_FAILED", 401);
    this.name = "PlankaAuthError";
  }
}

export class PlankaNotFoundError extends PlankaError {
  constructor(resource: string, id: string, hint?: string) {
    super(
      `${resource} ${id} not found.${hint ? ` ${hint}` : ""}`,
      "NOT_FOUND",
      404
    );
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

export class PlankaConfigError extends PlankaError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR", 0);
    this.name = "PlankaConfigError";
  }
}

export class PlankaNetworkError extends PlankaError {
  constructor(message: string, details?: unknown) {
    super(message, "NETWORK_ERROR", 0, details);
    this.name = "PlankaNetworkError";
  }
}

/**
 * Maps API path collections to a resource name and the tool that lists
 * valid IDs for it, so 404 messages tell the caller what to do next.
 */
const NOT_FOUND_HINTS: Record<string, { name: string; hint: string }> = {
  projects: {
    name: "Project",
    // PLANKA answers project-level calls without permission with 404, not
    // 403 — so this 404 can also mean missing rights, not a wrong ID.
    hint:
      "Either the ID is wrong (planka_get_structure lists valid project IDs), " +
      "or the user lacks project manager rights on this project — PLANKA " +
      "answers 404 instead of 403 here, and board editor access is not " +
      "enough for project-level calls.",
  },
  boards: {
    name: "Board",
    hint: "Get valid board IDs from planka_get_structure.",
  },
  lists: {
    name: "List",
    hint: "Get valid list IDs from planka_get_board (or planka_get_structure with includeLists=true).",
  },
  cards: { name: "Card", hint: "Get valid card IDs from planka_get_board." },
  labels: { name: "Label", hint: "Get valid label IDs from planka_get_board." },
  tasks: { name: "Task", hint: "Get valid task IDs from planka_get_card." },
  "task-lists": {
    name: "Task list",
    hint: "Get valid task list IDs from planka_get_card.",
  },
  comments: {
    name: "Comment",
    hint: "Get valid comment IDs from planka_get_comments.",
  },
  attachments: {
    name: "Attachment",
    hint: "Get valid attachment IDs from planka_get_card.",
  },
};

/**
 * Derives resource type, ID, and a next-step hint from a request context
 * like "DELETE /api/cards/123/card-memberships/userId:456".
 */
function describeNotFound(context?: string): {
  resource: string;
  id: string;
  hint?: string;
} {
  const path = context?.split(" ")[1];
  if (!path) {
    return { resource: "Resource", id: context || "unknown" };
  }

  const segments = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const last = segments[segments.length - 1] ?? "";
  const cardId = segments[0] === "cards" ? segments[1] : undefined;

  // Association endpoints with a prefixed key in the last path segment
  if (last.startsWith("userId:")) {
    return {
      resource: "User",
      id: last.slice("userId:".length),
      hint:
        `The user may not be assigned to card ${cardId ?? "?"}, or the card does not exist. ` +
        "planka_get_card shows current assignees; planka_get_board_members lists board members.",
    };
  }
  if (last.startsWith("labelId:")) {
    return {
      resource: "Label",
      id: last.slice("labelId:".length),
      hint:
        `The label may not be on card ${cardId ?? "?"}, or the card/label does not exist. ` +
        "planka_get_card shows the card's labels.",
    };
  }

  // Find the last collection/{id} pair in the path
  let found: { resource: string; id: string; hint?: string } | null = null;
  for (let i = 0; i + 1 < segments.length; i++) {
    const mapping = NOT_FOUND_HINTS[segments[i]];
    if (mapping && !NOT_FOUND_HINTS[segments[i + 1]]) {
      found = { resource: mapping.name, id: segments[i + 1], hint: mapping.hint };
    }
  }

  return found ?? { resource: "Resource", id: context || "unknown" };
}

/**
 * Factory function to create typed errors from API responses.
 * @param status HTTP status code
 * @param body Response body (parsed JSON or null)
 * @param context Optional context (e.g., "GET /api/cards/123")
 */
export function createPlankaError(
  status: number,
  body: unknown,
  context?: string
): PlankaError {
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as Record<string, unknown>).message)
      : "Unknown error";

  const contextSuffix = context ? ` (${context})` : "";

  switch (status) {
    case 401:
      return new PlankaAuthError(message + contextSuffix);
    case 403:
      return new PlankaPermissionError(message + contextSuffix);
    case 404: {
      const { resource, id, hint } = describeNotFound(context);
      return new PlankaNotFoundError(resource, id, hint);
    }
    case 422:
      return new PlankaValidationError(message + contextSuffix, body);
    default:
      return new PlankaError(message + contextSuffix, "API_ERROR", status, body);
  }
}

/**
 * Type guard for PlankaError instances.
 */
export function isPlankaError(error: unknown): error is PlankaError {
  return error instanceof PlankaError;
}
