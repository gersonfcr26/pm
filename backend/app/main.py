import json
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, model_validator

from .openrouter_client import (
  CONNECTIVITY_PROMPT,
  OpenRouterConfigError,
  OpenRouterUpstreamError,
  run_connectivity_check,
  run_structured_chat,
)

@asynccontextmanager
async def lifespan(_: FastAPI):
  init_database()
  yield


app = FastAPI(title="Project Management MVP API", lifespan=lifespan)

FRONTEND_OUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "out"
DEFAULT_USERNAME = "user"
MAX_HISTORY_MESSAGES = 20

CHAT_SYSTEM_INSTRUCTIONS = """
You are an assistant for a Kanban project board.
The board you receive has this JSON shape:
{
  "columns": [{"id": "string", "title": "string", "cardIds": ["string", ...]}, ...],
  "cards": {"<cardId>": {"id": "string", "title": "string", "details": "string"}, ...}
}
Column ids are stable identifiers, not display text; keep them unchanged when renaming a column.
Every id listed in a column's cardIds must exist as a key in cards, and every card must be
referenced by exactly one column's cardIds. Do not invent ids for existing cards or columns;
reuse the ids given to you. New cards need a new unique id string.

Return ONLY JSON with this shape:
{
  "version": "1",
  "assistantMessage": "string",
  "boardUpdate": null OR {
    "mode": "replace",
    "reason": "string",
    "payload": object (the complete board, same shape as above)
  },
  "warnings": ["string", ...]
}
When proposing a board change, "payload" must be the FULL resulting board (all columns and all
cards, not just the changed ones), since it replaces the board entirely.
Do not include markdown or code fences.
""".strip()

CHAT_HISTORY_BY_USER: dict[str, list[dict[str, str]]] = {}

DEFAULT_BOARD: dict[str, Any] = {
  "columns": [
    {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
    {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
    {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
    {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
    {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      "id": "card-2",
      "title": "Gather customer signals",
      "details": "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      "id": "card-3",
      "title": "Prototype analytics view",
      "details": "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      "id": "card-4",
      "title": "Refine status language",
      "details": "Standardize column labels and tone across the board.",
    },
    "card-5": {
      "id": "card-5",
      "title": "Design card layout",
      "details": "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      "id": "card-6",
      "title": "QA micro-interactions",
      "details": "Verify hover, focus, and loading states.",
    },
    "card-7": {
      "id": "card-7",
      "title": "Ship marketing page",
      "details": "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      "id": "card-8",
      "title": "Close onboarding sprint",
      "details": "Document release notes and share internally.",
    },
  },
}


class CardModel(BaseModel):
  id: str = Field(min_length=1)
  title: str = Field(min_length=1)
  details: str


class ColumnModel(BaseModel):
  id: str = Field(min_length=1)
  title: str = Field(min_length=1)
  cardIds: list[str]


class BoardModel(BaseModel):
  columns: list[ColumnModel]
  cards: dict[str, CardModel]

  @model_validator(mode="after")
  def validate_references(self) -> "BoardModel":
    card_ids = set(self.cards.keys())
    for key, card in self.cards.items():
      if card.id != key:
        raise ValueError(f"card key '{key}' must match card.id")

    for column in self.columns:
      for card_id in column.cardIds:
        if card_id not in card_ids:
          raise ValueError(
            f"column '{column.id}' references unknown card id '{card_id}'"
          )

    return self


class BoardResponse(BaseModel):
  username: str
  schemaVersion: int
  board: BoardModel
  updatedAt: str


class AIConnectivityResponse(BaseModel):
  model: str
  prompt: str
  response: str


class AIChatBoardUpdate(BaseModel):
  mode: Literal["replace"]
  reason: str = Field(min_length=1)
  payload: BoardModel


class AIChatRequest(BaseModel):
  prompt: str = Field(min_length=1)
  board: BoardModel


class AIChatResponse(BaseModel):
  model: str = ""
  provider: str = "OpenRouter"
  version: str
  assistantMessage: str = Field(min_length=1)
  boardUpdate: AIChatBoardUpdate | None
  warnings: list[str] = Field(default_factory=list)


def get_db_path() -> Path:
  configured = os.getenv("PM_DB_PATH")
  if configured:
    return Path(configured)

  return Path(__file__).resolve().parents[1] / "data" / "pm.db"


def get_connection() -> sqlite3.Connection:
  db_path = get_db_path()
  db_path.parent.mkdir(parents=True, exist_ok=True)
  connection = sqlite3.connect(db_path)
  connection.row_factory = sqlite3.Row
  connection.execute("PRAGMA foreign_keys = ON;")
  connection.execute("PRAGMA journal_mode = WAL;")
  return connection


def get_or_create_user(connection: sqlite3.Connection, username: str) -> int:
  connection.execute(
    "INSERT OR IGNORE INTO users (username) VALUES (?);",
    (username,),
  )
  row = connection.execute(
    "SELECT id FROM users WHERE username = ?;",
    (username,),
  ).fetchone()
  return int(row["id"])


def ensure_board_row(connection: sqlite3.Connection, user_id: int) -> None:
  payload = json.dumps(DEFAULT_BOARD)
  connection.execute(
    """
    INSERT OR IGNORE INTO boards (user_id, board_json, schema_version)
    VALUES (?, ?, 1);
    """,
    (user_id, payload),
  )


def init_database() -> None:
  with get_connection() as connection:
    connection.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      """
    )
    connection.execute(
      """
      CREATE TABLE IF NOT EXISTS boards (
        user_id INTEGER PRIMARY KEY,
        board_json TEXT NOT NULL CHECK (json_valid(board_json)),
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      """
    )

    user_id = get_or_create_user(connection, DEFAULT_USERNAME)
    ensure_board_row(connection, user_id)
    connection.commit()


def _provider_from_model(model: str) -> str:
  if model.startswith("openai/"):
    return "OpenAI"
  if model.startswith("google/"):
    return "Google"
  return "OpenRouter"


def _safe_chat_response(warning: str, model: str) -> AIChatResponse:
  return AIChatResponse(
    model=model,
    provider=_provider_from_model(model),
    version="1",
    assistantMessage=(
      "I could not produce a valid structured response. "
      "Please try again with a more specific request."
    ),
    boardUpdate=None,
    warnings=[warning],
  )


def _load_board_response(
  connection: sqlite3.Connection, user_id: int, username: str
) -> BoardResponse:
  row = connection.execute(
    """
    SELECT board_json, schema_version, updated_at
    FROM boards
    WHERE user_id = ?;
    """,
    (user_id,),
  ).fetchone()

  return BoardResponse(
    username=username,
    schemaVersion=int(row["schema_version"]),
    board=BoardModel.model_validate(json.loads(row["board_json"])),
    updatedAt=str(row["updated_at"]),
  )


def _build_chat_messages(
  *,
  history: list[dict[str, str]],
  prompt: str,
  board: BoardModel,
) -> list[dict[str, str]]:
  user_payload = json.dumps(
    {
      "userPrompt": prompt,
      "board": board.model_dump(),
    }
  )
  return [
    {"role": "system", "content": CHAT_SYSTEM_INSTRUCTIONS},
    *history,
    {"role": "user", "content": user_payload},
  ]


@app.get("/api/health")
def health() -> dict[str, str]:
  return {"status": "ok", "service": "backend"}


@app.get("/api/board", response_model=BoardResponse)
def get_board(username: str = DEFAULT_USERNAME) -> BoardResponse:
  with get_connection() as connection:
    user_id = get_or_create_user(connection, username)
    ensure_board_row(connection, user_id)
    connection.commit()

    return _load_board_response(connection, user_id, username)


@app.put("/api/board", response_model=BoardResponse)
def save_board(payload: BoardModel, username: str = DEFAULT_USERNAME) -> BoardResponse:
  with get_connection() as connection:
    user_id = get_or_create_user(connection, username)
    board_json = payload.model_dump_json()

    connection.execute(
      """
      INSERT INTO boards (user_id, board_json, schema_version, created_at, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        board_json = excluded.board_json,
        schema_version = excluded.schema_version,
        updated_at = CURRENT_TIMESTAMP;
      """,
      (user_id, board_json),
    )
    connection.commit()

    return _load_board_response(connection, user_id, username)


@app.get("/api/ai/connectivity", response_model=AIConnectivityResponse)
def ai_connectivity_check() -> AIConnectivityResponse:
  try:
    model, answer = run_connectivity_check()
  except OpenRouterConfigError as exc:
    raise HTTPException(status_code=503, detail=str(exc)) from exc
  except OpenRouterUpstreamError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc

  return AIConnectivityResponse(
    model=model,
    prompt=CONNECTIVITY_PROMPT,
    response=answer,
  )


@app.post("/api/ai/chat", response_model=AIChatResponse)
def ai_chat(payload: AIChatRequest, username: str = DEFAULT_USERNAME) -> AIChatResponse:
  history = CHAT_HISTORY_BY_USER.setdefault(username, [])
  outbound_messages = _build_chat_messages(
    history=history,
    prompt=payload.prompt,
    board=payload.board,
  )

  try:
    model_used, raw_response = run_structured_chat(outbound_messages)
  except OpenRouterConfigError as exc:
    raise HTTPException(status_code=503, detail=str(exc)) from exc
  except OpenRouterUpstreamError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc

  try:
    parsed = json.loads(raw_response)
  except json.JSONDecodeError:
    response = _safe_chat_response("Model output was not valid JSON.", model_used)
  else:
    try:
      response = AIChatResponse.model_validate(parsed)
      response.model = model_used
      response.provider = _provider_from_model(model_used)
    except ValidationError:
      response = _safe_chat_response(
        "Model output did not match required response schema.",
        model_used,
      )

  history.extend(
    [
      {"role": "user", "content": payload.prompt},
      {"role": "assistant", "content": response.assistantMessage},
    ]
  )
  if len(history) > MAX_HISTORY_MESSAGES:
    CHAT_HISTORY_BY_USER[username] = history[-MAX_HISTORY_MESSAGES:]

  return response


if FRONTEND_OUT_DIR.exists():
  app.mount("/", StaticFiles(directory=FRONTEND_OUT_DIR, html=True), name="frontend")
else:
  @app.get("/", response_class=HTMLResponse)
  def index() -> str:
    return """<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>PM MVP - Frontend assets missing</title>
    <style>
      body { font-family: Segoe UI, sans-serif; margin: 40px; color: #032147; }
      code { background: #f7f8fb; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>Frontend build not found</h1>
    <p>Expected static assets at <code>/app/frontend/out</code>.</p>
    <p>Build and run through Docker scripts to serve the exported Next.js app.</p>
  </body>
</html>
"""
