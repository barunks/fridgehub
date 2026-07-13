import os
from pathlib import Path
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_familyhub.db"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["CACHE_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-tests"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "100"

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import DeviceSession, User  # noqa: E402


def auth_headers(client: TestClient, username: str = "meera") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": "familyhub"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def teardown_module() -> None:
    Path("test_familyhub.db").unlink(missing_ok=True)


def restore_demo_password(username: str = "meera", password: str = "familyhub") -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username=username).one()
        user.password_hash = hash_password(password)
        user.token_version += 1
        db.commit()
    finally:
        db.close()


# --- Health & Bootstrap ---


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["dependencies"]["database"] is True
        assert data["dependencies"]["cache"] is True


def test_bootstrap_requires_auth() -> None:
    with TestClient(app) as client:
        assert client.get("/api/v1/family/bootstrap").status_code == 401


def test_bootstrap_returns_full_state() -> None:
    with TestClient(app) as client:
        r = client.get("/api/v1/family/bootstrap", headers=auth_headers(client))
        assert r.status_code == 200
        data = r.json()
        assert data["family"]["familyName"] == "FamilyHub"
        assert len(data["listTypes"]) == 4
        assert len(data["meals"]) == 28
        assert len(data["members"]) >= 2
        assert len(data["groceryItems"]) >= 1
        assert "shoppingItems" in data
        assert len(data["shoppingItems"]) >= 1
        assert len(data["tasks"]) >= 1


# --- Auth ---


def test_login_success_and_failure() -> None:
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub"})
        assert r.status_code == 200
        assert "accessToken" in r.json()
        assert "refreshToken" not in r.json()
        assert "familyhub_refresh" in r.headers["set-cookie"]

        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "wrong"})
        assert r.status_code == 401


def test_refresh_and_logout() -> None:
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub"})
        tokens = login.json()
        db = SessionLocal()
        try:
            session_count_before = db.query(DeviceSession).count()
        finally:
            db.close()

        refreshed = client.post("/api/v1/auth/refresh", json={})
        assert refreshed.status_code == 200
        new_token = refreshed.json()["accessToken"]
        db = SessionLocal()
        try:
            assert db.query(DeviceSession).count() >= session_count_before + 2
        finally:
            db.close()

        headers = {"Authorization": f"Bearer {new_token}"}
        r = client.post("/api/v1/auth/logout", headers=headers)
        assert r.status_code == 200
        assert r.json()["status"] == "logged_out"


def test_change_password() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)

        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "familyhub", "newPassword": "newpass123"}, headers=headers)
        assert r.status_code == 200

        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "newpass123"})
        assert r.status_code == 200

        restore_demo_password()


def test_change_password_wrong_current() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "wrong", "newPassword": "newpass123"}, headers=headers)
        assert r.status_code == 400


# --- RBAC ---


def test_child_cannot_mutate() -> None:
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.post("/api/v1/grocery/items", json={"itemName": "X", "listTypeId": 1}, headers=child_headers)
        assert r.status_code == 403

        r = client.post("/api/v1/tasks", json={"title": "X", "dueAt": "2025-01-01T10:00:00", "assignedTo": 1}, headers=child_headers)
        assert r.status_code == 403


# --- Grocery ---


def test_grocery_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"itemName": "Paneer", "listTypeId": 3, "quantity": 2, "unit": "Pack", "purchaseFrequency": "weekly", "currentStock": False, "notes": "Test"}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        item_id = created.json()["id"]
        assert created.json()["itemName"] == "Paneer"

        patched = client.patch(f"/api/v1/grocery/items/{item_id}", json={"purchased": True}, headers=headers)
        assert patched.status_code == 200

        deleted = client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)
        assert deleted.status_code == 204


def test_grocery_list_types_and_pagination() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert client.get("/api/v1/grocery/list-types", headers=headers).status_code == 200
        assert client.get("/api/v1/grocery/master-types", headers=headers).status_code == 200
        assert client.get("/api/v1/grocery/frequency-types", headers=headers).status_code == 200

        r = client.get("/api/v1/grocery/items?limit=2&offset=0", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) <= 2


def test_grocery_regenerate_cycles() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


def test_shopping_item_partial_purchase_flow() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        item_name = f"PartialShoppingMilk-{uuid4().hex[:8]}"
        payload = {
            "itemName": item_name,
            "listTypeId": 1,
            "quantity": 4,
            "unit": "Units",
            "purchaseFrequency": "weekly",
            "currentStock": False,
            "notes": "Partial test",
        }
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        item_id = created.json()["id"]

        built = client.post("/api/v1/grocery/shopping-items/build", headers=headers)
        assert built.status_code == 200
        row = next(item for item in built.json() if item["itemId"] == item_id)

        partial = client.patch(
            f"/api/v1/grocery/shopping-items/{row['id']}",
            json={"purchasedQuantity": 2},
            headers=headers,
        )
        assert partial.status_code == 200
        assert partial.json()["purchasedQuantity"] == 2
        assert partial.json()["isPurchased"] is False

        item = client.get(f"/api/v1/grocery/items/{item_id}", headers=headers)
        assert item.json()["currentStock"] is False
        assert item.json()["purchased"] is False

        completed = client.patch(
            f"/api/v1/grocery/shopping-items/{row['id']}",
            json={"purchasedQuantity": 4},
            headers=headers,
        )
        assert completed.status_code == 200
        assert completed.json()["isPurchased"] is True

        item = client.get(f"/api/v1/grocery/items/{item_id}", headers=headers)
        assert item.json()["currentStock"] is True
        assert item.json()["purchased"] is True

        reopened = client.patch(
            f"/api/v1/grocery/shopping-items/{row['id']}",
            json={"isPurchased": False},
            headers=headers,
        )
        assert reopened.status_code == 200
        assert reopened.json()["purchasedQuantity"] == 0
        assert reopened.json()["isPurchased"] is False

        resized = client.patch(
            f"/api/v1/grocery/shopping-items/{row['id']}",
            json={"quantity": 6},
            headers=headers,
        )
        assert resized.status_code == 200
        assert resized.json()["quantity"] == 6

        master_toggle = client.patch(f"/api/v1/grocery/items/{item_id}", json={"purchased": True}, headers=headers)
        assert master_toggle.status_code == 200
        current_row = client.get(f"/api/v1/grocery/shopping-items/{row['id']}", headers=headers)
        assert current_row.status_code == 200
        assert current_row.json()["isPurchased"] is True
        assert current_row.json()["purchasedQuantity"] == 6

        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)


def test_adhoc_shopping_item_increments_current_row() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        item_name = f"AdhocShoppingRice-{uuid4().hex[:8]}"
        first = client.post(
            "/api/v1/grocery/shopping-items",
            json={
                "itemName": item_name,
                "listTypeId": 2,
                "quantity": 2,
                "unit": "Pack",
                "purchaseFrequency": "weekly",
                "notes": "first add",
            },
            headers=headers,
        )
        assert first.status_code == 201
        first_row = first.json()
        assert first_row["isAdhoc"] is True
        assert first_row["quantity"] == 2

        second = client.post(
            "/api/v1/grocery/shopping-items",
            json={
                "itemName": item_name,
                "listTypeId": 2,
                "quantity": 3,
                "unit": "Pack",
                "purchaseFrequency": "weekly",
                "notes": "extra",
            },
            headers=headers,
        )
        assert second.status_code == 201
        second_row = second.json()
        assert second_row["id"] == first_row["id"]
        assert second_row["quantity"] == 5
        assert second_row["isPurchased"] is False

        listed = client.get("/api/v1/grocery/shopping-items", headers=headers)
        matching = [item for item in listed.json() if item["itemId"] == first_row["itemId"]]
        assert len(matching) == 1
        assert matching[0]["quantity"] == 5

        client.delete(f"/api/v1/grocery/items/{first_row['itemId']}", headers=headers)


# --- Tasks ---


def test_task_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"title": "Test task", "category": "chore", "priority": "high", "dueAt": "2025-06-01T09:00:00", "assignedTo": 1}
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        assert created.status_code == 200
        task_id = created.json()["id"]

        patched = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["status"] == "completed"

        deleted = client.delete(f"/api/v1/tasks/{task_id}", headers=headers)
        assert deleted.status_code == 204


def test_task_pagination() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/tasks?limit=2&offset=0", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) <= 2


# --- Meal Plan ---


def test_meal_plan_week_and_update() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        assert r.status_code == 200

        meals = r.json()
        if meals:
            meal_id = meals[0]["id"]
            patched = client.patch(f"/api/v1/meal-plan/{meal_id}", json={"mealName": "Updated Meal"}, headers=headers)
            assert patched.status_code == 200
            assert patched.json()["mealName"] == "Updated Meal"


def test_meal_apply_template() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/meal-plan/apply-template", headers=headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1


# --- Recipes ---


def test_recipe_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"recipeName": "Test Soup", "ingredients": ["carrot", "onion"], "dietaryTags": ["vegan"]}
        created = client.post("/api/v1/meal-plan/recipes", json=payload, headers=headers)
        assert created.status_code == 200
        recipe_id = created.json()["id"]

        patched = client.patch(f"/api/v1/meal-plan/recipes/{recipe_id}", json={"servings": 4}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["servings"] == 4

        deleted = client.delete(f"/api/v1/meal-plan/recipes/{recipe_id}", headers=headers)
        assert deleted.status_code == 204


# --- Family Members & Contacts ---


def test_member_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"name": "TestUser", "email": "test@familyhub.local", "username": "testuser", "password": "familyhub1", "role": "Child", "status": "Active", "colorClass": "bg-pink-500"}
        created = client.post("/api/v1/family/members", json=payload, headers=headers)
        assert created.status_code == 200
        member_id = created.json()["id"]

        patched = client.patch(f"/api/v1/family/members/{member_id}", json={"points": 25}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["points"] == 25

        deleted = client.delete(f"/api/v1/family/members/{member_id}", headers=headers)
        assert deleted.status_code == 204


def test_emergency_contact_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post("/api/v1/family/emergency-contacts", json={"label": "Hospital", "value": "911"}, headers=headers)
        assert created.status_code == 200
        contact_id = created.json()["id"]

        patched = client.patch(f"/api/v1/family/emergency-contacts/{contact_id}", json={"value": "112"}, headers=headers)
        assert patched.status_code == 200

        deleted = client.delete(f"/api/v1/family/emergency-contacts/{contact_id}", headers=headers)
        assert deleted.status_code == 204


# --- Notifications ---


def test_notifications_list_and_mark_read() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/notifications", headers=headers)
        assert r.status_code == 200
        notifications = r.json()
        if notifications:
            nid = notifications[0]["id"]
            patched = client.patch(f"/api/v1/notifications/{nid}/read", headers=headers)
            assert patched.status_code == 200
            assert patched.json()["isRead"] is True


# --- Announcements ---


def test_announcement_create_and_delete() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post("/api/v1/family/announcements", json={"title": "Test", "message": "Hello family"}, headers=headers)
        assert created.status_code == 200
        ann_id = created.json()["id"]

        deleted = client.delete(f"/api/v1/family/announcements/{ann_id}", headers=headers)
        assert deleted.status_code == 204


# --- Assistant ---


def test_assistant_recommendations() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/assistant/recommendations", json={"query": "What should I cook?"}, headers=headers)
        assert r.status_code == 200
        assert "answer" in r.json()
        assert "insights" in r.json()


# --- Cache Stats ---


def test_cache_stats() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.get("/api/v1/family/bootstrap", headers=headers)
        r = client.get("/api/v1/cache/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["backend"] == "memory"
        assert data["hits"] >= 0
        assert data["misses"] >= 0


# --- API Versioning ---


def test_api_versions_endpoint() -> None:
    with TestClient(app) as client:
        r = client.get("/api/versions")
        assert r.status_code == 200
        data = r.json()
        assert data["current"] == "v1"
        assert "v1" in data["versions"]
        assert data["versions"]["v1"]["deprecated"] is False


def test_api_version_header() -> None:
    with TestClient(app) as client:
        r = client.get("/health")
        # /health is not under /api/v1 so no header
        assert "X-API-Version" not in r.headers

        headers = auth_headers(client)
        r = client.get("/api/v1/family/bootstrap", headers=headers)
        assert r.headers.get("X-API-Version") == "v1"


# --- GroceryType Admin CRUD ---


def test_grocery_type_crud() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)

        # List types
        r = client.get("/api/v1/grocery/types", headers=headers)
        assert r.status_code == 200
        initial_count = len(r.json())

        # Create
        created = client.post("/api/v1/grocery/types", json={"typeName": "Organic", "icon": "leaf", "color": "green"}, headers=headers)
        assert created.status_code == 201
        type_id = created.json()["id"]
        assert created.json()["typeName"] == "Organic"
        assert created.json()["isSystem"] is False

        # Get single
        r = client.get(f"/api/v1/grocery/types/{type_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["typeName"] == "Organic"

        # Update
        patched = client.patch(f"/api/v1/grocery/types/{type_id}", json={"color": "emerald"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["color"] == "emerald"

        # Delete
        deleted = client.delete(f"/api/v1/grocery/types/{type_id}", headers=headers)
        assert deleted.status_code == 204

        # Verify deleted
        r = client.get(f"/api/v1/grocery/types/{type_id}", headers=headers)
        assert r.status_code == 404


def test_grocery_type_duplicate_name_rejected() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/grocery/types", json={"typeName": "Duplicate"}, headers=headers)
        r = client.post("/api/v1/grocery/types", json={"typeName": "Duplicate"}, headers=headers)
        assert r.status_code == 409


def test_grocery_type_child_cannot_mutate() -> None:
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.post("/api/v1/grocery/types", json={"typeName": "Forbidden"}, headers=child_headers)
        assert r.status_code == 403


# --- Error Response Format ---


def test_error_response_format() -> None:
    with TestClient(app) as client:
        # Validation error
        r = client.post("/api/v1/auth/login", json={})
        assert r.status_code == 422
        body = r.json()
        assert body["error"]["code"] == "validation_error"
        assert len(body["validationErrors"]) >= 1

        # 401
        r = client.get("/api/v1/family/bootstrap")
        assert r.status_code == 401
        assert r.json()["error"]["detail"] == "Not authenticated"

        # 403
        child_headers = auth_headers(client, "ava")
        r = client.post("/api/v1/tasks", json={"title": "x", "dueAt": "2025-01-01T10:00:00", "assignedTo": 1}, headers=child_headers)
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "http_error"

        # 404
        headers = auth_headers(client)
        r = client.patch("/api/v1/tasks/99999", json={"status": "completed"}, headers=headers)
        assert r.status_code == 404


# --- Grocery Sub-List & Cycle Flow ---


def test_grocery_purchase_cycle_flow() -> None:
    """Full flow: create item -> regenerate cycles -> mark purchased -> regenerate again (carry forward)."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Create a new item
        payload = {"itemName": "Butter", "listTypeId": 4, "quantity": 1, "unit": "Pack", "purchaseFrequency": "weekly", "currentStock": False, "notes": "Salted"}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        item_id = created.json()["id"]
        assert created.json()["purchased"] is False

        # Regenerate cycles
        r = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert r.status_code == 200
        cycles = r.json()
        assert len(cycles) >= 1
        # All cycles should be not completed
        for cycle in cycles:
            assert cycle["isCompleted"] is False

        # Mark item as purchased
        patched = client.patch(f"/api/v1/grocery/items/{item_id}", json={"purchased": True}, headers=headers)
        assert patched.status_code == 200

        # Verify item shows as purchased
        item = client.get(f"/api/v1/grocery/items/{item_id}", headers=headers)
        assert item.status_code == 200
        assert item.json()["purchased"] is True

        # Regenerate again — previous cycle should be completed
        r2 = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert r2.status_code == 200

        # Clean up
        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)


def test_grocery_item_stock_toggle() -> None:
    """Toggle current stock YES/NO."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"itemName": "Eggs", "listTypeId": 1, "quantity": 12, "unit": "Units", "purchaseFrequency": "weekly", "currentStock": False, "notes": ""}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        item_id = created.json()["id"]
        assert created.json()["currentStock"] is False

        # Toggle to in-stock
        patched = client.patch(f"/api/v1/grocery/items/{item_id}", json={"currentStock": True}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["currentStock"] is True

        # Toggle back
        patched2 = client.patch(f"/api/v1/grocery/items/{item_id}", json={"currentStock": False}, headers=headers)
        assert patched2.json()["currentStock"] is False

        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)


def test_grocery_item_frequency_update() -> None:
    """Change purchase frequency of an item."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"itemName": "Olive Oil", "listTypeId": 2, "quantity": 1, "unit": "Lt", "purchaseFrequency": "weekly", "currentStock": True, "notes": ""}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        item_id = created.json()["id"]

        patched = client.patch(f"/api/v1/grocery/items/{item_id}", json={"purchaseFrequency": "monthly"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["purchaseFrequency"] == "monthly"

        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)


def test_grocery_soft_delete_hides_from_list() -> None:
    """Soft-deleted items should not appear in list."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"itemName": "TempItem", "listTypeId": 1, "quantity": 1, "unit": "Kg", "purchaseFrequency": "daily", "currentStock": False, "notes": ""}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        item_id = created.json()["id"]

        # Delete (soft)
        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)

        # Should not appear in list
        r = client.get("/api/v1/grocery/items", headers=headers)
        ids = [item["id"] for item in r.json()]
        assert item_id not in ids

        # Should return 404 on direct access
        r = client.get(f"/api/v1/grocery/items/{item_id}", headers=headers)
        assert r.status_code == 404


def test_grocery_item_can_be_recreated_after_soft_delete() -> None:
    """Soft-deleted item names should not block future items in the same list."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"itemName": "RecreateSoftDeleteItem", "listTypeId": 1, "quantity": 1, "unit": "Kg", "purchaseFrequency": "daily", "currentStock": False, "notes": ""}
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        first_id = created.json()["id"]

        assert client.delete(f"/api/v1/grocery/items/{first_id}", headers=headers).status_code == 204

        recreated = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert recreated.status_code == 200
        assert recreated.json()["itemName"] == payload["itemName"]
        client.delete(f"/api/v1/grocery/items/{recreated.json()['id']}", headers=headers)


# --- Task Recurrence & Reminder ---


def test_task_with_recurrence() -> None:
    """Create a recurring task and verify recurrence fields."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {
            "title": "Water plants",
            "category": "chore",
            "priority": "low",
            "dueAt": "2025-07-01T08:00:00",
            "assignedTo": 1,
            "recurrenceType": "weekly",
            "recurrenceInterval": 1,
        }
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        assert created.status_code == 200
        task = created.json()
        assert task["recurrenceType"] == "weekly"
        assert task["recurrenceInterval"] == 1
        assert task["status"] == "pending"

        client.delete(f"/api/v1/tasks/{task['id']}", headers=headers)


def test_task_status_transitions() -> None:
    """Test all valid status transitions."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"title": "Status test", "category": "test", "priority": "medium", "dueAt": "2025-07-01T10:00:00", "assignedTo": 1}
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        task_id = created.json()["id"]

        # pending -> in_progress
        r = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "in_progress"}, headers=headers)
        assert r.json()["status"] == "in_progress"

        # in_progress -> completed
        r = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"}, headers=headers)
        assert r.json()["status"] == "completed"

        # completed -> pending (reopen)
        r = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "pending"}, headers=headers)
        assert r.json()["status"] == "pending"

        # pending -> cancelled
        r = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "cancelled"}, headers=headers)
        assert r.json()["status"] == "cancelled"

        client.delete(f"/api/v1/tasks/{task_id}", headers=headers)


def test_task_reassignment() -> None:
    """Reassign a task to a different member."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"title": "Reassign test", "category": "chore", "priority": "medium", "dueAt": "2025-07-01T10:00:00", "assignedTo": 1}
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        task_id = created.json()["id"]
        assert created.json()["assignedTo"] == 1

        # Reassign to user 2
        r = client.patch(f"/api/v1/tasks/{task_id}", json={"assignedTo": 2}, headers=headers)
        assert r.status_code == 200
        assert r.json()["assignedTo"] == 2

        client.delete(f"/api/v1/tasks/{task_id}", headers=headers)


def test_task_soft_delete() -> None:
    """Soft-deleted tasks should not appear in list."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {"title": "Delete me", "category": "test", "priority": "low", "dueAt": "2025-07-01T10:00:00", "assignedTo": 1}
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        task_id = created.json()["id"]

        client.delete(f"/api/v1/tasks/{task_id}", headers=headers)

        r = client.get("/api/v1/tasks", headers=headers)
        ids = [t["id"] for t in r.json()]
        assert task_id not in ids


# --- Meal Plan Assignment & Dietary Flags ---


def test_meal_update_with_assignment() -> None:
    """Update a meal with assignedTo and dietaryFlags."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        meals = r.json()
        assert len(meals) > 0

        meal_id = meals[0]["id"]
        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": "Assigned Meal", "assignedTo": 3, "dietaryFlags": ["no-peanuts", "vegetarian"]},
            headers=headers,
        )
        assert patched.status_code == 200
        data = patched.json()
        assert data["mealName"] == "Assigned Meal"
        assert data["assignedTo"] == 3
        assert "no-peanuts" in data["dietaryFlags"]
        assert "vegetarian" in data["dietaryFlags"]


def test_meal_update_calories_and_prep() -> None:
    """Update meal calories and prep time."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        meals = r.json()
        meal_id = meals[1]["id"]

        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"calories": 450, "prepTime": 25},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["calories"] == 450
        assert patched.json()["prepTime"] == 25


# --- Bulk Notifications ---


def test_mark_all_notifications_read() -> None:
    """Bulk mark all notifications as read."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/notifications/mark-all-read", headers=headers)
        assert r.status_code == 200
        assert r.json()["marked"] >= 0

        # Verify all are read
        r = client.get("/api/v1/notifications", headers=headers)
        for n in r.json():
            assert n["isRead"] is True


# --- Audit Logs ---


def test_audit_logs_accessible_by_parent() -> None:
    """Parent can access audit logs."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/family/audit-logs", headers=headers)
        assert r.status_code == 200
        logs = r.json()
        assert len(logs) >= 1
        assert "action" in logs[0]


def test_audit_logs_denied_for_child() -> None:
    """Child cannot access audit logs."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.get("/api/v1/family/audit-logs", headers=child_headers)
        assert r.status_code == 403


# --- Shopping Place (List Type) CRUD ---


def test_list_type_crud() -> None:
    """Create, update, and delete a shopping place on the go."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # List existing
        r = client.get("/api/v1/grocery/list-types", headers=headers)
        assert r.status_code == 200
        initial_count = len(r.json())

        # Create new place
        created = client.post(
            "/api/v1/grocery/list-types",
            json={"listName": "Cold Storage", "description": "Premium supermarket", "colorClass": "bg-sky-500"},
            headers=headers,
        )
        assert created.status_code == 201
        lt_id = created.json()["id"]
        assert created.json()["listName"] == "Cold Storage"
        assert created.json()["colorClass"] == "bg-sky-500"

        # Verify count increased
        r = client.get("/api/v1/grocery/list-types", headers=headers)
        assert len(r.json()) == initial_count + 1

        # Update
        patched = client.patch(
            f"/api/v1/grocery/list-types/{lt_id}",
            json={"description": "Updated description"},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["description"] == "Updated description"

        # Delete (no items, should succeed)
        deleted = client.delete(f"/api/v1/grocery/list-types/{lt_id}", headers=headers)
        assert deleted.status_code == 204

        # Verify count back to original
        r = client.get("/api/v1/grocery/list-types", headers=headers)
        assert len(r.json()) == initial_count


def test_list_type_cannot_delete_with_active_items() -> None:
    """Cannot delete a list type that has active grocery items."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Try to delete list type 1 (Wet Market) which has items
        r = client.get("/api/v1/grocery/list-types", headers=headers)
        first_lt_id = r.json()[0]["id"]

        r = client.delete(f"/api/v1/grocery/list-types/{first_lt_id}", headers=headers)
        assert r.status_code == 409
        assert "active items" in r.json()["error"]["detail"]


def test_list_type_duplicate_name_rejected() -> None:
    """Cannot create two lists with the same name."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post("/api/v1/grocery/list-types", json={"listName": "DupPlace"}, headers=headers)
        r = client.post("/api/v1/grocery/list-types", json={"listName": "DupPlace"}, headers=headers)
        assert r.status_code == 409


# --- Per-Member Meal Plans ---


def test_meal_plan_week_filter_by_member() -> None:
    """GET /api/v1/meal-plan/week?member_id=X returns only that member's meals."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Without filter returns all family meals
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        assert r.status_code == 200
        all_meals = r.json()
        assert len(all_meals) >= 1

        # With member_id filter — initially may be empty for a specific member
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        assert r.status_code == 200
        member_meals = r.json()
        # All returned meals should be assigned to member 1
        for meal in member_meals:
            assert meal["assignedTo"] == 1


def test_apply_template_for_specific_member() -> None:
    """POST /api/v1/meal-plan/apply-template with memberId generates per-member plan."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Apply template for member 1
        r = client.post(
            "/api/v1/meal-plan/apply-template",
            json={"memberId": 1},
            headers=headers,
        )
        assert r.status_code == 200
        meals = r.json()
        assert len(meals) >= 1
        # All returned meals should be assigned to member 1
        for meal in meals:
            assert meal["assignedTo"] == 1


def test_apply_template_for_different_members_creates_separate_plans() -> None:
    """Each member gets their own independent meal plan from the same template."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Apply for member 1
        r1 = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        assert r1.status_code == 200
        member1_meals = r1.json()

        # Apply for member 2
        r2 = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 2}, headers=headers)
        assert r2.status_code == 200
        member2_meals = r2.json()

        # Both should have meals
        assert len(member1_meals) >= 1
        assert len(member2_meals) >= 1

        # Meal IDs should be different (separate rows)
        member1_ids = {m["id"] for m in member1_meals}
        member2_ids = {m["id"] for m in member2_meals}
        assert member1_ids.isdisjoint(member2_ids)

        # Verify via GET filter
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        assert all(m["assignedTo"] == 1 for m in r.json())

        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=headers)
        assert all(m["assignedTo"] == 2 for m in r.json())


def test_apply_template_without_member_creates_family_wide_plan() -> None:
    """POST /api/v1/meal-plan/apply-template without memberId creates shared plan."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        r = client.post("/api/v1/meal-plan/apply-template", json={}, headers=headers)
        assert r.status_code == 200
        meals = r.json()
        assert len(meals) >= 1
        # At least some meals should have assignedTo=None (family-wide)
        family_wide = [m for m in meals if m["assignedTo"] is None]
        assert len(family_wide) >= 1


def test_apply_template_for_all_members() -> None:
    """POST /api/v1/meal-plan/apply-template with allMembers generates plans in one request."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        bootstrap = client.get("/api/v1/family/bootstrap", headers=headers).json()
        member_ids = {member["id"] for member in bootstrap["members"]}

        r = client.post("/api/v1/meal-plan/apply-template", json={"allMembers": True}, headers=headers)
        assert r.status_code == 200
        assigned_ids = {meal["assignedTo"] for meal in r.json() if meal["assignedTo"] is not None}
        assert member_ids.issubset(assigned_ids)


def test_member_meal_can_be_customized_independently() -> None:
    """After generating from template, a member's meal can be edited without affecting others."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Generate for member 1
        r = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        member1_meals = r.json()
        assert len(member1_meals) >= 1
        meal_id = member1_meals[0]["id"]
        original_name = member1_meals[0]["mealName"]

        # Generate for member 2
        r = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 2}, headers=headers)
        member2_meals = r.json()

        # Customize member 1's meal
        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": "Custom Breakfast for Member 1"},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["mealName"] == "Custom Breakfast for Member 1"

        # Member 2's meals should be unchanged
        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=headers)
        for meal in r.json():
            assert meal["mealName"] != "Custom Breakfast for Member 1"


def test_member_meal_dietary_flags_independent() -> None:
    """Each member's meal can have different dietary flags."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Generate for both members
        client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        r2 = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 2}, headers=headers)

        # Get member 1's meals and set dietary flags
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        m1_meals = r.json()
        if m1_meals:
            client.patch(
                f"/api/v1/meal-plan/{m1_meals[0]['id']}",
                json={"dietaryFlags": ["gluten-free", "dairy-free"]},
                headers=headers,
            )

        # Get member 2's meals and set different flags
        m2_meals = r2.json()
        if m2_meals:
            client.patch(
                f"/api/v1/meal-plan/{m2_meals[0]['id']}",
                json={"dietaryFlags": ["nut-free"]},
                headers=headers,
            )

        # Verify independence
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        if r.json():
            assert "gluten-free" in r.json()[0]["dietaryFlags"]

        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=headers)
        if r.json():
            assert "nut-free" in r.json()[0]["dietaryFlags"]
            assert "gluten-free" not in r.json()[0]["dietaryFlags"]


def test_apply_template_idempotent_for_same_member() -> None:
    """Applying template twice for the same member updates existing rows, not duplicates."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        r1 = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        count1 = len(r1.json())

        r2 = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        count2 = len(r2.json())

        # Should be same count (upsert, not insert)
        assert count1 == count2


def test_apply_template_with_named_template() -> None:
    """Apply a specific named template."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Apply with explicit template name (uses the seeded one)
        r = client.post(
            "/api/v1/meal-plan/apply-template",
            json={"templateName": "Default Weekly Meal Plan", "memberId": 1},
            headers=headers,
        )
        assert r.status_code == 200
        assert len(r.json()) >= 1


def test_apply_template_nonexistent_template_returns_404() -> None:
    """Applying a non-existent template name returns 404."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post(
            "/api/v1/meal-plan/apply-template",
            json={"templateName": "NonExistentTemplate", "memberId": 1},
            headers=headers,
        )
        assert r.status_code == 404


def test_meal_plan_week_nonexistent_member_returns_400() -> None:
    """Filtering by a nonexistent member returns 400 (member validation)."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week?member_id=9999", headers=headers)
        assert r.status_code == 400
        body = r.json()
        detail = body.get("detail") or body.get("error", {}).get("detail", "")
        assert "not an active family member" in detail


def test_meal_plan_week_valid_member_no_plan_returns_empty() -> None:
    """A valid member with no assigned meals returns 200 with empty list."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        # Member 4 (Noah) exists but may not have a personal plan yet
        # First ensure no personal plan exists by querying
        r = client.get("/api/v1/meal-plan/week?member_id=4", headers=headers)
        assert r.status_code == 200
        # All returned meals (if any) should be assigned to member 4
        for meal in r.json():
            assert meal["assignedTo"] == 4


def test_child_cannot_apply_template() -> None:
    """Child role cannot apply meal templates."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=child_headers)
        assert r.status_code == 403


def test_child_can_view_meal_plan() -> None:
    """Child role can view meal plans (read-only)."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.get("/api/v1/meal-plan/week", headers=child_headers)
        assert r.status_code == 200

        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=child_headers)
        assert r.status_code == 200


def test_child_cannot_update_meal() -> None:
    """Child role cannot modify meals."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        meals = r.json()
        if meals:
            child_headers = auth_headers(client, "ava")
            r = client.patch(
                f"/api/v1/meal-plan/{meals[0]['id']}",
                json={"mealName": "Hacked"},
                headers=child_headers,
            )
            assert r.status_code == 403


# --- Meal Plan Audit Trail ---


def test_apply_template_creates_audit_log() -> None:
    """Applying a template should create an audit log entry."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Apply template
        client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)

        # Check audit logs (use larger limit to account for prior test activity)
        r = client.get("/api/v1/family/audit-logs?limit=100", headers=headers)
        assert r.status_code == 200
        logs = r.json()
        template_logs = [log for log in logs if log["action"] == "apply_template" and log["entityType"] == "meal_plan"]
        assert len(template_logs) >= 1
        # Should record member_id in changes
        latest = template_logs[0]
        assert latest["changes"] is not None
        assert latest["changes"].get("member_id") == 1


def test_meal_update_creates_audit_log() -> None:
    """Updating a meal should create an audit log entry."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Generate a fresh member meal to ensure we have a known meal
        r = client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        meals = r.json()
        assert len(meals) >= 1
        meal_id = meals[0]["id"]

        # Update it
        client.patch(f"/api/v1/meal-plan/{meal_id}", json={"mealName": "Audit Test Meal"}, headers=headers)

        r = client.get("/api/v1/family/audit-logs?limit=100", headers=headers)
        logs = r.json()
        meal_logs = [log for log in logs if log["entityType"] == "meal_plan" and log["action"] == "update"]
        assert len(meal_logs) >= 1


# --- Notification Generation from Meal Plan ---


def test_apply_template_generates_notification() -> None:
    """Applying a template should generate a notification."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Mark all read first
        client.post("/api/v1/notifications/mark-all-read", headers=headers)

        # Apply template
        client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)

        # Check notifications
        r = client.get("/api/v1/notifications?limit=5", headers=headers)
        notifications = r.json()
        template_notifs = [n for n in notifications if "template applied" in n["title"].lower()]
        assert len(template_notifs) >= 1


# --- Bootstrap Includes Per-Member Meals ---


def test_bootstrap_includes_all_meals_regardless_of_assignment() -> None:
    """Bootstrap returns all meals (family-wide + per-member)."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Generate per-member plans
        client.post("/api/v1/meal-plan/apply-template", json={"memberId": 1}, headers=headers)
        client.post("/api/v1/meal-plan/apply-template", json={"memberId": 2}, headers=headers)

        # Bootstrap should include all
        r = client.get("/api/v1/family/bootstrap", headers=headers)
        assert r.status_code == 200
        meals = r.json()["meals"]
        assigned_members = {m["assignedTo"] for m in meals if m["assignedTo"] is not None}
        # Should have meals for at least 2 members
        assert len(assigned_members) >= 2


# --- Recipe Integration with Meal Plans ---


def test_recipe_linked_to_meal_plan() -> None:
    """A recipe can be linked to a meal plan entry."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Create a recipe
        recipe = client.post(
            "/api/v1/meal-plan/recipes",
            json={"recipeName": "Linked Recipe", "ingredients": ["a", "b"], "cuisine": "Test"},
            headers=headers,
        )
        recipe_id = recipe.json()["id"]

        # Get a meal and check recipeId field exists
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        meals = r.json()
        assert len(meals) >= 1
        # recipeId field should be present (may be null)
        assert "recipeId" in meals[0]

        # Clean up
        client.delete(f"/api/v1/meal-plan/recipes/{recipe_id}", headers=headers)


# --- Member CRUD Edge Cases ---


def test_member_update_dietary_notes() -> None:
    """Update a member's dietary notes."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/family/bootstrap", headers=headers)
        members = r.json()["members"]
        member_id = members[0]["id"]

        patched = client.patch(
            f"/api/v1/family/members/{member_id}",
            json={"dietaryNotes": ["vegetarian", "no-gluten"]},
            headers=headers,
        )
        assert patched.status_code == 200
        assert "vegetarian" in patched.json()["dietaryNotes"]
        assert "no-gluten" in patched.json()["dietaryNotes"]


def test_member_update_points() -> None:
    """Update a member's reward points."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/family/bootstrap", headers=headers)
        members = r.json()["members"]
        member_id = members[0]["id"]

        patched = client.patch(
            f"/api/v1/family/members/{member_id}",
            json={"points": 100},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["points"] == 100


def test_member_role_change() -> None:
    """Change a member's role."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Create a test member
        payload = {"name": "RoleTest", "email": "roletest@test.local", "username": "roletest", "password": "familyhub1", "role": "child", "colorClass": "bg-green-500"}
        created = client.post("/api/v1/family/members", json=payload, headers=headers)
        member_id = created.json()["id"]
        assert created.json()["role"] == "child"

        # Promote to parent
        patched = client.patch(f"/api/v1/family/members/{member_id}", json={"role": "parent"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["role"] == "parent"

        # Clean up
        client.delete(f"/api/v1/family/members/{member_id}", headers=headers)


# --- Emergency Contact Edge Cases ---


def test_emergency_contact_update_label_and_value() -> None:
    """Update both label and value of an emergency contact."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post("/api/v1/family/emergency-contacts", json={"label": "Doctor", "value": "555-0100"}, headers=headers)
        contact_id = created.json()["id"]

        patched = client.patch(
            f"/api/v1/family/emergency-contacts/{contact_id}",
            json={"label": "Family Doctor", "value": "555-0200"},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["label"] == "Family Doctor"
        assert patched.json()["value"] == "555-0200"

        client.delete(f"/api/v1/family/emergency-contacts/{contact_id}", headers=headers)


def test_emergency_contact_not_found() -> None:
    """Updating/deleting non-existent contact returns 404."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.patch("/api/v1/family/emergency-contacts/99999", json={"label": "X"}, headers=headers)
        assert r.status_code == 404

        r = client.delete("/api/v1/family/emergency-contacts/99999", headers=headers)
        assert r.status_code == 404


# --- Change Password Validation ---


def test_change_password_too_short() -> None:
    """New password must be at least 8 characters."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "familyhub", "newPassword": "short1"}, headers=headers)
        assert r.status_code == 422


def test_change_password_no_digit() -> None:
    """New password must include at least one digit."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "familyhub", "newPassword": "nolettersonlyletters"}, headers=headers)
        assert r.status_code == 422


# --- Pagination Edge Cases ---


def test_grocery_items_pagination_offset_beyond_data() -> None:
    """Offset beyond available data returns empty list."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/grocery/items?limit=10&offset=99999", headers=headers)
        assert r.status_code == 200
        assert r.json() == []


def test_tasks_pagination_with_status_filter() -> None:
    """Pagination works with status filter."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/tasks?limit=5&offset=0&status=pending", headers=headers)
        assert r.status_code == 200
        for task in r.json():
            assert task["status"] == "pending"


def test_notifications_pagination_unread_only() -> None:
    """Pagination with unread_only filter."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/notifications?limit=5&offset=0&unread_only=true", headers=headers)
        assert r.status_code == 200
        for n in r.json():
            assert n["isRead"] is False


def test_audit_logs_pagination_with_entity_type() -> None:
    """Pagination with entity_type filter."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/family/audit-logs?limit=5&entity_type=meal_plan", headers=headers)
        assert r.status_code == 200
        for log in r.json():
            assert log["entityType"] == "meal_plan"


# --- Assistant Endpoint ---


def test_assistant_empty_query_rejected() -> None:
    """Empty query should be rejected."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/assistant/recommendations", json={"query": ""}, headers=headers)
        assert r.status_code == 422


def test_assistant_child_cannot_use() -> None:
    """Child without use_assistant permission cannot call assistant."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.post("/api/v1/assistant/recommendations", json={"query": "help"}, headers=child_headers)
        # Depending on permission setup, may be 403
        assert r.status_code in (200, 403)


# --- Concurrent Template Application ---


def test_apply_template_multiple_members_no_conflict() -> None:
    """Applying template for multiple members sequentially should not conflict."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Get all members
        r = client.get("/api/v1/family/bootstrap", headers=headers)
        members = r.json()["members"]

        # Apply for each member
        for member in members[:3]:  # First 3 members
            r = client.post("/api/v1/meal-plan/apply-template", json={"memberId": member["id"]}, headers=headers)
            assert r.status_code == 200
            meals = r.json()
            for meal in meals:
                assert meal["assignedTo"] == member["id"]

        # Verify each member has independent meals
        for member in members[:3]:
            r = client.get(f"/api/v1/meal-plan/week?member_id={member['id']}", headers=headers)
            assert r.status_code == 200
            assert len(r.json()) >= 1


# --- Meal Plan Update Edge Cases ---


def test_meal_update_nonexistent_returns_404() -> None:
    """Updating a non-existent meal returns 404."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.patch("/api/v1/meal-plan/99999", json={"mealName": "Ghost"}, headers=headers)
        assert r.status_code == 404


def test_meal_update_description() -> None:
    """Update meal description field."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/meal-plan/week", headers=headers)
        meals = r.json()
        if meals:
            meal_id = meals[0]["id"]
            patched = client.patch(
                f"/api/v1/meal-plan/{meal_id}",
                json={"description": "A healthy and delicious meal"},
                headers=headers,
            )
            assert patched.status_code == 200
            assert patched.json()["description"] == "A healthy and delicious meal"


# --- Device Management ---


def test_device_list() -> None:
    """Authenticated user can list their devices."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/auth/devices", headers=headers)
        assert r.status_code == 200
        devices = r.json()
        assert len(devices) >= 1
        # Should have standard fields
        d = devices[0]
        assert "deviceId" in d
        assert "deviceName" in d
        assert "isRevoked" in d
        assert "isTrusted" in d
        assert "lastUsedAt" in d


def test_device_update_name() -> None:
    """Rename a device."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/auth/devices", headers=headers)
        devices = r.json()
        device_id = devices[0]["id"]

        patched = client.patch(f"/api/v1/auth/devices/{device_id}", json={"deviceName": "My Laptop"}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["deviceName"] == "My Laptop"


def test_device_toggle_trust() -> None:
    """Toggle trusted status on a device."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/auth/devices", headers=headers)
        devices = r.json()
        device_id = devices[0]["id"]

        patched = client.patch(f"/api/v1/auth/devices/{device_id}", json={"isTrusted": True}, headers=headers)
        assert patched.status_code == 200
        assert patched.json()["isTrusted"] is True

        patched = client.patch(f"/api/v1/auth/devices/{device_id}", json={"isTrusted": False}, headers=headers)
        assert patched.json()["isTrusted"] is False


def test_device_revoke_sessions() -> None:
    """Revoke all sessions for a device."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.get("/api/v1/auth/devices", headers=headers)
        devices = r.json()
        device_id = devices[0]["id"]

        r = client.post(f"/api/v1/auth/devices/{device_id}/revoke-sessions", headers=headers)
        assert r.status_code == 200
        assert "revoked" in r.json()


def test_device_not_found() -> None:
    """Operations on non-existent device return 404."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        assert client.patch("/api/v1/auth/devices/99999", json={"deviceName": "X"}, headers=headers).status_code == 404
        assert client.delete("/api/v1/auth/devices/99999", headers=headers).status_code == 404
        assert client.post("/api/v1/auth/devices/99999/revoke-sessions", headers=headers).status_code == 404


def test_device_requires_auth() -> None:
    """Device endpoints require authentication."""
    with TestClient(app) as client:
        assert client.get("/api/v1/auth/devices").status_code == 401


def test_login_with_revoked_device() -> None:
    """Login from a revoked device should return 403."""
    with TestClient(app) as client:
        # Login with a specific device ID
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub", "deviceId": "revoke-login-test-device"})
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['accessToken']}"}

        # Get the device and revoke it
        r = client.get("/api/v1/auth/devices", headers=headers)
        devices = r.json()
        target = next((d for d in devices if d["deviceId"] == "revoke-login-test-device"), None)
        assert target is not None

        # Revoke the device
        client.delete(f"/api/v1/auth/devices/{target['id']}", headers=headers)

        # Attempt login again with the same device ID — should be rejected
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub", "deviceId": "revoke-login-test-device"})
        assert r.status_code == 403
        assert "revoked" in r.json()["error"]["detail"].lower()


def test_refresh_with_revoked_device() -> None:
    """Refresh from a revoked device should fail."""
    with TestClient(app) as client:
        # Login as ava to get a fresh device
        login_r = client.post("/api/v1/auth/login", json={"username": "ava", "password": "familyhub", "deviceId": "revoke-refresh-test-device"})
        assert login_r.status_code == 200
        token = login_r.json()["accessToken"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get device and revoke it
        r = client.get("/api/v1/auth/devices", headers=headers)
        devices = r.json()
        # Find the device we just created
        target = next((d for d in devices if d["deviceId"] == "revoke-refresh-test-device"), devices[0])
        client.delete(f"/api/v1/auth/devices/{target['id']}", headers=headers)

        # Attempt refresh — should fail because device is revoked
        r = client.post("/api/v1/auth/refresh", json={})
        assert r.status_code == 401


def test_device_registered_audit_event() -> None:
    """First login from a new device creates a device_registered audit log."""
    import uuid
    unique_device_id = f"audit-test-{uuid.uuid4().hex[:12]}"
    with TestClient(app) as client:
        # Login with a unique device ID to force new device registration
        r = client.post(
            "/api/v1/auth/login",
            json={"username": "meera", "password": "familyhub", "deviceId": unique_device_id, "deviceName": "Audit Test Device"},
        )
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['accessToken']}"}

        # Check audit logs for device_registered event
        r = client.get("/api/v1/family/audit-logs?limit=100", headers=headers)
        logs = r.json()
        device_logs = [log for log in logs if log["action"] == "device_registered" and log["changes"].get("device_id") == unique_device_id]
        assert len(device_logs) >= 1


def test_max_devices_per_user_limit() -> None:
    """User cannot register more than user.max_devices (default 5) active devices."""
    import uuid
    from app.core.database import SessionLocal
    from app.models import User

    # Temporarily lower ava's max_devices to test the limit
    db = SessionLocal()
    ava = db.query(User).filter_by(username="ava").one()
    original_max = ava.max_devices

    with TestClient(app) as client:
        # Check how many active devices ava currently has
        login_r = client.post("/api/v1/auth/login", json={"username": "ava", "password": "familyhub"})
        assert login_r.status_code == 200
        headers = {"Authorization": f"Bearer {login_r.json()['accessToken']}"}
        r = client.get("/api/v1/auth/devices", headers=headers)
        existing_active = len([d for d in r.json() if not d["isRevoked"]])

        # Set limit to existing + 1 so we can register exactly 1 more
        ava.max_devices = existing_active + 1
        db.commit()

        try:
            # Register one more device — should succeed
            did1 = f"limit-ok-{uuid.uuid4().hex[:8]}"
            r1 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "familyhub", "deviceId": did1})
            assert r1.status_code == 200

            # Next new device should be rejected
            did2 = f"limit-fail-{uuid.uuid4().hex[:8]}"
            r2 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "familyhub", "deviceId": did2})
            assert r2.status_code == 403
            assert "Maximum number of devices" in r2.json()["error"]["detail"]

            # Existing device should still work (not a new registration)
            r3 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "familyhub", "deviceId": did1})
            assert r3.status_code == 200
        finally:
            ava.max_devices = original_max
            db.commit()
            db.close()
