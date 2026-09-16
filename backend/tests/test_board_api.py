from pathlib import Path

from fastapi.testclient import TestClient


def test_db_is_created_on_startup(tmp_path, monkeypatch):
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    from backend.app.main import app

    with TestClient(app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert db_path.exists()


def test_get_board_returns_default_for_first_time_user(tmp_path, monkeypatch):
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    from backend.app.main import app

    with TestClient(app) as client:
        response = client.get("/api/board")

    assert response.status_code == 200
    payload = response.json()
    assert payload["username"] == "user"
    assert payload["schemaVersion"] == 1
    assert len(payload["board"]["columns"]) == 5
    assert "card-1" in payload["board"]["cards"]


def test_put_board_persists_changes(tmp_path, monkeypatch):
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    from backend.app.main import app

    with TestClient(app) as client:
        current = client.get("/api/board")
        assert current.status_code == 200
        board = current.json()["board"]

        board["columns"][0]["title"] = "Planned"
        board["cards"]["card-1"]["title"] = "Updated card title"

        put_response = client.put("/api/board", json=board)
        assert put_response.status_code == 200

        fetch_again = client.get("/api/board")
        assert fetch_again.status_code == 200
        persisted = fetch_again.json()["board"]

    assert persisted["columns"][0]["title"] == "Planned"
    assert persisted["cards"]["card-1"]["title"] == "Updated card title"


def test_put_board_rejects_invalid_payload(tmp_path, monkeypatch):
    db_path = tmp_path / "pm-test.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    from backend.app.main import app

    invalid_board = {
        "columns": [
            {
                "id": "col-backlog",
                "title": "Backlog",
                "cardIds": ["missing-card-id"],
            }
        ],
        "cards": {},
    }

    with TestClient(app) as client:
        response = client.put("/api/board", json=invalid_board)

    assert response.status_code == 422
    details = response.json()["detail"]
    assert isinstance(details, list)
