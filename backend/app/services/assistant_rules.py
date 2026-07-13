from datetime import date, datetime, timedelta
from typing import Any

from app.utils.dates import today_for_timezone


def _date_prefix(value: object) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _state_today(state: dict[str, Any]) -> date:
    family = state.get("family") or {}
    return today_for_timezone(family.get("timezone") if isinstance(family, dict) else None)


def _days_until(value: object, state: dict[str, Any]) -> int:
    target = date.fromisoformat(_date_prefix(value))
    return (target - _state_today(state)).days


def _today_tasks(state: dict[str, Any]) -> list[dict[str, Any]]:
    today = _state_today(state).isoformat()
    return [
        task
        for task in state["tasks"]
        if _date_prefix(task["dueAt"]) == today and task["status"] not in {"completed", "cancelled"}
    ]


def _today_meals(state: dict[str, Any]) -> list[dict[str, Any]]:
    today = _state_today(state).isoformat()
    return [meal for meal in state["meals"] if _date_prefix(meal["planDate"]) == today]


def _expiring_items(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in state["groceryItems"]
        if item.get("expiryDate") and 0 <= _days_until(item["expiryDate"], state) <= 2
    ]


def _pending_purchases(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in state["groceryItems"] if not item["purchased"] and not item["currentStock"]]


def _unique_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[int] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        item_id = int(item["id"])
        if item_id in seen:
            continue
        seen.add(item_id)
        unique.append(item)
    return unique


def _drive_minutes(task: dict[str, Any]) -> int:
    action = str(task.get("actionLabel") or "")
    digits = "".join(character for character in action if character.isdigit())
    return int(digits) if digits else 20


def _time_value(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except ValueError:
        return None


def _leave_time(task: dict[str, Any]) -> str:
    due_at = _time_value(task.get("dueAt"))
    if not due_at:
        return "the planned reminder time"
    leave_at = due_at - timedelta(minutes=_drive_minutes(task) + 12)
    return leave_at.strftime("%-I:%M %p")


def _backup_recipe(state: dict[str, Any]) -> str:
    recipe = next(
        (item for item in state.get("recipes", []) if "uses-expiring-items" in item.get("dietaryTags", [])),
        None,
    )
    return str(recipe["recipeName"]) if recipe else "a recipe using expiring groceries"


def _open_slot_member(state: dict[str, Any]) -> str:
    members = state.get("members", [])
    if not members:
        return "the next available family member"
    return str(sorted(members, key=lambda member: int(member.get("points") or 0))[0]["name"])


def generate_insights(state: dict[str, Any]) -> list[dict[str, Any]]:
    today_tasks = _today_tasks(state)
    expiring_items = _expiring_items(state)
    pending_chores = [task for task in today_tasks if task["category"] == "chore"]
    dinner = next((meal for meal in _today_meals(state) if meal["mealType"] == "dinner"), None)
    insights: list[dict[str, Any]] = []

    school_task = next((task for task in today_tasks if task["category"] == "school"), None)
    if school_task:
        drive_minutes = _drive_minutes(school_task)
        insights.append(
            {
                "id": "leave-window",
                "title": "Leave window",
                "body": f"Leave by {_leave_time(school_task)} for {school_task['title'].lower()}; current drive estimate is {drive_minutes} minutes.",
                "type": "schedule",
                "confidence": 91,
                "action": school_task.get("actionLabel"),
            }
        )

    if expiring_items:
        names = ", ".join(item["itemName"].lower() for item in expiring_items)
        insights.append(
            {
                "id": "expiry-watch",
                "title": "Expiry watch",
                "body": f"{names} expire within 48 hours. Use them before the next grocery cycle closes.",
                "type": "grocery",
                "confidence": 88,
                "action": "Review groceries",
            }
        )

    if dinner:
        backup_recipe = _backup_recipe(state)
        insights.append(
            {
                "id": "dinner-suggestion",
                "title": "Dinner fit",
                "body": f"{dinner['mealName']} is planned for dinner. {backup_recipe} remains a backup because it uses expiring groceries.",
                "type": "meal",
                "confidence": 82,
                "action": "Open meals",
            }
        )

    if pending_chores:
        verb = "remains" if len(pending_chores) == 1 else "remain"
        member_name = _open_slot_member(state)
        insights.append(
            {
                "id": "chore-balance",
                "title": "Chore balance",
                "body": f"{len(pending_chores)} chore{'s' if len(pending_chores) != 1 else ''} {verb} today. {member_name} has the next open slot.",
                "type": "task",
                "confidence": 76,
                "action": "Assign chore",
            }
        )

    return insights


def answer_query(query: str, state: dict[str, Any]) -> str:
    normalized = query.lower()
    expiring_items = _expiring_items(state)
    pending_purchases = _pending_purchases(state)
    today_tasks = _today_tasks(state)
    dinner = next((meal for meal in _today_meals(state) if meal["mealType"] == "dinner"), None)

    if any(token in normalized for token in ["grocery", "groceries", "expire", "shopping"]):
        if not expiring_items and not pending_purchases:
            return "No urgent grocery action is open. The current cycle is clean."
        names = ", ".join(item["itemName"].lower() for item in _unique_items([*expiring_items, *pending_purchases])[:4])
        return f"Prioritize {names}. {len(pending_purchases)} item{'s' if len(pending_purchases) != 1 else ''} still need purchase confirmation."

    if any(token in normalized for token in ["meal", "dinner", "cook"]):
        if dinner:
            return f"{dinner['mealName']} is planned for dinner at about {dinner['calories']} calories. {_backup_recipe(state)} is the smartest fallback because it clears expiring groceries."
        return f"No dinner is planned for today. Apply the weekly template or pick {_backup_recipe(state)} from the recipe library."

    if any(token in normalized for token in ["task", "reminder", "today"]):
        if not today_tasks:
            return "No active task remains for today."
        first_task = today_tasks[0]
        return f"The next active task is {first_task['title'].lower()}. {len(today_tasks)} active reminder{'s' if len(today_tasks) != 1 else ''} remain today."

    if any(token in normalized for token in ["school", "leave"]):
        school_task = next((task for task in today_tasks if task["category"] == "school"), None)
        if school_task:
            return f"Leave by {_leave_time(school_task)} for {school_task['title'].lower()}. The event is scheduled for {school_task['dueAt']}."
        return "There is no school event in today's active task list."

    return "The strongest recommendations are to handle the school travel window, use milk and spinach before expiry, and close the pending grocery purchases before the weekly cycle ends."
