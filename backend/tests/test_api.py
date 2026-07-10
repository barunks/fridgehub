import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_familyhub.db"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["CACHE_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-tests"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def auth_headers(client: TestClient, username: str = "meera") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": "familyhub"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def teardown_module() -> None:
    Path("test_familyhub.db").unlink(missing_ok=True)


def test_health_and_bootstrap() -> None:
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        response = client.get("/api/v1/family/bootstrap")
        assert response.status_code == 401

        response = client.get("/api/v1/family/bootstrap", headers=auth_headers(client))
        assert response.status_code == 200
        data = response.json()
        assert data["family"]["familyName"] == "FamilyHub"
        assert len(data["listTypes"]) == 4
        assert len(data["meals"]) == 28


def test_grocery_create_and_cycle_regeneration() -> None:
    with TestClient(app) as client:
        payload = {
            "itemName": "Paneer",
            "listTypeId": 3,
            "quantity": 2,
            "unit": "Pack",
            "purchaseFrequency": "weekly",
            "currentStock": False,
            "notes": "Dinner backup",
        }
        headers = auth_headers(client)
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        assert created.json()["itemName"] == "Paneer"

        child_headers = auth_headers(client, "ava")
        forbidden = client.post("/api/v1/grocery/items", json=payload, headers=child_headers)
        assert forbidden.status_code == 403

        cycles = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert cycles.status_code == 200
        assert len(cycles.json()) >= 1


def test_task_update_and_assistant() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        task = client.patch("/api/v1/tasks/1", json={"status": "completed"}, headers=headers)
        assert task.status_code == 200
        assert task.json()["status"] == "completed"

        answer = client.post(
            "/api/v1/assistant/recommendations",
            json={"query": "Which groceries are urgent?"},
            headers=headers,
        )
        assert answer.status_code == 200
        assert "answer" in answer.json()
        assert len(answer.json()["insights"]) >= 1


def test_refresh_and_logout() -> None:
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub"})
        assert login.status_code == 200
        refreshed = client.post("/api/v1/auth/refresh", json={"refreshToken": login.json()["refreshToken"]})
        assert refreshed.status_code == 200

        headers = {"Authorization": f"Bearer {refreshed.json()['accessToken']}"}
        logout = client.post("/api/v1/auth/logout", headers=headers)
        assert logout.status_code == 200


def test_api_completeness_crud_surfaces() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)

        assert client.get("/api/v1/grocery/master-types", headers=headers).status_code == 200
        assert client.get("/api/v1/grocery/frequency-types", headers=headers).status_code == 200
        assert client.get("/api/v1/notifications", headers=headers).status_code == 200

        member_payload = {
            "name": "Isha",
            "email": "isha@familyhub.local",
            "username": "isha",
            "password": "familyhub",
            "role": "Child",
            "status": "Reading",
            "colorClass": "bg-fuchsia-500",
        }
        member = client.post("/api/v1/family/members", json=member_payload, headers=headers)
        assert member.status_code == 200
        member_id = member.json()["id"]
        patched_member = client.patch(
            f"/api/v1/family/members/{member_id}",
            json={"points": 12},
            headers=headers,
        )
        assert patched_member.status_code == 200
        assert patched_member.json()["points"] == 12

        contact = client.post(
            "/api/v1/family/emergency-contacts",
            json={"label": "Clinic", "value": "1234"},
            headers=headers,
        )
        assert contact.status_code == 200
        contact_id = contact.json()["id"]
        assert client.patch(
            f"/api/v1/family/emergency-contacts/{contact_id}",
            json={"value": "5678"},
            headers=headers,
        ).status_code == 200

        recipe = client.post(
            "/api/v1/meal-plan/recipes",
            json={"recipeName": "Soup", "ingredients": ["carrot"], "dietaryTags": ["quick"]},
            headers=headers,
        )
        assert recipe.status_code == 200
        recipe_id = recipe.json()["id"]
        assert client.patch(
            f"/api/v1/meal-plan/recipes/{recipe_id}",
            json={"servings": 2},
            headers=headers,
        ).status_code == 200
        assert client.delete(f"/api/v1/meal-plan/recipes/{recipe_id}", headers=headers).status_code == 204
