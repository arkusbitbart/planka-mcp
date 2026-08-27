# PLANKA MCP Server

A Model Context Protocol (MCP) server for [PLANKA](https://planka.app) kanban boards, purpose-built for Claude and other AI agents.

## About this fork

This is a fork of [gogogadgetbytes/planka-mcp](https://github.com/gogogadgetbytes/planka-mcp). It is **not published to npm** — install it from source as described below.

### Changes since the fork

Derived from the git history since the fork point:

**Authentication**
- API key authentication: set `PLANKA_API_KEY` and every request carries the `X-Api-Key` header; the login endpoint is never called. Email/password remains as fallback.
- Opt-in terms acceptance (`PLANKA_AUTO_ACCEPT_TERMS`, off by default) for instances that require accepting terms on login.

**New tools** (15 → 32)
- Card assignments: `planka_get_board_members`, `planka_assign_card`, `planka_unassign_card`
- Attachments: `planka_add_attachment` (file upload with path sandbox), `planka_add_link_attachment` (URLs)
- Activity & notifications: `planka_get_activity`, `planka_get_notifications`, `planka_mark_notifications_read`
- Projects & boards: `planka_manage_projects` (create/update, deliberately no delete), `planka_manage_boards`
- Cards & checklists: `planka_duplicate_card`, `planka_manage_task_lists` (multiple checklists per card), task assignees in `planka_update_task`
- Comments: `planka_update_comment`, `planka_delete_comment`
- Lists: `planka_sort_list`, `planka_move_list_cards`, `planka_clear_list`

**Fixes & usability**
- Label removal uses the spec path `DELETE /cards/{cardId}/card-labels/labelId:{labelId}`; a 404 is verified against the card's actual labels instead of being silently swallowed.
- `planka_get_structure` fetches projects and boards in a single request (previously one request per board).
- `planka_get_card` and `planka_get_board` show card assignees.
- 404 errors name the missing resource and the tool that lists valid IDs.
- `planka_create_card` accepts `position`: `"top"`, `"bottom"`, or a number; date fields document the expected ISO 8601 format.
- Time tracking: `planka_update_card` drives the card stopwatch (`"start"`/`"stop"`/`"reset"`), and `planka_get_card` shows the elapsed time human-readably. The former `isCompleted` parameter was replaced by `isDueCompleted` — the API has no `isCompleted` field, so the old parameter was silently ignored.
- Tool input schemas avoid JSON Schema unions entirely (clients mangle them into untyped fields): every property has exactly one type, clearing is expressed via `""`/`"none"` sentinels, and the server parses leniently (string booleans and numbers are coerced).
- All tools carry MCP annotations (`readOnlyHint`/`destructiveHint`/`idempotentHint`) so clients can auto-approve read-only calls.

**Security**
- File uploads are restricted to `PLANKA_UPLOAD_DIR` (realpath-based, symlink-safe); tests cover `../` and symlink escapes.
- Tests assert the API key never appears in error messages, stacks, or error details.

**Breaking changes** (hence version 2.0.0)
- `planka_get_structure` no longer includes each board's lists by default — pass `includeLists=true` to get them (costs one extra request per board).
- `planka_get_board` with the new `listId` parameter returns a compact single-list format in which labels appear as `labelIds` instead of label names (the list endpoint carries no label metadata).

## Features

- 32 tools covering projects, boards, lists, cards, checklists, labels, comments, members, attachments, activity, and notifications
- Two runtime dependencies only: `@modelcontextprotocol/sdk` and `zod`
- All inputs validated and all API responses parsed with Zod schemas
- Tool annotations so MCP clients can skip confirmation prompts for read-only calls
- Actionable error messages (a 404 tells you which tool lists valid IDs)

## Requirements

- Node.js 18 or newer (`engines` in package.json: `>=18.0.0`)
- A PLANKA 2.x instance (built against the official OpenAPI spec, version 2.0.1)

## Installation

This fork is installed from source (it is not published to npm):

```bash
git clone https://github.com/arkusbitbart/planka-mcp.git
cd planka-mcp
npm install
npm run build
```

Then point your MCP client at the built entry point with `"command": "node"` and the **absolute** path to `dist/index.js` (see the configuration examples below).

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLANKA_BASE_URL` | Yes | Your PLANKA server URL |
| `PLANKA_API_KEY` | One of the two auth options | API key, sent as `X-Api-Key` header (recommended) |
| `PLANKA_AGENT_EMAIL` + `PLANKA_AGENT_PASSWORD` | One of the two auth options | Agent user credentials (fallback) |
| `PLANKA_UPLOAD_DIR` | No | Base directory for file uploads. **If unset, the `planka_add_attachment` tool is not registered at all** (link attachments still work) |
| `PLANKA_AUTO_ACCEPT_TERMS` | No | Email/password login only: `true` lets the server accept PLANKA's terms of service automatically when the instance requires it. Off by default |

### Authentication

Two modes are supported; if `PLANKA_API_KEY` is set, it always wins and email/password are ignored.

1. **API key (recommended).** Set `PLANKA_API_KEY`. Every request is sent with the `X-Api-Key` header and no login request is ever made — no password sits in your client configuration. Creating a key for the agent user requires **admin rights** (`POST /api/users/{id}/api-key`, or via the user administration in the PLANKA web UI), and the full key is **shown only once** — copy it into your configuration immediately.
2. **Email/password (fallback).** Set `PLANKA_AGENT_EMAIL` and `PLANKA_AGENT_PASSWORD`. The server logs in via `POST /api/access-tokens` and refreshes the JWT automatically (tokens are refreshed after 25 minutes).

### Upload sandbox

When `PLANKA_UPLOAD_DIR` is set, `planka_add_attachment` can upload files from that directory — and only from there. Every `filePath` is resolved with `fs.realpath` (symlinks included) and compared against the equally resolved base directory; anything that ends up outside — via `../`, absolute paths, or symlinks — is rejected with a clear error. Without `PLANKA_UPLOAD_DIR` the tool is not registered.

### Terms acceptance (`PLANKA_AUTO_ACCEPT_TERMS`)

Some PLANKA instances require accepting the terms of service on first login. Accepting them is a consent given on the account owner's behalf, so this server never does it silently: by default, a login answered with "Terms acceptance required" fails with instructions to log in manually once via the web UI. Only when `PLANKA_AUTO_ACCEPT_TERMS=true` is set explicitly does the server accept the terms automatically. This only applies to email/password login.

### Claude Desktop

Add to `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "planka": {
      "command": "node",
      "args": ["/absolute/path/to/planka-mcp/dist/index.js"],
      "env": {
        "PLANKA_BASE_URL": "https://planka.example.com",
        "PLANKA_API_KEY": "your-api-key",
        "PLANKA_UPLOAD_DIR": "/path/to/upload/dir"
      }
    }
  }
}
```

With email/password instead, replace `PLANKA_API_KEY` with:

```json
        "PLANKA_AGENT_EMAIL": "agent@example.com",
        "PLANKA_AGENT_PASSWORD": "your-password"
```

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "planka": {
      "command": "node",
      "args": ["/absolute/path/to/planka-mcp/dist/index.js"],
      "env": {
        "PLANKA_BASE_URL": "https://planka.example.com",
        "PLANKA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

32 tools. All `planka_get_*` tools are read-only; delete actions are marked destructive via annotations.

### Navigation

| Tool | Description |
|------|-------------|
| `planka_get_structure` | Get projects and boards in one request; lists only with `includeLists=true` |
| `planka_get_board` | Get a board with all cards, lists, and labels; `listId` loads a single list (labels as IDs there) |

### Projects & Boards

| Tool | Description |
|------|-------------|
| `planka_manage_projects` | Create/update projects (no delete, deliberately) |
| `planka_manage_boards` | Create/update/delete boards |

### Cards

| Tool | Description |
|------|-------------|
| `planka_create_card` | Create a card (optionally with tasks and labels; position `top`/`bottom`/number) |
| `planka_get_card` | Card details with checklists, comments, labels, assignees, attachments |
| `planka_update_card` | Update name, description, due date, due-completed checkbox, stopwatch (`start`/`stop`/`reset`) |
| `planka_move_card` | Move card to a different list/position |
| `planka_duplicate_card` | Duplicate a card, optionally into another list |
| `planka_delete_card` | Permanently delete a card |

### Tasks & Checklists

| Tool | Description |
|------|-------------|
| `planka_create_tasks` | Add tasks (checklist items) to a card |
| `planka_update_task` | Update task name, completion, or assignee |
| `planka_delete_task` | Delete a task |
| `planka_manage_task_lists` | Create/rename/delete checklists (multiple per card) |

### Labels

| Tool | Description |
|------|-------------|
| `planka_manage_labels` | Create/update/delete board labels |
| `planka_set_card_labels` | Add/remove labels on a card |

### Comments

| Tool | Description |
|------|-------------|
| `planka_add_comment` | Add a comment to a card |
| `planka_get_comments` | Get all comments on a card |
| `planka_update_comment` | Edit a comment |
| `planka_delete_comment` | Delete a comment |

### Lists

| Tool | Description |
|------|-------------|
| `planka_manage_lists` | Create/update/delete lists |
| `planka_sort_list` | Sort a list's cards by name/dueDate/createdAt |
| `planka_move_list_cards` | Move all cards from one list to another |
| `planka_clear_list` | Move all cards of a list to the trash |

### Members

| Tool | Description |
|------|-------------|
| `planka_get_board_members` | List board members with user IDs and roles |
| `planka_assign_card` | Assign a user to a card |
| `planka_unassign_card` | Remove an assigned user from a card |

### Activity & Notifications

| Tool | Description |
|------|-------------|
| `planka_get_activity` | Activity log of a card or board, reduced to readable entries |
| `planka_get_notifications` | The agent user's notification inbox |
| `planka_mark_notifications_read` | Mark all notifications as read |

### Attachments

| Tool | Description |
|------|-------------|
| `planka_add_attachment` | Upload a file to a card. **Only registered when `PLANKA_UPLOAD_DIR` is set** |
| `planka_add_link_attachment` | Attach a URL as a link attachment (always available) |

## Usage Examples

### Get board structure

```
Use planka_get_structure to see all projects and boards
```

### Create a card with tasks

```
Use planka_create_card with:
- listId: "abc123"
- name: "Implement feature X"
- tasks: ["Research", "Design", "Implement", "Test"]
```

### Assign someone to a card

```
Use planka_get_board_members to find the userId,
then planka_assign_card with cardId and userId
```

## PLANKA 2.x Compatibility

This server targets PLANKA 2.x and its official OpenAPI spec (version 2.0.1):

- Card creation sends the `type` field required since PLANKA 2.0 (default `"project"`).
- Adding a label uses `POST /cards/{cardId}/card-labels`; removing one uses `DELETE /cards/{cardId}/card-labels/labelId:{labelId}` with the literal `labelId:` prefix in the path. If an instance does not support that syntax, the server reports it instead of silently claiming success.
- Card membership removal uses the analogous `DELETE /cards/{cardId}/card-memberships/userId:{userId}` path.
- Tasks live in task lists (checklists); `planka_create_tasks` auto-creates a default checklist when a card has none.
- Archive/trash lists (null names) are handled and filtered from board views.

## Remote deployment (HTTP transport)

Besides stdio, the server ships an HTTP entry point (`dist/http.js`, MCP Streamable HTTP) so it can be used as a remote custom connector. Both transports share the same tool registry and run independently of each other.

**The HTTP server refuses to start without `MCP_AUTH_TOKEN`.** It exposes write access to your boards, so there is deliberately no unauthenticated mode: without the variable the process exits with an error instead of starting open.

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_AUTH_TOKEN` | Yes | Long random secret; clients must send `Authorization: Bearer <token>`. Missing/wrong tokens get a uniform 401; repeated failures are rate-limited per IP |
| `PORT` | No | Listen port (default 3000) |
| `PLANKA_BASE_URL` + auth variables | Yes | Same PLANKA configuration as for stdio (see above) |

Endpoints:

- `POST /mcp` — the MCP endpoint (bearer auth required)
- `GET /health` — health check, unauthenticated, returns `{"status":"ok"}`

Run directly:

```bash
MCP_AUTH_TOKEN="$(openssl rand -hex 32)" PLANKA_BASE_URL=... PLANKA_API_KEY=... node dist/http.js
```

Or via Docker (multi-stage build, runs as non-root):

```bash
docker build -t planka-mcp .
docker run -p 3000:3000 \
  -e MCP_AUTH_TOKEN=... -e PLANKA_BASE_URL=... -e PLANKA_API_KEY=... \
  planka-mcp
```

Health check for orchestrators: `curl -f http://localhost:3000/health`.

## Development

```bash
# Clone
git clone https://github.com/arkusbitbart/planka-mcp.git
cd planka-mcp

# Install
npm install

# Build
npm run build

# Test (vitest, no PLANKA instance needed — HTTP is mocked)
npm test
```

## License

MIT — see [LICENSE](./LICENSE). Original copyright by [gogogadgetbytes](https://github.com/gogogadgetbytes), modifications in this fork by arkusbitbart.

## Links

- [PLANKA](https://planka.app) - The kanban board
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol
- [Upstream project](https://github.com/gogogadgetbytes/planka-mcp) - The original this fork is based on
- [Design Document (historical)](./DESIGN.md) - The upstream project's original design notes; **not current** — the code and this README are authoritative
