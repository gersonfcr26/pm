# Frontend agent guide

## Purpose

This frontend is a Next.js Kanban UI prototype. It currently runs as a standalone client-side app and does not call a backend yet.

## Current behavior

- Renders a single Kanban board at /.
- Board has five columns with editable column titles.
- Cards support add, delete, and drag/drop between columns.
- Board state is in React component state only (not persisted).

## Key files

- src/app/page.tsx: App entry page. Renders KanbanBoard.
- src/components/KanbanBoard.tsx: Main board container and state owner.
- src/components/KanbanColumn.tsx: Column container, rename input, add form, card list drop zone.
- src/components/KanbanCard.tsx: Sortable card UI and delete action.
- src/components/KanbanCardPreview.tsx: Drag overlay preview card.
- src/components/NewCardForm.tsx: Add-card form and validation.
- src/lib/kanban.ts: Types, initial board data, moveCard utility, id creation.
- src/app/globals.css: Theme variables and global styles.

## Libraries in use

- next, react, react-dom
- @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- clsx
- tailwindcss v4

## Tests currently present

- Unit/component tests (Vitest + Testing Library):
  - src/lib/kanban.test.ts (card movement utility)
  - src/components/KanbanBoard.test.tsx (render, rename, add/remove card)
- E2E tests (Playwright):
  - tests/kanban.spec.ts (load board, add card, move card)

## Frontend commands

- npm run dev
- npm run build
- npm run start
- npm run test:unit
- npm run test:e2e
- npm run test:all

## Constraints for future implementation

- Keep code simple and MVP-focused.
- Preserve current color tokens and overall style direction unless requested.
- Avoid over-engineering state management; prefer straightforward React patterns.
- As backend is introduced, keep frontend API integration minimal and testable.
