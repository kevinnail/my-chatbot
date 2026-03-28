# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Start frontend (port 3000)
cd client && npm run start

# Start backend (port 4000)
cd server && npm run start:watch

# Start MCP server (port 4001) — required for email/calendar tool execution
cd server && npm run start:mcp

# Database setup
cd server && npm run setup-db
cd server && npm run setup-test-db   # for test database
```

### Testing

```bash
cd server && npm test                                      # all tests
cd server && npm run test:watch                            # watch mode
cd server && npm test -- --coverage                        # with coverage
cd server && npm test -- __tests__/controllers/chat.test.js  # single file
```

### Code Quality

```bash
npx eslint ./server --fix
npx prettier --write .
```

### Build

```bash
cd client && npm run build   # outputs to client/build/
```

## Architecture

**Devflow Assistant** is a full-stack AI chatbot with local LLM inference, email analysis, and Google Calendar integration.

### Stack

- **Frontend:** React 19, React Router 7, Socket.io-client, Zustand (global state), React Context (UserContext, ChatContext, LoadingContext)
- **Backend:** Express 5 (port 4000), Socket.io
- **Database:** PostgreSQL + pgvector extension (1024-dimension vectors for semantic search)
- **AI:** Ollama (local LLM) — `llama3.1:8b` for chat, `mxbai-embed-large` for embeddings
- **MCP:** `@modelcontextprotocol/sdk` server on port 4001 for LLM tool execution (calendar creation)

### Key Data Flow

1. Chat messages go from `client/src/services/chatApi.js` → `POST /api/chat` → `server/lib/controllers/chat.js`
2. `buildPrompt.js` assembles context: recent messages + semantically similar messages (via pgvector cosine similarity) + email/calendar context
3. Request streams to Ollama; response is streamed back via Socket.io
4. Embeddings for new messages are generated via `ollamaEmbed.js` and stored in `chat_memory`

### Email & Calendar

- Gmail is accessed via IMAP (app password), not Gmail API — see `server/utils/gmailImap.js`
- Emails are analyzed by the LLM and stored with embeddings in `email_memory`
- Google Calendar uses OAuth 2.0; tokens stored in `google_calendar_tokens` table
- When the LLM detects scheduling information, it calls a tool via the MCP server to create calendar events

### Database Schema

Defined in `server/sql/setup.sql`. Key tables:
- `users` — accounts
- `chats` — sessions
- `chat_memory` — messages with VECTOR(1024) embeddings
- `email_memory` — analyzed emails with VECTOR(1024) embeddings
- `gmail_sync_status`, `google_calendar_tokens` — integration state

### Dual-mode AI

The app supports two personas (coding assistant / career coach) configured via system prompts in `server/lib/utils/chatPrompts.js`. Mode selection affects which prompt template is used in `buildPrompt.js`.

## Constraints

- Do not install new npm packages without asking — enforced by `.cursorrc.json`
- ESLint enforces no `console.log` (only `console.info`/`console.error`), `const` over `let`/`var`, arrow functions; max 10 warnings allowed
- Prettier: 2-space indent, 100-char line width, single quotes
- The server runs on PostgreSQL in WSL when developing on Windows — use the WSL IP for `PG_HOST` if connecting from Windows host (see README)

## Prerequisites

- PostgreSQL with pgvector extension running
- Ollama running on port 11434 with models `llama3.1:8b` and `mxbai-embed-large` pulled
- Server `.env` configured (see README for all required variables)
