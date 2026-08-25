# PLANKA MCP Server

A Model Context Protocol (MCP) server for [PLANKA](https://planka.app) kanban boards, purpose-built for Claude and other AI agents.

## Features

- Full PLANKA 2.0 API support
- Type-safe with Zod validation
- Optimized for agent workflows (combined operations, sensible defaults)
- 17 tools covering cards, tasks, labels, comments, lists, members, and attachments
- Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`) so MCP clients can auto-approve read-only calls

## Installation

```bash
npm install @gogogadgetbytes/planka-mcp
```

Or run directly:

```bash
npx @gogogadgetbytes/planka-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PLANKA_BASE_URL` | Yes | Your PLANKA server URL |
| `PLANKA_API_KEY` | One of the two auth options | API key, sent as `X-Api-Key` header (recommended) |
| `PLANKA_AGENT_EMAIL` + `PLANKA_AGENT_PASSWORD` | One of the two auth options | Agent user credentials (fallback) |
| `PLANKA_UPLOAD_DIR` | No | Base directory for file uploads. If unset, `planka_add_attachment` is disabled |

### Authentication

Two modes are supported:

1. **API key (recommended).** Set `PLANKA_API_KEY`. Every request is sent with
   the `X-Api-Key` header and no login request is ever made — your password
   never appears in the configuration. Create a key for the agent user in
   PLANKA (admin: `POST /api/users/{id}/api-key`, or via the user settings UI
   in PLANKA 2.x).
2. **Email/password (fallback).** Set `PLANKA_AGENT_EMAIL` and
   `PLANKA_AGENT_PASSWORD`. The server logs in via `POST /api/access-tokens`
   and refreshes the JWT automatically.

If `PLANKA_API_KEY` is set, it always wins and email/password are ignored.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "planka": {
      "command": "npx",
      "args": ["@gogogadgetbytes/planka-mcp"],
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
      "command": "npx",
      "args": ["@gogogadgetbytes/planka-mcp"],
      "env": {
        "PLANKA_BASE_URL": "https://planka.example.com",
        "PLANKA_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Available Tools

### Navigation

| Tool | Description |
|------|-------------|
| `planka_get_structure` | Get projects, boards, and lists hierarchy |
| `planka_get_board` | Get a board with all cards, lists, and labels |

### Cards

| Tool | Description |
|------|-------------|
| `planka_create_card` | Create a card (optionally with tasks) |
| `planka_update_card` | Update card properties |
| `planka_move_card` | Move card to different list/position |
| `planka_get_card` | Get card details with tasks/comments |
| `planka_delete_card` | Delete a card |

### Tasks

| Tool | Description |
|------|-------------|
| `planka_create_tasks` | Add tasks (checklist items) to a card |
| `planka_update_task` | Update task name or completion |
| `planka_delete_task` | Delete a task |

### Labels

| Tool | Description |
|------|-------------|
| `planka_manage_labels` | Create/update/delete board labels |
| `planka_set_card_labels` | Add/remove labels from a card |

### Members

| Tool | Description |
|------|-------------|
| `planka_get_board_members` | List board members with their user IDs and roles |
| `planka_assign_card` | Assign a user to a card |
| `planka_unassign_card` | Remove an assigned user from a card |

### Attachments

| Tool | Description |
|------|-------------|
| `planka_add_attachment` | Upload a file from `PLANKA_UPLOAD_DIR` to a card (only available when `PLANKA_UPLOAD_DIR` is set) |

### Comments

| Tool | Description |
|------|-------------|
| `planka_add_comment` | Add a comment to a card |
| `planka_get_comments` | Get all comments on a card |

### Lists

| Tool | Description |
|------|-------------|
| `planka_manage_lists` | Create/update/delete lists |

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

### Move card through workflow

```
Use planka_move_card to move card from "To Do" to "In Progress"
```

## PLANKA 2.0 Compatibility

This server is designed for PLANKA 2.0 and handles the API differences from 1.x:

- Card creation includes required `type` field
- Label endpoints use `/card-labels` path
- Optional fields handled gracefully

## Development

```bash
# Clone
git clone https://github.com/gogogadgetbytes/planka-mcp.git
cd planka-mcp

# Install
npm install

# Build
npm run build

# Test
npm test
```

## License

MIT

## Links

- [PLANKA](https://planka.app) - The kanban board
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol
- [Design Document](./DESIGN.md) - Technical design details
