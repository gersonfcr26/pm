# Part 5 Database Proposal (SQLite + JSON)

## Scope

This document proposes the MVP database model for persistent Kanban storage.

Confirmed constraints:

- One board per user in MVP.
- Store board data as one JSON blob per user.
- Keep design ready for future multi-user support.

## Proposed schema

### Table: users

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Table: boards

```sql
CREATE TABLE IF NOT EXISTS boards (
  user_id INTEGER PRIMARY KEY,
  board_json TEXT NOT NULL CHECK (json_valid(board_json)),
  schema_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:

- boards.user_id as PRIMARY KEY enforces exactly one board per user.
- board_json uses SQLite JSON1 validation via CHECK(json_valid(...)).
- schema_version allows safe format evolution later.

## JSON payload shape

The board_json payload should follow this shape:

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    }
  }
}
```

This matches the frontend BoardData shape currently defined in src/lib/kanban.ts.

## Initialization and migration strategy

On backend startup:

1. Ensure database file exists (SQLite creates it on first connection).
2. Execute CREATE TABLE IF NOT EXISTS for users and boards.
3. Ensure MVP user row exists:
   - username = user
4. Ensure board row exists for that user:
   - board_json seeded from current frontend initial board shape
   - schema_version = 1
5. Use lightweight PRAGMA settings suitable for local app stability:
   - PRAGMA foreign_keys = ON;
   - PRAGMA journal_mode = WAL;

Migration approach:

- Keep a tiny schema_migrations table if/when schema changes start.
- For MVP, version 1 can be initialized without a full migration framework.

## Read and write pattern

### Read board for user

```sql
SELECT board_json, schema_version, updated_at
FROM boards
WHERE user_id = ?;
```

### Save board for user (upsert)

```sql
INSERT INTO boards (user_id, board_json, schema_version, created_at, updated_at)
VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(user_id) DO UPDATE SET
  board_json = excluded.board_json,
  schema_version = excluded.schema_version,
  updated_at = CURRENT_TIMESTAMP;
```

## Validation boundary (application-level)

Even with json_valid at DB level, backend should validate payload before write:

- columns must be an array.
- cards must be an object/map.
- each column must have id, title, cardIds.
- each card must have id, title, details.
- every cardIds value must exist in cards keys.

## Why this design

Pros:

- Very simple MVP persistence model.
- Natural fit for current frontend board state shape.
- Minimal joins and easy full-board read/write.
- Future-safe enough for multi-user with users table and FK.

Tradeoffs:

- Limited queryability over individual cards at SQL level.
- Full-board update writes the entire JSON blob.
- Partial updates require app-side read-modify-write unless using JSON_PATCH/JSON_SET.

## Future evolution path (post-MVP)

If needed later:

- Keep boards as source of truth and add materialized card tables for analytics/search.
- Or migrate to normalized tables (boards, columns, cards, card_positions) with migration script.
- Bump schema_version and implement explicit migration steps.

## Part 5 review checklist result

- Supports multi-user expansion: yes (users + FK + one board per user).
- Represents current board features: yes (columns + cards map + ordering by cardIds).
- Efficient for MVP read/write: yes (single row per board, upsert pattern).
