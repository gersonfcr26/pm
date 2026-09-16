# Project Plan

This document is the execution checklist for the Project Management MVP. It is intentionally detailed and test-first.

## Global decisions already set

- Frontend: Next.js app already exists and will be statically built.
- Backend: FastAPI will serve API routes and static frontend assets at root.
- Runtime packaging: single runtime Docker container using multi-stage build.
- Auth for MVP: frontend-only sign-in gate first (dummy credentials user/password).
- Database model for MVP: one JSON board blob per user in SQLite.
- AI model and host: OpenRouter with primary openai/gpt-oss-20b:free and 429 fallback to google/gemma-4-26b-a4b-it:free.
- AI board updates: require explicit user confirmation before apply.
- Chat history in MVP: in-memory only (per running process).
- Testing target: comprehensive coverage (unit + integration + e2e).
- Scripts: start/stop/status scripts for Windows, macOS, Linux; start scripts pass root .env into Docker when present.

## Part 1: Plan and project orientation

### Part 1 checklist

- [x] Expand this plan with implementation checklists, test strategy, and acceptance criteria for each part.
- [x] Create frontend/AGENTS.md describing the current frontend code and test setup.
- [x] Capture unresolved design decisions in a short Questions section.
- [x] Get explicit user approval before implementation work starts.

### Part 1 tests

- [x] Validate that this document maps 1:1 to Parts 2-10 with no missing requirements.
- [x] Validate that frontend/AGENTS.md accurately reflects current files and behaviors.

### Part 1 acceptance criteria

- [x] Each part includes actionable checklist items.
- [x] Each part includes a concrete test list.
- [x] Each part includes measurable acceptance criteria.
- [x] User confirms plan is approved.

## Part 2: Scaffolding (Docker + FastAPI hello world + scripts)

### Part 2 checklist

- [x] Create backend project scaffold in backend/ (app entrypoint, API router, config module).
- [x] Add FastAPI route GET /api/health returning status JSON.
- [x] Add placeholder GET / returning simple HTML from backend to verify container wiring.
- [x] Create Dockerfile with multi-stage build pipeline (frontend build stage and python runtime stage).
- [x] Use uv in container to install backend dependencies.
- [x] Add scripts in scripts/ for start, stop, and status for Windows/macOS/Linux.
- [x] Ensure scripts can run from repo root and provide clear output/errors.

### Part 2 tests

- [x] Build container image successfully from clean state.
- [x] Run container and confirm GET / returns hello world HTML.
- [x] Run container and confirm GET /api/health returns success JSON.
- [x] Run scripts start + stop + status on Windows PowerShell.
- [ ] Run scripts start + stop + status on macOS/Linux shell variants.
- [x] Validate script error handling when Docker daemon is unavailable (fail-fast with clear errors).
- [x] Validate configurable host port via PM_MVP_PORT (tested with 8010 due to host conflict on 8000).

### Part 2 acceptance criteria

- [x] One command path starts local app via scripts.
- [x] Dockerized app responds on root and health endpoint.
- [x] Backend dependency installation is handled by uv in container.
- [x] No frontend integration yet beyond placeholder response.
- [x] Scripts support start/stop/status and fail clearly on Docker command errors.
- [x] Scripts support host port override using PM_MVP_PORT.

## Part 3: Add frontend static build and serving

### Part 3 checklist

- [x] Wire Docker build stage to build frontend static assets.
- [x] Configure FastAPI static serving so / renders Kanban frontend.
- [x] Keep /api/* routes functional while serving frontend assets.
- [x] Confirm current styling/theme still works after static serving.

### Part 3 tests

- [x] Unit tests in frontend pass in container-compatible workflow.
- [x] Integration check: backend serves static frontend at /.
- [x] E2E smoke test: Kanban board loads with five columns when served via backend.

### Part 3 acceptance criteria

- [x] Visiting / shows current Kanban Studio UI from frontend build artifacts.
- [x] Visiting /api/health still returns API response.
- [x] Existing frontend behavior (rename/add/remove/move) remains functional.

## Part 4: Fake sign-in UX (frontend-only)

### Part 4 checklist

- [x] Add login screen shown before board content.
- [x] Implement credential check for user/password in frontend state.
- [x] Add logout action that returns user to login screen.
- [x] Keep implementation simple (no backend auth in this part).

### Part 4 tests

- [x] Unit test: invalid credentials show error and block board view.
- [x] Unit test: valid credentials reveal board.
- [x] Unit test: logout returns to login screen and hides board.
- [x] E2E test: full login and logout flow.

### Part 4 acceptance criteria

- [x] User cannot see Kanban board until authenticated with dummy credentials.
- [x] Correct credentials are exactly user/password.
- [x] Logout works consistently and resets gated state.

## Part 5: Database modeling (JSON board per user)

### Part 5 checklist

- [x] Propose SQLite schema with one board JSON blob per user.
- [x] Include migration/init strategy that creates DB if missing.
- [x] Define JSON shape for board payload and minimal metadata fields.
- [x] Document this in docs/ and request explicit user sign-off before coding Part 6.

### Part 5 tests

- [x] Validate schema supports future multi-user expansion.
- [x] Validate JSON shape can represent all current board features.
- [x] Validate schema supports efficient read/write for single board per user.

### Part 5 acceptance criteria

- [x] Schema proposal is documented and reviewed.
- [x] Decision and tradeoffs are written clearly.
- [x] User approves schema before backend API implementation.

## Part 6: Backend API for board persistence

### Part 6 checklist

- [x] Implement DB initialization on startup if file does not exist.
- [x] Add endpoint to fetch board for authenticated user context (MVP user).
- [x] Add endpoint to update full board JSON for authenticated user context.
- [x] Add validation for board payload shape at API boundary.
- [x] Keep API minimal and aligned to MVP scope.

### Part 6 tests

- [x] Backend unit test: DB is created automatically when absent.
- [x] Backend unit test: fetch returns default board for first-time user.
- [x] Backend unit test: update persists and later fetch returns same board.
- [x] Backend unit test: invalid payload returns validation error.

### Part 6 acceptance criteria

- [x] Backend can load and save board per user in SQLite JSON field.
- [x] API responses are stable and test-covered.
- [x] No frontend dependency required to validate backend behavior.

## Part 7: Frontend and backend integration

### Part 7 checklist

- [x] Replace in-memory initial board source with backend fetch on login.
- [x] Persist board mutations (rename/add/remove/move) through backend API.
- [x] Handle loading and error states with simple UX.
- [x] Keep frontend architecture simple and avoid unnecessary abstractions.

### Part 7 tests

- [x] Frontend integration test: load board from API and render columns/cards.
- [x] Frontend integration test: board operations trigger persistence requests.
- [x] E2E test: mutate board, refresh page, and verify persistence remains.
- [x] E2E regression test: dropping a card into an empty column succeeds.

### Part 7 acceptance criteria

- [x] Board state is durable across reloads.
- [x] Core Kanban interactions remain responsive.
- [x] Drag-and-drop into empty columns works reliably.
- [x] Integration works through Dockerized local run.

## Part 8: OpenRouter connectivity

### Part 8 checklist

- [x] Add backend OpenRouter client module using OPENROUTER_API_KEY env var.
- [x] Add a simple test endpoint/service call that asks 2+2.
- [x] Handle missing API key with explicit error.
- [x] Log minimal diagnostics for failed provider calls.
- [x] On OpenRouter 429 from primary model, retry with fallback model and OPENROUTER_API_KEY_2.
- [x] Ensure container runtime receives root .env variables through start scripts.

### Part 8 tests

- [x] Unit test: missing API key path returns clear error.
- [x] Connectivity test: 2+2 call returns non-empty response.
- [x] Integration test: backend endpoint proxies AI test successfully.
- [x] Unit test: 429 on primary model retries with fallback model/key and returns response.
- [x] Runtime validation: live connectivity endpoint succeeded with fallback model response.

### Part 8 acceptance criteria

- [x] Backend can successfully call OpenRouter with configured model.
- [x] Failure modes are clear and debuggable.
- [x] No Kanban mutation yet in this part.
- [x] Rate-limit resilience exists through automatic model/key fallback on 429.

## Part 9: Structured outputs for AI board operations

### Part 9 checklist

- [x] Add backend chat endpoint that sends board JSON + user prompt + in-memory history.
- [x] Define structured output schema with user response plus optional board patch/full replacement.
- [x] Validate AI output strictly against schema before returning to frontend.
- [x] If update is present, return it as proposed change (not auto-applied).
- [x] Document schema and request explicit user approval before finalizing.

### Approved structured output schema

- [x] Response contract:
  - version: string
  - assistantMessage: string
  - boardUpdate: null or object
  - boardUpdate.mode: replace | patch
  - boardUpdate.reason: string
  - boardUpdate.payload: board JSON (replace) or operations list (patch)
  - warnings: string[]

### Part 9 tests

- [x] Unit test: valid structured output parses successfully.
- [x] Unit test: malformed output is rejected with safe fallback.
- [x] Unit test: boardUpdate null path returns chat response only.
- [x] Integration test: history is included in outbound AI payload.

### Part 9 acceptance criteria

- [x] Backend returns deterministic JSON contract to frontend.
- [x] Optional board updates are always explicit and inspectable.
- [x] Unsafe or invalid AI output is blocked.

## Part 10: AI sidebar UI with confirmation-based apply

### Part 10 checklist

- [x] Add sidebar chat UI integrated into existing Kanban layout.
- [x] Render conversation thread from frontend state.
- [x] Send message to backend chat endpoint and display assistant response.
- [x] If proposed board update is returned, show a confirmation step.
- [x] Apply update only when user confirms; reject/cancel keeps board unchanged.
- [x] Refresh board view immediately after confirmed apply.

### Part 10 tests

- [x] Component test: chat message render and submit flow.
- [x] Component test: confirmation UI appears when update is proposed.
- [x] Component test: reject leaves board untouched.
- [x] Component test: confirm applies update and rerenders board.
- [x] E2E test: end-to-end chat-driven board update with explicit confirmation.

### Part 10 acceptance criteria

- [x] Sidebar provides full MVP chat flow.
- [x] AI can suggest board updates but never applies them without confirmation.
- [x] Confirmed updates are visible immediately and persist through backend.

## Open questions to resolve before implementation

- None at this time.
