# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Project Management MVP: a single-user (MVP scope) Kanban board with an AI chat sidebar that can propose card/board edits, which the user must explicitly confirm before they are applied.

- Frontend: Next.js (App Router), React 19, Tailwind v4, `@dnd-kit` for drag-and-drop.
- Backend: Python FastAPI, serving both `/api/*` routes and the built Next.js static site at `/`.
- AI: OpenRouter, primary model `openai/gpt-oss-20b:free` (`OPENROUTER_API_KEY`), falling back to `google/gemma-4-26b-a4b-it:free` (`OPENROUTER_API_KEY_2`) on HTTP 429.
- Storage: SQLite, one JSON board blob per user (see `docs/DB_SCHEMA.md`).
- Packaging: single multi-stage Dockerfile (builds frontend, then runs FastAPI which serves it); `uv` installs Python deps in the image.
- Full requirements, tech decisions, and coding standards live in `AGENTS.md` at repo root — read it before making product/architecture decisions. Per-directory `AGENTS.md` files (`backend/AGENTS.md`, `frontend/AGENTS.md`, `scripts/AGENTS.md`) describe local scope/conventions.
- `docs/PLAN.md` is the authoritative, test-first execution checklist for the whole build (parts 1-10). `docs/DB_SCHEMA.md` documents the approved SQLite schema and JSON board shape.

## Commands

### Local (Docker) run

```sh
scripts/start.ps1   # or start.sh / start.cmd — builds pm-mvp:local, runs container pm-mvp on :8000
scripts/status.ps1  # reports container state, checks /api/health
scripts/stop.ps1    # removes the container
```

`PM_MVP_PORT` env var overrides the host port. Start scripts pass a root `.env` file into the container (this is how `OPENROUTER_API_KEY[_2]` reach the backend at runtime).

### Frontend (`frontend/`)

```sh
npm run dev            # Next.js dev server
npm run build           # production build
npm run lint            # eslint
npm run test:unit        # vitest run (unit/component tests)
npm run test:unit:watch  # vitest watch mode
npm run test:e2e         # playwright test (e2e)
npm run test:all         # unit then e2e
```

Run a single vitest file: `npx vitest run src/lib/kanban.test.ts`. Run a single playwright test: `npx playwright test tests/kanban.spec.ts -g "test name"`.

### Backend (`backend/`)

Dependencies are managed with `uv` and installed inside the Docker image per `AGENTS.md`. To run backend tests locally:

```sh
python -m pytest backend/tests
python -m pytest backend/tests/test_chat_api.py -k some_test
```

## Architecture

### Request flow

FastAPI (`backend/app/main.py`) serves the Next.js static export at `/` and exposes `/api/*`. There is no separate frontend dev server in production — the Docker build stage builds the frontend first, and the runtime stage only runs the Python app.

### Auth

Auth is a frontend-only gate (`frontend/src/components/AuthGate.tsx`) checking hardcoded `user`/`password` — there is no backend session/auth. The backend is written to support multiple users going forward, but MVP always operates as a single fixed "user" identity, and there is exactly one board per user.

### Board persistence

- Board shape: `columns[]` (id, title, cardIds[]) + `cards{}` map (id, title, details), defined in `frontend/src/lib/kanban.ts` and mirrored by the backend's stored JSON blob (`docs/DB_SCHEMA.md`).
- Backend stores the entire board as one JSON blob per user (SQLite `boards` table, upsert on save) rather than normalized tables — full-board read/replace is the primary pattern.
- Frontend fetches the board on login and persists mutations (rename/add/remove/move) back through the backend API; `KanbanBoard.tsx` owns board state and drives all mutation calls.

### AI chat and board updates

- `backend/app/openrouter_client.py` wraps OpenRouter calls, including the primary→fallback model/key retry on 429.
- The chat endpoint sends the current board JSON + user prompt + in-memory (per-process, not persisted) history to the model and expects a structured response:
  - `version`, `assistantMessage`, `boardUpdate` (nullable: `{mode: replace, reason, payload}`), `warnings[]`.
- The backend strictly validates the AI's structured output before returning it; malformed output is rejected rather than trusted.
- The AI never applies board changes directly. `AiSidebar.tsx` renders any proposed `boardUpdate` as a confirmation step; the board is only mutated (and persisted) when the user explicitly confirms. Rejecting/canceling leaves the board untouched.

### Frontend component structure

- `page.tsx` → `KanbanBoard.tsx` (state owner, board API integration) → `KanbanColumn.tsx` (rename, add-card form, drop zone) → `KanbanCard.tsx` (sortable card, delete) / `KanbanCardPreview.tsx` (drag overlay).
- `AiSidebar.tsx` is the chat UI, integrated alongside the board, calling the backend chat endpoint and handling the confirm/reject flow described above.
- `NewCardForm.tsx` handles add-card validation.

## Conventions

- Keep things simple and MVP-scoped: no unnecessary defensive programming, no speculative features, avoid over-engineering state management.
- No emojis in code, docs, or UI text.
- When debugging, find the root cause before changing code — don't guess-and-check fixes.
- Preserve the existing color tokens/theme (`frontend/src/app/globals.css`) unless a change is explicitly requested.
