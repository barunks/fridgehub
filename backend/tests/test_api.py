import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test_familyhub.db"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["CACHE_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-tests"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "100"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def auth_headers(client: TestClient, username: str = "meera") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": "familyhub"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def teardown_module() -> None:
    Path("test_familyhub.db").unlink(missing_ok=True)


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
        assert len(data["tasks"]) >= 1


# --- Auth ---


def test_login_success_and_failure() -> None:
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub"})
        assert r.status_code == 200
        assert "accessToken" in r.json()
        assert "refreshToken" in r.json()

        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "wrong"})
        assert r.status_code == 401


def test_refresh_and_logout() -> None:
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "meera", "password": "familyhub"})
        tokens = login.json()

        refreshed = client.post("/api/v1/auth/refresh", json={"refreshToken": tokens["refreshToken"]})
        assert refreshed.status_code == 200
        new_token = refreshed.json()["accessToken"]

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

        # Restore
        restore_headers = {"Authorization": f"Bearer {r.json()['accessToken']}"}
        client.post("/api/v1/auth/change-password", json={"currentPassword": "newpass123", "newPassword": "familyhub"}, headers=restore_headers)


def test_change_password_wrong_current() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "wrong", "newPassword": "x" * 8}, headers=headers)
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
        payload = {"name": "TestUser", "email": "test@familyhub.local", "username": "testuser", "password": "familyhub", "role": "Child", "status": "Active", "colorClass": "bg-pink-500"}
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
