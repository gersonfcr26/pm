import json

from fastapi.testclient import TestClient

from backend.app import openrouter_client


class DummyResponse:
  def __init__(self, status_code: int, payload: dict, text: str = ""):
    self.status_code = status_code
    self._payload = payload
    self.text = text

  def json(self):
    return self._payload


def _setup_app(tmp_path, monkeypatch):
  db_path = tmp_path / "pm-test.db"
  monkeypatch.setenv("PM_DB_PATH", str(db_path))
  monkeypatch.setenv("OPENROUTER_API_KEY", "primary-key")

  from backend.app import main as main_module

  main_module.CHAT_HISTORY_BY_USER.clear()
  return main_module.app, main_module


def _get_board_payload(client: TestClient) -> dict:
  board_response = client.get("/api/board")
  assert board_response.status_code == 200
  return board_response.json()["board"]


def _chat_body(board: dict, prompt: str) -> dict:
  return {
    "prompt": prompt,
    "board": board,
  }


def test_chat_valid_structured_output_parses_successfully(tmp_path, monkeypatch):
  app, _ = _setup_app(tmp_path, monkeypatch)

  def fake_post(url, headers, json, timeout):
    board = json_module.loads(json["messages"][-1]["content"])["board"]
    updated_board = {
      **board,
      "columns": [
        {**column, "cardIds": [cid for cid in column["cardIds"] if cid != "card-1"]}
        if column["id"] != "col-progress"
        else {**column, "cardIds": [*column["cardIds"], "card-1"]}
        for column in board["columns"]
      ],
    }
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": json_module.dumps(
                {
                  "version": "1",
                  "assistantMessage": "Done.",
                  "boardUpdate": {
                    "mode": "replace",
                    "reason": "Move card for priority",
                    "payload": updated_board,
                  },
                  "warnings": [],
                }
              ),
            }
          }
        ]
      },
    )

  json_module = json
  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  with TestClient(app) as client:
    board = _get_board_payload(client)
    response = client.post("/api/ai/chat", json=_chat_body(board, "Move one card"))

  assert response.status_code == 200
  payload = response.json()
  assert payload["model"] == "openai/gpt-oss-20b:free"
  assert payload["provider"] == "OpenAI"
  assert payload["version"] == "1"
  assert payload["assistantMessage"] == "Done."
  assert payload["boardUpdate"]["mode"] == "replace"


def test_chat_malformed_output_returns_safe_fallback(tmp_path, monkeypatch):
  app, _ = _setup_app(tmp_path, monkeypatch)

  def fake_post(url, headers, json, timeout):
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": "not-json",
            }
          }
        ]
      },
    )

  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  with TestClient(app) as client:
    board = _get_board_payload(client)
    response = client.post("/api/ai/chat", json=_chat_body(board, "Do something"))

  assert response.status_code == 200
  payload = response.json()
  assert payload["model"] == "openai/gpt-oss-20b:free"
  assert payload["provider"] == "OpenAI"
  assert payload["boardUpdate"] is None
  assert payload["warnings"]
  assert "not valid JSON" in payload["warnings"][0]


def test_chat_board_update_null_path_returns_chat_only(tmp_path, monkeypatch):
  app, _ = _setup_app(tmp_path, monkeypatch)

  def fake_post(url, headers, json, timeout):
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": '{"version":"1","assistantMessage":"No changes needed.","boardUpdate":null,"warnings":[]}',
            }
          }
        ]
      },
    )

  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  with TestClient(app) as client:
    board = _get_board_payload(client)
    response = client.post(
      "/api/ai/chat",
      json=_chat_body(board, "Do I need to change anything?"),
    )

  assert response.status_code == 200
  payload = response.json()
  assert payload["assistantMessage"] == "No changes needed."
  assert payload["boardUpdate"] is None


def test_chat_history_is_included_in_outbound_model_payload(tmp_path, monkeypatch):
  app, main_module = _setup_app(tmp_path, monkeypatch)
  outbound_payloads: list[dict] = []

  def fake_post(url, headers, json, timeout):
    outbound_payloads.append(json)
    call_index = len(outbound_payloads)
    assistant_message = "First response" if call_index == 1 else "Second response"
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": json_module.dumps(
                {
                  "version": "1",
                  "assistantMessage": assistant_message,
                  "boardUpdate": None,
                  "warnings": [],
                }
              ),
            }
          }
        ]
      },
    )

  json_module = json
  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  with TestClient(app) as client:
    board = _get_board_payload(client)
    first = client.post("/api/ai/chat", json=_chat_body(board, "First prompt"))
    assert first.status_code == 200

    second = client.post("/api/ai/chat", json=_chat_body(board, "Second prompt"))
    assert second.status_code == 200

  second_messages = outbound_payloads[1]["messages"]
  assert any(
    message["role"] == "user" and message["content"] == "First prompt"
    for message in second_messages
  )
  assert any(
    message["role"] == "assistant" and message["content"] == "First response"
    for message in second_messages
  )
  assert "user" in main_module.CHAT_HISTORY_BY_USER