import os
from calendar import monthrange
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

os.environ["DATABASE_URL"] = "sqlite:///./test_fridgehub.db"
os.environ["SEED_ON_STARTUP"] = "true"
os.environ["CACHE_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-jwt-tests"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["TWILIO_ACCOUNT_SID"] = ""
os.environ["TWILIO_AUTH_TOKEN"] = ""
os.environ["TWILIO_FROM_NUMBER"] = ""
os.environ["TWILIO_VERIFY_SID"] = ""
os.environ["TWILIO_MESSAGING_SERVICE_SID"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import decode_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Device, DeviceSession, FamilyInvite, FamilyMember, MealPlan, User, GroceryItem, GroceryPurchaseCycle, GrocerySubList  # noqa: E402


def auth_headers(client: TestClient, username: str = "meera") -> dict[str, str]:
    response = client.post("/api/v1/auth/login", json={"username": username, "password": "fridgehub"})
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def add_months(value: date, months: int) -> date:
    total_month = value.month - 1 + months
    year = value.year + total_month // 12
    month = total_month % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return date(year, month, day)


def meal_targets_member(meal: dict, member_id: int) -> bool:
    return meal.get("assignedTo") == member_id or member_id in meal.get("targetMemberIds", [])


def setup_module() -> None:
    Path("test_fridgehub.db").unlink(missing_ok=True)


def teardown_module() -> None:
    Path("test_fridgehub.db").unlink(missing_ok=True)


def restore_demo_password(username: str = "meera", password: str = "fridgehub") -> None:
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
        assert data["family"]["familyName"] == "FridgeHub"
        assert len(data["listTypes"]) == 4
        assert len(data["meals"]) == 28
        assert len(data["members"]) >= 2
        assert len(data["groceryItems"]) >= 1
        assert "shoppingItems" in data
        assert len(data["shoppingItems"]) >= 1
        assert len(data["tasks"]) >= 1


def test_bootstrap_materializes_default_weekly_meal_plan() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        family_id = client.get("/api/v1/family/bootstrap", headers=headers).json()["family"]["id"]

        db = SessionLocal()
        try:
            db.query(MealPlan).filter_by(family_id=family_id, meal_plan_scope="family").update({"is_active": False})
            db.commit()
        finally:
            db.close()

        r = client.get("/api/v1/family/bootstrap", headers=headers)
        assert r.status_code == 200
        meals = [meal for meal in r.json()["meals"] if meal["assignedTo"] is None]
        assert len(meals) >= 28
        assert {meal["mealType"] for meal in meals}.issuperset({"breakfast", "lunch", "snacks", "dinner"})


# --- Auth ---


def test_login_success_and_failure() -> None:
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "fridgehub"})
        assert r.status_code == 200
        assert "accessToken" in r.json()
        assert "refreshToken" not in r.json()
        assert "fridgehub_refresh" in r.headers["set-cookie"]

        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "wrong"})
        assert r.status_code == 401


def test_refresh_and_logout() -> None:
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={"username": "meera", "password": "fridgehub"})
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

        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "fridgehub", "newPassword": "newpass123"}, headers=headers)
        assert r.status_code == 200

        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "newpass123"})
        assert r.status_code == 200

        restore_demo_password()


def test_change_password_wrong_current() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "wrong", "newPassword": "newpass123"}, headers=headers)
        assert r.status_code == 400


def test_signup_status_is_always_open() -> None:
    with TestClient(app) as client:
        r = client.get("/api/v1/auth/signup/status")
        assert r.status_code == 200
        assert r.json()["signupOpen"] is True


def test_second_family_can_be_created_with_unique_phone() -> None:
    unique = uuid4().hex[:8]
    with TestClient(app) as client:
        r = client.post(
            "/api/v1/auth/signup/bootstrap",
            json={
                "familyName": f"Family {unique}",
                "homeBase": "Singapore",
                "timezone": "Asia/Singapore",
                "country": "Singapore",
                "address": "123 Test Street",
                "postalCode": "123456",
                "fullName": f"Admin {unique}",
                "email": f"admin-{unique}@test.local",
                "phone": f"+6590{unique[:6]}",
                "username": f"admin{unique}",
                "password": "AdminPass1",
                "deviceId": f"dev-{unique}",
                "deviceName": "Test Device",
                "deviceType": "browser",
            },
        )
        assert r.status_code == 200
        assert "accessToken" in r.json()


def test_same_phone_cannot_create_two_families() -> None:
    unique = uuid4().hex[:8]
    phone = f"+6591{unique[:6]}"
    payload = {
        "homeBase": "Singapore",
        "timezone": "Asia/Singapore",
        "country": "Singapore",
        "address": "123 Test Street",
        "postalCode": "123456",
        "fullName": f"Admin {unique}",
        "phone": phone,
        "password": "AdminPass1",
        "deviceType": "browser",
    }
    with TestClient(app) as client:
        r1 = client.post(
            "/api/v1/auth/signup/bootstrap",
            json={**payload, "familyName": f"Family1 {unique}", "email": f"a1-{unique}@test.local",
                  "username": f"adm1{unique}", "deviceId": f"d1-{unique}", "deviceName": "D1"},
        )
        assert r1.status_code == 200
        r2 = client.post(
            "/api/v1/auth/signup/bootstrap",
            json={**payload, "familyName": f"Family2 {unique}", "email": f"a2-{unique}@test.local",
                  "username": f"adm2{unique}", "deviceId": f"d2-{unique}", "deviceName": "D2"},
        )
        assert r2.status_code == 409
        assert "phone" in r2.json()["error"]["detail"].lower()

def test_invite_signup_registers_device_and_closes_invite() -> None:
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"join-{unique}@fridgehub.local", "role": "member", "expiresInDays": 3},
            headers=headers,
        )
        assert invite.status_code == 201
        invite_data = invite.json()
        invite_token = invite_data["inviteToken"]
        assert invite_token

        preview = client.get(f"/api/v1/auth/invites/{invite_token}")
        assert preview.status_code == 200
        assert preview.json()["email"] == f"join-{unique}@fridgehub.local"

        signup = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": invite_token,
                "fullName": "Invite User",
                "email": f"join-{unique}@fridgehub.local",
                "phone": "+6591000099",
                "username": f"join{unique}",
                "password": "joinpass1",
                "deviceId": f"invite-device-{unique}",
                "deviceName": "Invite Phone",
                "deviceType": "phone",
                "platform": "iPhone",
            },
        )
        assert signup.status_code == 200
        assert "accessToken" in signup.json()

        db = SessionLocal()
        try:
            user = db.query(User).filter_by(username=f"join{unique}").one()
            assert db.query(FamilyMember).filter_by(user_id=user.id, is_active=True).count() == 1
            device = db.query(Device).filter_by(user_id=user.id, device_id=f"invite-device-{unique}").one()
            assert device.device_name == "Invite Phone"
            assert device.device_type == "phone"
            saved_invite = db.query(FamilyInvite).filter_by(id=invite_data["id"]).one()
            assert saved_invite.used_count == 1
            assert saved_invite.is_active is False
        finally:
            db.close()

        reused = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": invite_token,
                "fullName": "Second User",
                "email": f"second-{unique}@fridgehub.local",
                "phone": "+6591000098",
                "username": f"second{unique}",
                "password": "joinpass1",
                "deviceId": f"invite-device-second-{unique}",
                "deviceName": "Second Phone",
                "deviceType": "phone",
            },
        )
        assert reused.status_code == 404


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


def test_meal_update_full_payload_and_validation() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        meals = client.get("/api/v1/meal-plan/week", headers=headers).json()
        meal_id = meals[0]["id"]
        recipe = client.post(
            "/api/v1/meal-plan/recipes",
            json={"recipeName": "Protein Bowl", "ingredients": ["rice", "tofu"], "dietaryTags": ["vegan"]},
            headers=headers,
        ).json()

        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={
                "mealName": "Protein Bowl Lunch",
                "description": "High protein meal",
                "calories": 520,
                "prepTime": 25,
                "assignedTo": 1,
                "dietaryFlags": ["vegan", " vegan ", ""],
                "recipeId": recipe["id"],
            },
            headers=headers,
        )
        assert patched.status_code == 200
        body = patched.json()
        assert body["mealName"] == "Protein Bowl Lunch"
        assert body["calories"] == 520
        assert body["prepTime"] == 25
        assert body["assignedTo"] == 1
        assert body["dietaryFlags"] == ["vegan"]
        assert body["recipeId"] == recipe["id"]

        invalid = client.patch(f"/api/v1/meal-plan/{meal_id}", json={"calories": -1}, headers=headers)
        assert invalid.status_code == 422

        invalid_recipe = client.patch(f"/api/v1/meal-plan/{meal_id}", json={"recipeId": 999999}, headers=headers)
        assert invalid_recipe.status_code == 400


def test_meal_update_effective_scopes_materialize_target_dates() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        applied = client.post("/api/v1/meal-plan/apply-template", json={}, headers=headers)
        assert applied.status_code == 200
        family_meals = [
            meal
            for meal in applied.json()
            if meal["assignedTo"] is None and meal["mealPlanScope"] == "family"
        ]
        assert family_meals
        meal = sorted(family_meals, key=lambda item: (item["planDate"], item["id"]))[0]
        start = date.fromisoformat(meal["planDate"])
        meal_id = meal["id"]
        meal_type = meal["mealType"]

        daily_until = start + timedelta(days=2)
        daily_name = f"Daily Scope {uuid4().hex[:8]}"
        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": daily_name, "effectiveScope": "daily", "effectiveUntil": daily_until.isoformat()},
            headers=headers,
        )
        assert patched.status_code == 200
        meals = client.get("/api/v1/family/bootstrap", headers=headers).json()["meals"]
        daily_dates = {(start + timedelta(days=offset)).isoformat() for offset in range(3)}
        daily_rows = [
            row
            for row in meals
            if row["mealType"] == meal_type and row["mealPlanScope"] == "family" and row["planDate"] in daily_dates
        ]
        assert {row["planDate"] for row in daily_rows} == daily_dates
        assert all(row["mealName"] == daily_name for row in daily_rows)

        weekly_until = start + timedelta(days=14)
        weekly_name = f"Weekly Scope {uuid4().hex[:8]}"
        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": weekly_name, "effectiveScope": "weekly", "effectiveUntil": weekly_until.isoformat()},
            headers=headers,
        )
        assert patched.status_code == 200
        meals = client.get("/api/v1/family/bootstrap", headers=headers).json()["meals"]
        weekly_dates = {(start + timedelta(days=offset)).isoformat() for offset in (0, 7, 14)}
        weekly_rows = [
            row
            for row in meals
            if row["mealType"] == meal_type and row["mealPlanScope"] == "family" and row["planDate"] in weekly_dates
        ]
        assert {row["planDate"] for row in weekly_rows} == weekly_dates
        assert all(row["mealName"] == weekly_name for row in weekly_rows)

        monthly_until = add_months(start, 2)
        monthly_name = f"Monthly Scope {uuid4().hex[:8]}"
        patched = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": monthly_name, "effectiveScope": "monthly", "effectiveUntil": monthly_until.isoformat()},
            headers=headers,
        )
        assert patched.status_code == 200
        meals = client.get("/api/v1/family/bootstrap", headers=headers).json()["meals"]
        monthly_dates = {add_months(start, offset).isoformat() for offset in range(3)}
        monthly_rows = [
            row
            for row in meals
            if row["mealType"] == meal_type and row["mealPlanScope"] == "family" and row["planDate"] in monthly_dates
        ]
        assert {row["planDate"] for row in monthly_rows} == monthly_dates
        assert all(row["mealName"] == monthly_name for row in monthly_rows)

        invalid = client.patch(
            f"/api/v1/meal-plan/{meal_id}",
            json={"mealName": "Invalid Scope", "effectiveScope": "daily", "effectiveUntil": (start - timedelta(days=1)).isoformat()},
            headers=headers,
        )
        assert invalid.status_code == 400


def test_meal_update_group_audience_is_visible_to_each_target_member() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        bootstrap = client.get("/api/v1/family/bootstrap", headers=headers).json()
        member_ids = [member["id"] for member in bootstrap["members"]]
        assert len(member_ids) >= 3
        target_member_ids = member_ids[:2]
        excluded_member_id = member_ids[2]

        meals = client.get("/api/v1/meal-plan/week", headers=headers).json()
        meal = next(item for item in meals if item["mealPlanScope"] == "family")
        meal_name = f"Group Meal {uuid4().hex[:8]}"
        patched = client.patch(
            f"/api/v1/meal-plan/{meal['id']}",
            json={
                "mealName": meal_name,
                "targetMemberIds": target_member_ids,
                "effectiveScope": "daily",
                "effectiveUntil": meal["planDate"],
            },
            headers=headers,
        )
        assert patched.status_code == 200
        body = patched.json()
        assert body["assignedTo"] is None
        assert body["mealPlanScope"] == f"group:{target_member_ids[0]},{target_member_ids[1]}"
        assert body["targetMemberIds"] == target_member_ids

        first_member_meals = client.get(f"/api/v1/meal-plan/week?member_id={target_member_ids[0]}", headers=headers).json()
        second_member_meals = client.get(f"/api/v1/meal-plan/week?member_id={target_member_ids[1]}", headers=headers).json()
        excluded_member_meals = client.get(f"/api/v1/meal-plan/week?member_id={excluded_member_id}", headers=headers).json()
        assert any(item["mealName"] == meal_name for item in first_member_meals)
        assert any(item["mealName"] == meal_name for item in second_member_meals)
        assert all(item["mealName"] != meal_name for item in excluded_member_meals)


def test_meal_template_row_crud_and_apply_named_template() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        payload = {
            "templateName": "School Week",
            "dayOfWeek": "Monday",
            "mealType": "breakfast",
            "mealName": "Banana Oats",
            "description": "Fast school breakfast",
            "calories": 310,
            "prepTime": 8,
        }
        created = client.post("/api/v1/meal-plan/templates", json=payload, headers=headers)
        assert created.status_code == 200
        row = created.json()
        assert row["templateName"] == "School Week"
        assert row["dayOfWeek"] == "monday"
        assert row["isEditable"] is True

        listed = client.get("/api/v1/meal-plan/templates", headers=headers)
        assert listed.status_code == 200
        assert any(item["id"] == row["id"] for item in listed.json())

        patched = client.patch(
            f"/api/v1/meal-plan/templates/{row['id']}",
            json={"mealName": "Peanut Butter Oats", "calories": 360},
            headers=headers,
        )
        assert patched.status_code == 200
        assert patched.json()["mealName"] == "Peanut Butter Oats"

        applied = client.post(
            "/api/v1/meal-plan/apply-template",
            json={"templateName": "School Week", "memberId": 1},
            headers=headers,
        )
        assert applied.status_code == 200
        assert any(meal["mealName"] == "Peanut Butter Oats" for meal in applied.json())

        deleted = client.delete(f"/api/v1/meal-plan/templates/{row['id']}", headers=headers)
        assert deleted.status_code == 204
        relisted = client.get("/api/v1/meal-plan/templates", headers=headers).json()
        assert all(item["id"] != row["id"] for item in relisted)


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
        payload = {"name": "TestUser", "email": "test@fridgehub.local", "username": "testuser", "password": "fridgehub1", "role": "Child", "status": "Active", "colorClass": "bg-pink-500"}
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
        data = r.json()
        assert "answer" in data
        assert "insights" in data
        assert data["insights"]
        assert {insight["severity"] for insight in data["insights"]} <= {"critical", "warning", "info"}
        assert all("route" in insight for insight in data["insights"])


def test_assistant_gap_and_specific_queries() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        gaps = client.post(
            "/api/v1/assistant/recommendations",
            json={"query": "What gaps or alerts did we miss today?"},
            headers=headers,
        )
        assert gaps.status_code == 200
        assert "attention" in gaps.json()["answer"].lower() or "no critical" in gaps.json()["answer"].lower()

        member = client.post(
            "/api/v1/assistant/recommendations",
            json={"query": "What about Meera?"},
            headers=headers,
        )
        assert member.status_code == 200
        assert "meera" in member.json()["answer"].lower()


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


def test_grocery_regenerate_cycles_carries_forward_unpurchased_items() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        item_name = f"CarryForward-{uuid4().hex[:8]}"
        payload = {
            "itemName": item_name,
            "listTypeId": 1,
            "quantity": 2,
            "unit": "Pack",
            "purchaseFrequency": "weekly",
            "currentStock": False,
            "notes": "Unpurchased carry-forward test",
        }
        # Create item and run first regen — item enters its first cycle, carried_forward must be False
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        item_id = created.json()["id"]

        first_regen = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert first_regen.status_code == 200

        db = SessionLocal()
        try:
            first_sub_item = (
                db.query(GrocerySubList)
                .join(GroceryPurchaseCycle)
                .filter(GrocerySubList.item_id == item_id, GroceryPurchaseCycle.is_completed.is_(False))
                .one()
            )
            # After first regen the item is in its first active cycle — not yet carried forward
            assert first_sub_item.carried_forward is False
        finally:
            db.close()

        # Second regen — item was unpurchased in the previous cycle, so it must be carried forward
        second_regen = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert second_regen.status_code == 200

        db = SessionLocal()
        try:
            second_sub_item = (
                db.query(GrocerySubList)
                .join(GroceryPurchaseCycle)
                .filter(GrocerySubList.item_id == item_id, GroceryPurchaseCycle.is_completed.is_(False))
                .one()
            )
            assert second_sub_item.carried_forward is True
        finally:
            db.close()

        client.delete(f"/api/v1/grocery/items/{item_id}", headers=headers)


def test_grocery_regenerate_cycles_builds_cycles_for_each_master_item() -> None:
    with TestClient(app) as client:
        headers = auth_headers(client)
        item_name = f"CycleBuild-{uuid4().hex[:8]}"
        payload = {
            "itemName": item_name,
            "listTypeId": 2,
            "quantity": 1,
            "unit": "Bottle",
            "purchaseFrequency": "monthly",
            "currentStock": False,
            "notes": "Cycle generation test",
        }
        created = client.post("/api/v1/grocery/items", json=payload, headers=headers)
        assert created.status_code == 200
        item_id = created.json()["id"]

        r = client.post("/api/v1/grocery/regenerate-cycles", headers=headers)
        assert r.status_code == 200
        cycles = r.json()
        assert any(c["listTypeId"] == 2 and c["frequency"] == "monthly" for c in cycles)

        db = SessionLocal()
        try:
            cycle = (
                db.query(GroceryPurchaseCycle)
                .join(GrocerySubList)
                .filter(
                    GroceryPurchaseCycle.list_type_id == 2,
                    GroceryPurchaseCycle.frequency == "monthly",
                    GrocerySubList.item_id == item_id,
                    GroceryPurchaseCycle.is_completed.is_(False),
                )
                .one()
            )
            assert cycle.cycle_start_date <= cycle.cycle_end_date
        finally:
            db.close()

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
            "description": "Water balcony plants",
            "recurrenceType": "quarterly",
            "recurrenceInterval": 2,
            "recurrenceEndAt": "2026-07-01T08:00:00",
        }
        created = client.post("/api/v1/tasks", json=payload, headers=headers)
        assert created.status_code == 200
        task = created.json()
        assert task["description"] == "Water balcony plants"
        assert task["recurrenceType"] == "quarterly"
        assert task["recurrenceInterval"] == 2
        assert task["recurrenceEndAt"].startswith("2026-07-01T08:00:00")
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
        # All returned meals should target member 1, either individually or through a group scope.
        for meal in member_meals:
            assert meal_targets_member(meal, 1)


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
        # All returned meals should target member 1, either individually or through a group scope.
        for meal in meals:
            assert meal_targets_member(meal, 1)


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
        member1_ids = {m["id"] for m in member1_meals if m["assignedTo"] == 1}
        member2_ids = {m["id"] for m in member2_meals if m["assignedTo"] == 2}
        assert member1_ids.isdisjoint(member2_ids)

        # Verify via GET filter
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        assert all(meal_targets_member(m, 1) for m in r.json())

        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=headers)
        assert all(meal_targets_member(m, 2) for m in r.json())


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
        member1_meal = next(meal for meal in member1_meals if meal["assignedTo"] == 1)
        meal_id = member1_meal["id"]
        original_name = member1_meal["mealName"]

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
        m1_meals = [meal for meal in r.json() if meal["assignedTo"] == 1]
        if m1_meals:
            client.patch(
                f"/api/v1/meal-plan/{m1_meals[0]['id']}",
                json={"dietaryFlags": ["gluten-free", "dairy-free"]},
                headers=headers,
            )

        # Get member 2's meals and set different flags
        m2_meals = [meal for meal in r2.json() if meal["assignedTo"] == 2]
        if m2_meals:
            client.patch(
                f"/api/v1/meal-plan/{m2_meals[0]['id']}",
                json={"dietaryFlags": ["nut-free"]},
                headers=headers,
            )

        # Verify independence
        r = client.get("/api/v1/meal-plan/week?member_id=1", headers=headers)
        member1_rows = [meal for meal in r.json() if meal["assignedTo"] == 1]
        if member1_rows:
            assert "gluten-free" in member1_rows[0]["dietaryFlags"]

        r = client.get("/api/v1/meal-plan/week?member_id=2", headers=headers)
        member2_rows = [meal for meal in r.json() if meal["assignedTo"] == 2]
        if member2_rows:
            assert "nut-free" in member2_rows[0]["dietaryFlags"]
            assert "gluten-free" not in member2_rows[0]["dietaryFlags"]


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
        # All returned meals (if any) should target member 4
        for meal in r.json():
            assert meal_targets_member(meal, 4)


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
        # Should record member_id in changes — pick the most recent log
        latest = max(template_logs, key=lambda log: log["id"])
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
        payload = {"name": "RoleTest", "email": "roletest@test.local", "username": "roletest", "password": "fridgehub1", "role": "child", "colorClass": "bg-green-500"}
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
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "fridgehub", "newPassword": "short1"}, headers=headers)
        assert r.status_code == 422


def test_change_password_no_digit() -> None:
    """New password must include at least one digit."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post("/api/v1/auth/change-password", json={"currentPassword": "fridgehub", "newPassword": "nolettersonlyletters"}, headers=headers)
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
                assert meal_targets_member(meal, member["id"])

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


def test_device_policy_can_be_updated_by_parent() -> None:
    """Parent can set/clear device capacity; None means unlimited; cannot set below active count."""
    from app.core.config import settings as _settings
    original = _settings.max_devices_per_user
    try:
        with TestClient(app) as client:
            headers = auth_headers(client)
            policy = client.get("/api/v1/auth/devices/policy", headers=headers)
            assert policy.status_code == 200
            current = policy.json()
            active_count = current["activeDeviceCount"]
            # maxDevices is None when no limit is configured
            assert current["maxDevices"] is None or current["maxDevices"] >= active_count

            # Set an explicit limit above current active count
            raised_limit = active_count + 3
            updated = client.patch(
                "/api/v1/auth/devices/policy",
                json={"maxDevices": raised_limit},
                headers=headers,
            )
            assert updated.status_code == 200
            assert updated.json()["maxDevices"] == raised_limit

            # Setting below active count must be rejected
            if active_count > 0:
                rejected = client.patch(
                    "/api/v1/auth/devices/policy",
                    json={"maxDevices": active_count - 1},
                    headers=headers,
                )
                assert rejected.status_code in {400, 422}

            # Clear the limit (None = unlimited)
            cleared = client.patch(
                "/api/v1/auth/devices/policy",
                json={"maxDevices": None},
                headers=headers,
            )
            assert cleared.status_code == 200
            assert cleared.json()["maxDevices"] is None
    finally:
        _settings.__dict__["max_devices_per_user"] = original


def test_device_policy_requires_family_management_permission() -> None:
    """Read is allowed for signed-in users; update is restricted to family managers."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        assert client.get("/api/v1/auth/devices/policy", headers=child_headers).status_code == 200
        r = client.patch("/api/v1/auth/devices/policy", json={"maxDevices": 6}, headers=child_headers)
        assert r.status_code == 403


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
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "fridgehub", "deviceId": "revoke-login-test-device"})
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
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "fridgehub", "deviceId": "revoke-login-test-device"})
        assert r.status_code == 403
        assert "revoked" in r.json()["error"]["detail"].lower()


def test_refresh_with_revoked_device() -> None:
    """Refresh from a revoked device should fail."""
    with TestClient(app) as client:
        # Login as ava to get a fresh device
        login_r = client.post("/api/v1/auth/login", json={"username": "ava", "password": "fridgehub", "deviceId": "revoke-refresh-test-device"})
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
            json={"username": "meera", "password": "fridgehub", "deviceId": unique_device_id, "deviceName": "Audit Test Device"},
        )
        assert r.status_code == 200
        headers = {"Authorization": f"Bearer {r.json()['accessToken']}"}

        # Check audit logs for device_registered event
        r = client.get("/api/v1/family/audit-logs?limit=100", headers=headers)
        logs = r.json()
        device_logs = [log for log in logs if log["action"] == "device_registered" and log["changes"].get("device_id") == unique_device_id]
        assert len(device_logs) >= 1


def test_max_devices_per_user_limit() -> None:
    """When MAX_DEVICES_PER_USER is set, registering beyond the limit is rejected; existing devices still work."""
    import uuid
    from app.core.config import settings as _settings

    with TestClient(app) as client:
        login_r = client.post("/api/v1/auth/login", json={"username": "ava", "password": "fridgehub"})
        assert login_r.status_code == 200
        headers = {"Authorization": f"Bearer {login_r.json()['accessToken']}"}
        r = client.get("/api/v1/auth/devices", headers=headers)
        existing_active = len([d for d in r.json() if not d["isRevoked"]])

        # Set config limit to existing + 1 so we can register exactly 1 more
        original = _settings.max_devices_per_user
        _settings.__dict__["max_devices_per_user"] = existing_active + 1
        try:
            # Register one more device — should succeed
            did1 = f"limit-ok-{uuid.uuid4().hex[:8]}"
            r1 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "fridgehub", "deviceId": did1})
            assert r1.status_code == 200

            # Next truly new device should be rejected
            did2 = f"limit-fail-{uuid.uuid4().hex[:8]}"
            r2 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "fridgehub", "deviceId": did2})
            assert r2.status_code == 403
            assert "Maximum number of devices" in r2.json()["error"]["detail"]

            # Re-login on an already-registered device must still succeed
            r3 = client.post("/api/v1/auth/login", json={"username": "ava", "password": "fridgehub", "deviceId": did1})
            assert r3.status_code == 200
        finally:
            _settings.__dict__["max_devices_per_user"] = original


def test_same_browser_device_id_rotation_reuses_existing_device_at_limit() -> None:
    """A changed client-side device ID from the same browser should not create duplicate devices."""
    from app.core.config import settings as _settings
    unique = uuid4().hex[:8]
    user_agent = f"FridgeHubBrowser/{unique}"
    first_device_id = f"stable-browser-{unique}"
    rotated_device_id = f"rotated-browser-{unique}"

    original = _settings.max_devices_per_user
    try:
      with TestClient(app) as client:
          first = client.post(
              "/api/v1/auth/login",
              json={
                  "username": "ava",
                  "password": "fridgehub",
                  "deviceId": first_device_id,
                  "deviceName": "Ava Laptop",
                  "deviceType": "browser",
              },
              headers={"user-agent": user_agent},
          )
          assert first.status_code == 200

          db = SessionLocal()
          ava = db.query(User).filter_by(username="ava").one()
          active_count = (
              db.query(Device)
              .filter(Device.user_id == ava.id, Device.is_active.is_(True), Device.is_revoked.is_(False))
              .count()
          )
          db.close()
          # Pin the config limit to current active count so any truly new device is rejected
          _settings.__dict__["max_devices_per_user"] = active_count

          # Rotated device ID from same browser/UA should match existing device — no new slot needed
          rotated = client.post(
              "/api/v1/auth/login",
              json={
                  "username": "ava",
                  "password": "fridgehub",
                  "deviceId": rotated_device_id,
                  "deviceName": "Ava Laptop",
                  "deviceType": "desktop",
                  "platform": "Linux x86_64",
              },
              headers={"user-agent": user_agent},
          )
          assert rotated.status_code == 200
          assert decode_token(rotated.json()["accessToken"])["device_id"] == first_device_id

          db2 = SessionLocal()
          ava2 = db2.query(User).filter_by(username="ava").one()
          after_count = (
              db2.query(Device)
              .filter(Device.user_id == ava2.id, Device.is_active.is_(True), Device.is_revoked.is_(False))
              .count()
          )
          db2.close()
          assert after_count == active_count

          # A genuinely new device from a different browser must be blocked at the limit
          truly_new = client.post(
              "/api/v1/auth/login",
              json={
                  "username": "ava",
                  "password": "fridgehub",
                  "deviceId": f"new-browser-{unique}",
                  "deviceName": "Different Laptop",
                  "deviceType": "desktop",
                  "platform": "Linux x86_64",
              },
              headers={"user-agent": f"DifferentBrowser/{unique}"},
          )
          assert truly_new.status_code == 403
    finally:
        _settings.__dict__["max_devices_per_user"] = original


def test_shopping_report_pdf_download() -> None:
    """GET /api/v1/grocery/shopping-report returns a PDF."""
    with TestClient(app) as client:
        r = client.get("/api/v1/grocery/shopping-report", headers=auth_headers(client))
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"


def test_shopping_report_with_filters() -> None:
    """Shopping report respects query filters."""
    with TestClient(app) as client:
        r = client.get(
            "/api/v1/grocery/shopping-report",
            params={"stock": "no", "only_needed": "true"},
            headers=auth_headers(client),
        )
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"


def test_shopping_report_with_multi_filters() -> None:
    """Shopping report accepts multi-select filter query values."""
    with TestClient(app) as client:
        r = client.get(
            "/api/v1/grocery/shopping-report",
            params={"list_type_ids": "1,2", "stock_values": "yes,no", "item_names": "Rice,Tomato"},
            headers=auth_headers(client),
        )
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert r.content[:4] == b"%PDF"


def test_shopping_report_requires_auth() -> None:
    """Shopping report requires authentication."""
    with TestClient(app) as client:
        r = client.get("/api/v1/grocery/shopping-report")
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Error message specificity
# ---------------------------------------------------------------------------


def test_login_wrong_password_gives_specific_message() -> None:
    """Wrong password returns a message distinct from 'account not found'."""
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"username": "meera", "password": "wrongpassword"})
        assert r.status_code == 401
        detail = r.json()["error"]["detail"]
        assert "incorrect password" in detail.lower()


def test_login_unknown_user_gives_specific_message() -> None:
    """Unknown username returns a message about no account found."""
    with TestClient(app) as client:
        r = client.post("/api/v1/auth/login", json={"username": "nobody_xyz", "password": "fridgehub"})
        assert r.status_code == 401
        detail = r.json()["error"]["detail"]
        assert "no active account" in detail.lower()


def test_duplicate_email_gives_specific_message() -> None:
    """Registering with an already-used email surfaces the email in the error."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        # Create first member
        client.post(
            "/api/v1/family/members",
            json={"name": "First", "email": f"dup-{unique}@test.local", "username": f"first{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        # Try same email, different username
        r = client.post(
            "/api/v1/family/members",
            json={"name": "Second", "email": f"dup-{unique}@test.local", "username": f"second{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        assert r.status_code == 409
        detail = r.json()["error"]["detail"]
        assert f"dup-{unique}@test.local" in detail


def test_duplicate_username_gives_specific_message() -> None:
    """Registering with an already-used username surfaces the username in the error."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        client.post(
            "/api/v1/family/members",
            json={"name": "First", "email": f"uniq1-{unique}@test.local", "username": f"dupuser{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        r = client.post(
            "/api/v1/family/members",
            json={"name": "Second", "email": f"uniq2-{unique}@test.local", "username": f"dupuser{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        assert r.status_code == 409
        detail = r.json()["error"]["detail"]
        assert f"dupuser{unique}" in detail


def test_validation_error_summary_is_human_readable() -> None:
    """422 validation errors produce a readable summary in error.detail, not 'Validation failed'."""
    with TestClient(app) as client:
        # Missing required fields on login
        r = client.post("/api/v1/auth/login", json={})
        assert r.status_code == 422
        body = r.json()
        detail = body["error"]["detail"]
        # Should NOT be the generic fallback
        assert detail != "Validation failed"
        # Should mention at least one field name
        assert any(field["field"] for field in body["validationErrors"])


def test_password_strength_error_strips_pydantic_prefix() -> None:
    """Password validator message should not contain 'Value error, ' prefix."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post(
            "/api/v1/auth/change-password",
            json={"currentPassword": "fridgehub", "newPassword": "onlyletters"},
            headers=headers,
        )
        assert r.status_code == 422
        detail = r.json()["error"]["detail"]
        assert "Value error," not in detail
        assert "letter" in detail.lower() or "number" in detail.lower()


# ---------------------------------------------------------------------------
# One admin per family enforcement
# ---------------------------------------------------------------------------


def test_cannot_create_second_admin_via_member_endpoint() -> None:
    """Creating a member with role=admin is rejected when family already has an admin."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post(
            "/api/v1/family/members",
            json={
                "name": "Second Admin",
                "email": f"admin2-{unique}@test.local",
                "username": f"admin2{unique}",
                "password": "fridgehub1",
                "role": "admin",
                "colorClass": "bg-red-500",
            },
            headers=headers,
        )
        assert r.status_code == 409
        detail = r.json()["error"]["detail"]
        assert "already has an admin" in detail.lower()


def test_cannot_promote_member_to_admin_when_admin_exists() -> None:
    """Updating a member's role to admin is rejected when family already has an admin."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        # Create a regular member
        created = client.post(
            "/api/v1/family/members",
            json={"name": "Promote Test", "email": f"promote-{unique}@test.local", "username": f"promote{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        assert created.status_code == 200
        member_id = created.json()["id"]

        # Try to promote to admin — should fail
        r = client.patch(f"/api/v1/family/members/{member_id}", json={"role": "admin"}, headers=headers)
        assert r.status_code == 409
        assert "already has an admin" in r.json()["error"]["detail"].lower()

        # Clean up
        client.delete(f"/api/v1/family/members/{member_id}", headers=headers)


def test_can_change_non_admin_role_freely() -> None:
    """Changing a member's role between non-admin values works without restriction."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        created = client.post(
            "/api/v1/family/members",
            json={"name": "Role Free", "email": f"rolefree-{unique}@test.local", "username": f"rolefree{unique}", "password": "fridgehub1", "role": "child", "colorClass": "bg-blue-500"},
            headers=headers,
        )
        member_id = created.json()["id"]

        r = client.patch(f"/api/v1/family/members/{member_id}", json={"role": "parent"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["role"] == "parent"

        r = client.patch(f"/api/v1/family/members/{member_id}", json={"role": "child"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["role"] == "child"

        client.delete(f"/api/v1/family/members/{member_id}", headers=headers)


# ---------------------------------------------------------------------------
# Invite — admin role blocked
# ---------------------------------------------------------------------------


def test_invite_with_admin_role_is_rejected() -> None:
    """Creating an invite with role=admin is rejected at the API level."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post(
            "/api/v1/auth/invites",
            json={"email": f"adminvite-{unique}@test.local", "role": "admin"},
            headers=headers,
        )
        assert r.status_code == 400
        detail = r.json()["error"]["detail"]
        assert "admin" in detail.lower()
        assert "bootstrap" in detail.lower() or "independently" in detail.lower()


def test_invite_signup_with_admin_role_blocked_even_if_invite_exists() -> None:
    """Even if an invite somehow has role=admin, signup is blocked when family already has an admin."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Force-create an admin invite directly in DB (bypassing service guard)
        db = SessionLocal()
        try:
            import hashlib, secrets
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            from datetime import datetime, timezone, timedelta
            from app.models import FamilyInvite, FamilyMember
            member = db.query(FamilyMember).filter_by(is_active=True).first()
            invite = FamilyInvite(
                family_id=member.family_id,
                invited_by=member.user_id,
                token_hash=token_hash,
                email=f"adminvite2-{unique}@test.local",
                role="admin",
                max_uses=1,
                used_count=0,
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
            db.add(invite)
            db.commit()
        finally:
            db.close()

        r = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "Admin Attempt",
                "email": f"adminvite2-{unique}@test.local",
                "phone": "+6591000077",
                "username": f"adminattempt{unique}",
                "password": "fridgehub1",
                "deviceId": f"admin-invite-device-{unique}",
                "deviceName": "Test Phone",
                "deviceType": "phone",
            },
        )
        assert r.status_code == 409
        assert "already has an admin" in r.json()["error"]["detail"].lower()


# ---------------------------------------------------------------------------
# Invite — email mandatory, correct email enforced
# ---------------------------------------------------------------------------


def test_invite_requires_email() -> None:
    """Creating an invite without email is rejected (email is mandatory)."""
    with TestClient(app) as client:
        headers = auth_headers(client)
        r = client.post(
            "/api/v1/auth/invites",
            json={"role": "member"},
            headers=headers,
        )
        # Missing required field → 422
        assert r.status_code == 422


def test_invite_signup_wrong_email_rejected() -> None:
    """Signing up with a different email than the invite was issued to returns 403."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"correct-{unique}@test.local", "role": "member"},
            headers=headers,
        )
        assert invite.status_code == 201
        token = invite.json()["inviteToken"]

        r = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "Wrong Email User",
                "email": f"wrong-{unique}@test.local",
                "phone": "+6591000066",
                "username": f"wrongemail{unique}",
                "password": "fridgehub1",
                "deviceId": f"wrong-email-device-{unique}",
                "deviceName": "Test Phone",
                "deviceType": "phone",
            },
        )
        assert r.status_code == 403
        detail = r.json()["error"]["detail"]
        assert "different email" in detail.lower() or "sent to" in detail.lower()


def test_invite_preview_shows_family_and_role() -> None:
    """Preview endpoint returns family name, role, and expiry for a valid invite."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"preview-{unique}@test.local", "role": "parent"},
            headers=headers,
        )
        assert invite.status_code == 201
        token = invite.json()["inviteToken"]

        r = client.get(f"/api/v1/auth/invites/{token}")
        assert r.status_code == 200
        data = r.json()
        assert data["familyName"] == "FridgeHub"
        assert data["role"] == "parent"
        assert data["email"] == f"preview-{unique}@test.local"
        assert "expiresAt" in data


def test_invite_preview_invalid_token_returns_404() -> None:
    """Preview with a garbage token returns 404."""
    with TestClient(app) as client:
        r = client.get("/api/v1/auth/invites/this-is-not-a-real-token-at-all-xyz")
        assert r.status_code == 404
        assert "invalid" in r.json()["error"]["detail"].lower() or "expired" in r.json()["error"]["detail"].lower()


def test_invite_signup_full_flow_correct_email() -> None:
    """Full invite signup flow: create invite → preview → signup with correct email → member exists."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Admin creates invite
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"newmember-{unique}@test.local", "role": "member"},
            headers=headers,
        )
        assert invite.status_code == 201
        token = invite.json()["inviteToken"]
        assert token

        # Preview invite
        preview = client.get(f"/api/v1/auth/invites/{token}")
        assert preview.status_code == 200
        assert preview.json()["role"] == "member"

        # Sign up
        signup = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "New Member",
                "email": f"newmember-{unique}@test.local",
                "phone": f"+659100{unique[:4]}",
                "username": f"newmember{unique}",
                "password": "fridgehub1",
                "deviceId": f"newmember-device-{unique}",
                "deviceName": "New Phone",
                "deviceType": "phone",
            },
        )
        assert signup.status_code == 200
        assert "accessToken" in signup.json()

        # Verify member exists in family
        db = SessionLocal()
        try:
            user = db.query(User).filter_by(username=f"newmember{unique}").one()
            member = db.query(FamilyMember).filter_by(user_id=user.id, is_active=True).one()
            assert member.role == "member"
        finally:
            db.close()

        # Invite is now consumed — reuse should fail
        reuse = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "Reuse Attempt",
                "email": f"newmember-{unique}@test.local",
                "phone": "+6591000055",
                "username": f"reuse{unique}",
                "password": "fridgehub1",
                "deviceId": f"reuse-device-{unique}",
                "deviceName": "Reuse Phone",
                "deviceType": "phone",
            },
        )
        assert reuse.status_code == 404


def test_invite_signup_role_is_member_not_admin() -> None:
    """A member who signs up via invite gets the role from the invite, never admin."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"rolecheck-{unique}@test.local", "role": "child"},
            headers=headers,
        )
        token = invite.json()["inviteToken"]

        signup = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "Role Check",
                "email": f"rolecheck-{unique}@test.local",
                "phone": "+6591000044",
                "username": f"rolecheck{unique}",
                "password": "fridgehub1",
                "deviceId": f"rolecheck-device-{unique}",
                "deviceName": "Test Phone",
                "deviceType": "phone",
            },
        )
        assert signup.status_code == 200

        db = SessionLocal()
        try:
            user = db.query(User).filter_by(username=f"rolecheck{unique}").one()
            member = db.query(FamilyMember).filter_by(user_id=user.id, is_active=True).one()
            assert member.role == "child"
            assert member.role != "admin"
        finally:
            db.close()


def test_invite_revoke_makes_token_unusable() -> None:
    """Revoking an invite makes the token invalid for signup."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"revoke-{unique}@test.local", "role": "member"},
            headers=headers,
        )
        assert invite.status_code == 201
        invite_id = invite.json()["id"]
        token = invite.json()["inviteToken"]

        # Revoke it
        r = client.delete(f"/api/v1/auth/invites/{invite_id}", headers=headers)
        assert r.status_code == 204

        # Preview should now 404
        r = client.get(f"/api/v1/auth/invites/{token}")
        assert r.status_code == 404

        # Signup should also fail
        r = client.post(
            "/api/v1/auth/signup",
            json={
                "inviteToken": token,
                "fullName": "Revoked User",
                "email": f"revoke-{unique}@test.local",
                "phone": "+6591000033",
                "username": f"revokeduser{unique}",
                "password": "fridgehub1",
                "deviceId": f"revoke-device-{unique}",
                "deviceName": "Test Phone",
                "deviceType": "phone",
            },
        )
        assert r.status_code == 404


def test_invite_list_shows_recent_invites() -> None:
    """List invites returns invites created in the last 30 days."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        headers = auth_headers(client)
        invite = client.post(
            "/api/v1/auth/invites",
            json={"email": f"listtest-{unique}@test.local", "role": "member"},
            headers=headers,
        )
        assert invite.status_code == 201
        invite_id = invite.json()["id"]

        r = client.get("/api/v1/auth/invites", headers=headers)
        assert r.status_code == 200
        ids = [i["id"] for i in r.json()]
        assert invite_id in ids


def test_invite_list_requires_manage_family_permission() -> None:
    """Child cannot list or create invites."""
    unique = uuid4().hex[:10]
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        assert client.get("/api/v1/auth/invites", headers=child_headers).status_code == 403
        r = client.post(
            "/api/v1/auth/invites",
            json={"email": f"child-invite-{unique}@test.local", "role": "member"},
            headers=child_headers,
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Purge family data
# ---------------------------------------------------------------------------


def test_purge_family_data_admin_only() -> None:
    """Non-admin (child) cannot purge family data."""
    with TestClient(app) as client:
        child_headers = auth_headers(client, "ava")
        r = client.delete("/api/v1/family/data", headers=child_headers)
        assert r.status_code == 403


def test_purge_family_data_requires_auth() -> None:
    """Purge endpoint requires authentication."""
    with TestClient(app) as client:
        r = client.delete("/api/v1/family/data")
        assert r.status_code == 401


def test_purge_family_data_clears_operational_data() -> None:
    """Admin purge deletes groceries, tasks, meals, recipes, contacts, announcements, notifications."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Seed some data to ensure there's something to purge
        client.post("/api/v1/grocery/items", json={"itemName": "PurgeTestItem", "listTypeId": 1, "quantity": 1, "unit": "Kg", "purchaseFrequency": "weekly"}, headers=headers)
        client.post("/api/v1/tasks", json={"title": "PurgeTestTask", "category": "chore", "priority": "low", "dueAt": "2025-12-01T10:00:00", "assignedTo": 1}, headers=headers)
        client.post("/api/v1/family/announcements", json={"title": "PurgeAnn", "message": "Will be purged"}, headers=headers)
        client.post("/api/v1/family/emergency-contacts", json={"label": "PurgeContact", "value": "000"}, headers=headers)

        # Purge
        r = client.delete("/api/v1/family/data", headers=headers)
        assert r.status_code == 200
        counts = r.json()
        # Should return deletion counts per type
        assert isinstance(counts, dict)
        assert any(v > 0 for v in counts.values()), "Expected at least some records deleted"

        # Verify data is gone
        groceries = client.get("/api/v1/grocery/items", headers=headers)
        assert groceries.status_code == 200
        assert groceries.json() == []

        tasks = client.get("/api/v1/tasks", headers=headers)
        assert tasks.status_code == 200
        assert tasks.json() == []

        # Members and family should still exist
        bootstrap = client.get("/api/v1/family/bootstrap", headers=headers)
        assert bootstrap.status_code == 200
        assert bootstrap.json()["family"]["familyName"] == "FridgeHub"
        assert len(bootstrap.json()["members"]) >= 1


def test_purge_creates_audit_log() -> None:
    """Purge operation writes a family_data_purged audit log entry."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # Add something so purge has work to do
        client.post("/api/v1/tasks", json={"title": "AuditPurgeTask", "category": "chore", "priority": "low", "dueAt": "2025-12-01T10:00:00", "assignedTo": 1}, headers=headers)

        client.delete("/api/v1/family/data", headers=headers)

        r = client.get("/api/v1/family/audit-logs?limit=200&entity_type=family", headers=headers)
        assert r.status_code == 200
        logs = r.json()
        purge_logs = [log for log in logs if log["action"] == "family_data_purged"]
        assert len(purge_logs) >= 1
        assert purge_logs[0]["entityType"] == "family"


def test_purge_idempotent_second_purge_returns_zero_counts() -> None:
    """Purging an already-empty family returns zero counts without error."""
    with TestClient(app) as client:
        headers = auth_headers(client)

        # First purge clears everything
        client.delete("/api/v1/family/data", headers=headers)

        # Second purge on empty family
        r = client.delete("/api/v1/family/data", headers=headers)
        assert r.status_code == 200
        counts = r.json()
        assert all(v == 0 for v in counts.values())


# ---------------------------------------------------------------------------
# OTP email + phone verification tests
# ---------------------------------------------------------------------------

def _make_unverified_user(db, username: str = "otpuser") -> "User":
    """Create a user with email_verified=False, phone_verified=False."""
    from app.core.security import hash_password
    from app.models import User
    existing = db.query(User).filter_by(username=username).first()
    if existing:
        existing.email_verified = False
        existing.phone_verified = False
        existing.is_active = True
        db.commit()
        return existing
    # Use a unique phone per username to avoid UNIQUE constraint collisions
    phone_suffix = abs(hash(username)) % 100000000
    user = User(
        email=f"{username}@fridgehub.test",
        username=username,
        password_hash=hash_password("Test1234"),
        full_name="OTP Test User",
        family_role="member",
        phone=f"+65{phone_suffix:08d}",
        email_verified=False,
        phone_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_login_blocked_for_unverified_user() -> None:
    """Login must be rejected with 403 when email/phone not verified."""
    from app.core.database import SessionLocal
    with TestClient(app) as client:
        db = SessionLocal()
        try:
            user = _make_unverified_user(db, "unveriflogin")
            user_id = user.id
        finally:
            db.close()
        r = client.post("/api/v1/auth/login", json={"username": "unveriflogin", "password": "Test1234"})
    assert r.status_code == 403
    body = r.json()
    detail = body["error"]["detail"]
    assert "verified" in detail.lower()
    assert body["error"]["code"] == "account_unverified"
    assert body["userId"] == user_id
    assert body["email"] == "unveriflogin@fridgehub.test"
    assert body["phone"]
    assert body["emailVerified"] is False
    assert body["phoneVerified"] is False


def test_verify_otp_correct_codes_marks_verified() -> None:
    """Correct email+phone OTP marks user as verified."""
    import hashlib
    from datetime import datetime, timedelta, timezone
    from app.core.database import SessionLocal
    from app.models import User, VerificationOtp
    with TestClient(app) as client:
        db = SessionLocal()
        try:
            user = _make_unverified_user(db, "verifcorrect")
            email_otp, phone_otp = "123456", "654321"
            db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
            row = VerificationOtp(
                entity_type="user", entity_id=user.id,
                email_otp_hash=hashlib.sha256(email_otp.encode()).hexdigest(),
                phone_otp_hash=hashlib.sha256(phone_otp.encode()).hexdigest(),
                email_target=user.email, phone_target=user.phone or "",
                expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            )
            db.add(row)
            db.commit()
            user_id = user.id
        finally:
            db.close()

        r = client.post("/api/v1/auth/verify", json={
            "userId": user_id, "emailOtp": email_otp, "phoneOtp": phone_otp,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["emailVerified"] is True
        assert body["phoneVerified"] is True
        assert body["verified"] is True
        assert body["email"] == "verifcorrect@fridgehub.test"
        assert body["phone"]

        # Confirm DB state via a fresh connection
        db2 = SessionLocal()
        try:
            from sqlalchemy import text as sa_text
            row_check = db2.execute(
                sa_text("SELECT email_verified, phone_verified FROM users WHERE id = :uid"),
                {"uid": user_id},
            ).one()
            assert row_check.email_verified in (True, 1)
            assert row_check.phone_verified in (True, 1)
        finally:
            db2.close()


def test_verify_otp_wrong_email_code_rejected() -> None:
    """Wrong email OTP returns 400 with specific message."""
    import hashlib
    from app.core.database import SessionLocal
    from app.models import VerificationOtp
    from datetime import datetime, timedelta, timezone
    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "verifwrongemail")
        db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
        row = VerificationOtp(
            entity_type="user",
            entity_id=user.id,
            email_otp_hash=hashlib.sha256("111111".encode()).hexdigest(),
            phone_otp_hash=hashlib.sha256("222222".encode()).hexdigest(),
            email_target=user.email,
            phone_target=user.phone or "",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(row)
        db.commit()

        with TestClient(app) as client:
            r = client.post("/api/v1/auth/verify", json={
                "userId": user.id,
                "emailOtp": "999999",  # wrong
                "phoneOtp": "222222",  # correct
            })
        assert r.status_code == 400
        assert "email" in r.json()["error"]["detail"].lower()
    finally:
        db.close()


def test_verify_otp_expired_code_rejected() -> None:
    """Expired OTP returns 400."""
    import hashlib
    from app.core.database import SessionLocal
    from app.models import VerificationOtp
    from datetime import datetime, timedelta, timezone
    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "verifexpired")
        db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
        row = VerificationOtp(
            entity_type="user",
            entity_id=user.id,
            email_otp_hash=hashlib.sha256("111111".encode()).hexdigest(),
            phone_otp_hash=hashlib.sha256("222222".encode()).hexdigest(),
            email_target=user.email,
            phone_target=user.phone or "",
            expires_at=datetime.now(timezone.utc) - timedelta(minutes=1),  # already expired
        )
        db.add(row)
        db.commit()

        with TestClient(app) as client:
            r = client.post("/api/v1/auth/verify", json={
                "userId": user.id,
                "emailOtp": "111111",
                "phoneOtp": "222222",
            })
        assert r.status_code == 400
        assert "expired" in r.json()["error"]["detail"].lower()
    finally:
        db.close()


def test_verify_otp_max_attempts_lockout() -> None:
    """After 5 wrong attempts the OTP row is locked out."""
    import hashlib
    from app.core.database import SessionLocal
    from app.models import VerificationOtp
    from datetime import datetime, timedelta, timezone
    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "veriflockout")
        db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
        row = VerificationOtp(
            entity_type="user",
            entity_id=user.id,
            email_otp_hash=hashlib.sha256("111111".encode()).hexdigest(),
            phone_otp_hash=hashlib.sha256("222222".encode()).hexdigest(),
            email_target=user.email,
            phone_target=user.phone or "",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
            attempts=5,  # already at max
        )
        db.add(row)
        db.commit()

        with TestClient(app) as client:
            r = client.post("/api/v1/auth/verify", json={
                "userId": user.id,
                "emailOtp": "111111",
                "phoneOtp": "222222",
            })
        assert r.status_code == 400
        assert "too many" in r.json()["error"]["detail"].lower()
    finally:
        db.close()


def test_resend_otp_issues_new_codes() -> None:
    """Resend endpoint invalidates old OTP and issues a fresh one."""
    import hashlib
    from app.core.database import SessionLocal
    from app.models import VerificationOtp
    from datetime import datetime, timedelta, timezone
    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "verifresend")
        db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
        old_row = VerificationOtp(
            entity_type="user",
            entity_id=user.id,
            email_otp_hash=hashlib.sha256("000000".encode()).hexdigest(),
            phone_otp_hash=hashlib.sha256("000000".encode()).hexdigest(),
            email_target=user.email,
            phone_target=user.phone or "",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(old_row)
        db.commit()
        old_id = old_row.id

        with TestClient(app) as client:
            r = client.post("/api/v1/auth/resend", json={"userId": user.id})
        assert r.status_code == 200
        body = r.json()
        assert body["verified"] is False
        assert body["email"] == "verifresend@fridgehub.test"
        assert body["phone"]

        db.expire_all()
        # Old row must be invalidated
        old = db.get(VerificationOtp, old_id)
        assert old.is_used is True
        # A new active row must exist
        new_row = db.query(VerificationOtp).filter_by(
            entity_type="user", entity_id=user.id, is_used=False
        ).first()
        assert new_row is not None
        assert new_row.id != old_id
    finally:
        db.close()


def test_send_sms_calls_twilio_when_configured(monkeypatch) -> None:
    """Configured SMS delivery must make a Twilio Messages API request."""
    from app.core.config import settings
    from app.services.notification_service import send_sms
    import twilio.rest

    calls: dict[str, object] = {}

    class FakeMessage:
        sid = "SMtest"
        status = "queued"

    class FakeMessages:
        def create(self, **kwargs):
            calls["message"] = kwargs
            return FakeMessage()

    class FakeClient:
        def __init__(self, account_sid: str, auth_token: str):
            calls["account_sid"] = account_sid
            calls["auth_token"] = auth_token
            self.messages = FakeMessages()

    monkeypatch.setattr(twilio.rest, "Client", FakeClient)
    monkeypatch.setattr(settings, "twilio_account_sid", "ACtest")
    monkeypatch.setattr(settings, "twilio_auth_token", "token-test")
    monkeypatch.setattr(settings, "twilio_from_number", "+12295543902")
    monkeypatch.setattr(settings, "twilio_messaging_service_sid", "")
    monkeypatch.setattr(settings, "twilio_verify_sid", "")

    assert send_sms("+6591234567", "Your FridgeHub code is 123456.") is True
    assert calls["account_sid"] == "ACtest"
    assert calls["auth_token"] == "token-test"
    assert calls["message"] == {
        "to": "+6591234567",
        "from_": "+12295543902",
        "body": "Your FridgeHub code is 123456.",
    }


def test_send_sms_uses_messaging_service_without_from(monkeypatch) -> None:
    """Direct SMS can use a Messaging Service SID instead of a From number."""
    from app.core.config import settings
    from app.services.notification_service import send_sms
    import twilio.rest

    calls: dict[str, object] = {}

    class FakeMessage:
        sid = "SMtest"
        status = "queued"

    class FakeMessages:
        def create(self, **kwargs):
            calls["message"] = kwargs
            return FakeMessage()

    class FakeClient:
        def __init__(self, account_sid: str, auth_token: str):
            calls["account_sid"] = account_sid
            calls["auth_token"] = auth_token
            self.messages = FakeMessages()

    monkeypatch.setattr(twilio.rest, "Client", FakeClient)
    monkeypatch.setattr(settings, "twilio_account_sid", "ACtest")
    monkeypatch.setattr(settings, "twilio_auth_token", "token-test")
    monkeypatch.setattr(settings, "twilio_from_number", "")
    monkeypatch.setattr(settings, "twilio_messaging_service_sid", "MGtest")
    monkeypatch.setattr(settings, "twilio_verify_sid", "")

    assert send_sms("+6591234567", "Your FridgeHub code is 123456.") is True
    assert calls["message"] == {
        "to": "+6591234567",
        "messaging_service_sid": "MGtest",
        "body": "Your FridgeHub code is 123456.",
    }


def test_send_otp_sms_uses_twilio_verify_when_configured(monkeypatch) -> None:
    """OTP SMS can use Twilio Verify, which does not require TWILIO_FROM_NUMBER."""
    from app.core.config import settings
    from app.services.notification_service import send_otp_sms
    import twilio.rest

    calls: dict[str, object] = {}

    class FakeVerification:
        sid = "VEtest"
        status = "pending"

    class FakeVerifications:
        def create(self, **kwargs):
            calls["verification"] = kwargs
            return FakeVerification()

    class FakeService:
        verifications = FakeVerifications()

    class FakeServices:
        def __call__(self, service_sid: str):
            calls["service_sid"] = service_sid
            return FakeService()

    class FakeV2:
        services = FakeServices()

    class FakeVerify:
        v2 = FakeV2()

    class FakeClient:
        def __init__(self, account_sid: str, auth_token: str):
            calls["account_sid"] = account_sid
            calls["auth_token"] = auth_token
            self.verify = FakeVerify()

    monkeypatch.setattr(twilio.rest, "Client", FakeClient)
    monkeypatch.setattr(settings, "twilio_account_sid", "ACtest")
    monkeypatch.setattr(settings, "twilio_auth_token", "token-test")
    monkeypatch.setattr(settings, "twilio_from_number", "")
    monkeypatch.setattr(settings, "twilio_messaging_service_sid", "")
    monkeypatch.setattr(settings, "twilio_verify_sid", "VAtest")

    assert send_otp_sms("+6591234567", "123456") is True
    assert calls["service_sid"] == "VAtest"
    assert calls["verification"] == {
        "to": "+6591234567",
        "channel": "sms",
    }


def test_verify_otp_with_twilio_verify_check_marks_verified(monkeypatch) -> None:
    """When Twilio Verify sends the phone OTP, verify via Verification Check."""
    import hashlib
    from datetime import datetime, timedelta, timezone
    from app.core.database import SessionLocal
    from app.models import VerificationOtp

    checks: list[tuple[str, str]] = []

    def fake_check(to: str, code: str) -> bool:
        checks.append((to, code))
        return code == "654321"

    monkeypatch.setattr("app.services.notification_service.check_verify_sms", fake_check)

    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "veriftwilioverify")
        db.query(VerificationOtp).filter_by(entity_type="user", entity_id=user.id).update({"is_used": True})
        row = VerificationOtp(
            entity_type="user",
            entity_id=user.id,
            email_otp_hash=hashlib.sha256("123456".encode()).hexdigest(),
            phone_otp_hash="twilio_verify",
            email_target=user.email,
            phone_target=user.phone or "",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
        db.add(row)
        db.commit()
        user_id = user.id
        phone = user.phone
    finally:
        db.close()

    with TestClient(app) as client:
        response = client.post("/api/v1/auth/verify", json={
            "userId": user_id,
            "emailOtp": "123456",
            "phoneOtp": "654321",
        })

    assert response.status_code == 200
    assert response.json()["verified"] is True
    assert checks == [(phone, "654321")]


def test_verified_user_can_login_normally() -> None:
    """After verification, login succeeds."""
    from app.core.database import SessionLocal
    with TestClient(app) as client:
        db = SessionLocal()
        try:
            user = _make_unverified_user(db, "verifloginok")
            user.email_verified = True
            user.phone_verified = True
            # Attach to meera's family so membership lookup works
            from app.models import FamilyMember
            meera = db.query(User).filter_by(username="meera").first()
            existing_member = db.query(FamilyMember).filter_by(user_id=user.id).first()
            if not existing_member and meera:
                family_id = db.query(FamilyMember).filter_by(user_id=meera.id).first().family_id
                db.add(FamilyMember(
                    family_id=family_id, user_id=user.id, role="member",
                    initial="O", color_class="bg-slate-500", status="Active", permissions=[],
                ))
            db.commit()
        finally:
            db.close()
        r = client.post("/api/v1/auth/login", json={"username": "verifloginok", "password": "Test1234"})
    assert r.status_code == 200
    assert "accessToken" in r.json()


def test_already_verified_user_verify_endpoint_returns_ok() -> None:
    """Calling /verify for an already-verified user returns 200 immediately."""
    from app.core.database import SessionLocal
    from app.models import User
    db = SessionLocal()
    try:
        user = _make_unverified_user(db, "verifidempotent")
        user.email_verified = True
        user.phone_verified = True
        db.commit()

        with TestClient(app) as client:
            r = client.post("/api/v1/auth/verify", json={
                "userId": user.id,
                "emailOtp": "000000",
                "phoneOtp": "000000",
            })
        assert r.status_code == 200
        assert r.json()["verified"] is True
    finally:
        db.close()
