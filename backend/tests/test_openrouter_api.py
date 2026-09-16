from fastapi.testclient import TestClient

from backend.app import openrouter_client


class DummyResponse:
  def __init__(self, status_code: int, payload: dict, text: str = ""):
    self.status_code = status_code
    self._payload = payload
    self.text = text

  def json(self):
    return self._payload


def test_connectivity_endpoint_returns_clear_error_when_api_key_missing(tmp_path, monkeypatch):
  db_path = tmp_path / "pm-test.db"
  monkeypatch.setenv("PM_DB_PATH", str(db_path))
  monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

  from backend.app.main import app

  with TestClient(app) as client:
    response = client.get("/api/ai/connectivity")

  assert response.status_code == 503
  assert "OPENROUTER_API_KEY is not configured" in response.json()["detail"]


def test_run_connectivity_check_returns_non_empty_response(monkeypatch):
  monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
  monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")

  def fake_post(url, headers, json, timeout):
    assert "Bearer test-key" == headers["Authorization"]
    assert "2+2" in json["messages"][0]["content"]
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": "4",
            }
          }
        ]
      },
    )

  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  model, answer = openrouter_client.run_connectivity_check()

  assert model == "openai/gpt-oss-20b:free"
  assert answer.strip()


def test_connectivity_endpoint_proxies_provider_response(tmp_path, monkeypatch):
  db_path = tmp_path / "pm-test.db"
  monkeypatch.setenv("PM_DB_PATH", str(db_path))
  monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

  def fake_post(url, headers, json, timeout):
    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": "4",
            }
          }
        ]
      },
    )

  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  from backend.app.main import app

  with TestClient(app) as client:
    response = client.get("/api/ai/connectivity")

  assert response.status_code == 200
  payload = response.json()
  assert payload["model"] == "openai/gpt-oss-20b:free"
  assert "2+2" in payload["prompt"]
  assert payload["response"].strip()


def test_run_connectivity_check_falls_back_to_second_model_on_429(monkeypatch):
  monkeypatch.setenv("OPENROUTER_API_KEY", "primary-key")
  monkeypatch.setenv("OPENROUTER_API_KEY_2", "secondary-key")
  monkeypatch.setenv("OPENROUTER_MODEL", "openai/gpt-oss-20b:free")

  calls: list[tuple[str, str]] = []

  def fake_post(url, headers, json, timeout):
    calls.append((headers["Authorization"], json["model"]))

    if len(calls) == 1:
      return DummyResponse(429, {"error": "rate_limited"}, text="rate limited")

    return DummyResponse(
      200,
      {
        "choices": [
          {
            "message": {
              "content": "4",
            }
          }
        ]
      },
    )

  monkeypatch.setattr(openrouter_client.httpx, "post", fake_post)

  model, answer = openrouter_client.run_connectivity_check()

  assert calls[0] == ("Bearer primary-key", "openai/gpt-oss-20b:free")
  assert calls[1] == (
    "Bearer secondary-key",
    "google/gemma-4-26b-a4b-it:free",
  )
  assert model == "google/gemma-4-26b-a4b-it:free"
  assert answer.strip() == "4"