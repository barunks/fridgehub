from datetime import date, datetime, timedelta
from typing import Any

from app.utils.dates import today_for_timezone

MEAL_TYPES = ("breakfast", "lunch", "snacks", "dinner")
SEVERITY_RANK = {"critical": 0, "warning": 1, "info": 2}


def _rows(state: dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = state.get(key) or []
    return value if isinstance(value, list) else []


def _date_prefix(value: object) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)[:10]


def _state_today(state: dict[str, Any]) -> date:
    family = state.get("family") or {}
    timezone = family.get("timezone") if isinstance(family, dict) else None
    return today_for_timezone(timezone)


def _parse_date(value: object, state: dict[str, Any]) -> date | None:
    try:
        return date.fromisoformat(_date_prefix(value))
    except (TypeError, ValueError):
        return None


def _days_until(value: object, state: dict[str, Any]) -> int:
    target = _parse_date(value, state)
    if not target:
        return 9999
    return (target - _state_today(state)).days


def _format_day(value: object, state: dict[str, Any]) -> str:
    days = _days_until(value, state)
    if days == 0:
        return "today"
    if days == 1:
        return "tomorrow"
    if days == -1:
        return "yesterday"
    if days < 0:
        return f"{abs(days)} days overdue"
    return f"in {days} days"


def _time_value(value: object) -> datetime | None:
    if isinstance(value, datetime):
        return value
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return None


def _join_names(values: list[str], limit: int = 4) -> str:
    names = [value for value in values if value][:limit]
    if not names:
        return "none"
    suffix = "" if len(values) <= limit else f" and {len(values) - limit} more"
    return ", ".join(names) + suffix


def _member_name(state: dict[str, Any], user_id: int | None) -> str:
    if not user_id:
        return "Family"
    member = next((row for row in _rows(state, "members") if int(row.get("id") or 0) == int(user_id)), None)
    return str(member.get("name")) if member else "Family"


def _member_for_query(query: str, state: dict[str, Any]) -> dict[str, Any] | None:
    normalized = query.lower()
    return next(
        (member for member in _rows(state, "members") if str(member.get("name") or "").lower() in normalized),
        None,
    )


def _active_tasks(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        task
        for task in _rows(state, "tasks")
        if task.get("status") not in {"completed", "cancelled"}
    ]


def _today_tasks(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [task for task in _active_tasks(state) if _days_until(task.get("dueAt"), state) == 0]


def _overdue_tasks(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [task for task in _active_tasks(state) if _days_until(task.get("dueAt"), state) < 0]


def _upcoming_tasks(state: dict[str, Any], days: int = 3) -> list[dict[str, Any]]:
    return [task for task in _active_tasks(state) if 0 <= _days_until(task.get("dueAt"), state) <= days]


def _today_meals(state: dict[str, Any]) -> list[dict[str, Any]]:
    today = _state_today(state).isoformat()
    return [meal for meal in _rows(state, "meals") if _date_prefix(meal.get("planDate")) == today]


def _dinner(state: dict[str, Any]) -> dict[str, Any] | None:
    return next((meal for meal in _today_meals(state) if meal.get("mealType") == "dinner"), None)


def _missing_today_meal_types(state: dict[str, Any]) -> list[str]:
    planned = {str(meal.get("mealType")) for meal in _today_meals(state)}
    return [meal_type for meal_type in MEAL_TYPES if meal_type not in planned]


def _expiring_items(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in _rows(state, "groceryItems")
        if item.get("expiryDate") and 0 <= _days_until(item.get("expiryDate"), state) <= 2
    ]


def _pending_groceries(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        item
        for item in _rows(state, "groceryItems")
        if item.get("needsPurchase") or (not item.get("purchased") and not item.get("currentStock"))
    ]


def _pending_shopping_items(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [item for item in _rows(state, "shoppingItems") if not item.get("isPurchased")]


def _unique_by_name(items: list[dict[str, Any]], name_key: str = "itemName") -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in items:
        name = str(item.get(name_key) or "").strip().lower()
        if not name or name in seen:
            continue
        seen.add(name)
        unique.append(item)
    return unique


def _unread_notifications(state: dict[str, Any]) -> list[dict[str, Any]]:
    return [notification for notification in _rows(state, "notifications") if not notification.get("isRead")]


def _drive_minutes(task: dict[str, Any]) -> int:
    action = str(task.get("actionLabel") or "")
    digits = "".join(character for character in action if character.isdigit())
    return int(digits) if digits else 20


def _leave_time(task: dict[str, Any]) -> str:
    due_at = _time_value(task.get("dueAt"))
    if not due_at:
        return "the planned reminder time"
    leave_at = due_at - timedelta(minutes=_drive_minutes(task) + 12)
    return leave_at.strftime("%I:%M %p").lstrip("0")


def _backup_recipe(state: dict[str, Any]) -> str:
    recipe = next(
        (item for item in _rows(state, "recipes") if "uses-expiring-items" in item.get("dietaryTags", [])),
        None,
    )
    return str(recipe["recipeName"]) if recipe else "a recipe using expiring groceries"


def _open_slot_member(state: dict[str, Any]) -> str:
    members = _rows(state, "members")
    if not members:
        return "the next available family member"
    return str(sorted(members, key=lambda member: int(member.get("points") or 0))[0].get("name") or "the next available family member")


def _task_load(state: dict[str, Any]) -> tuple[str, str, int] | None:
    members = _rows(state, "members")
    if len(members) < 2:
        return None
    counts = {int(member.get("id") or 0): 0 for member in members}
    for task in _upcoming_tasks(state, days=7):
        assigned_to = int(task.get("assignedTo") or 0)
        if assigned_to in counts:
            counts[assigned_to] += 1
    busiest_id = max(counts, key=counts.get)
    lightest_id = min(counts, key=counts.get)
    difference = counts[busiest_id] - counts[lightest_id]
    if difference < 2:
        return None
    return _member_name(state, busiest_id), _member_name(state, lightest_id), difference


def _insight(
    *,
    insight_id: str,
    title: str,
    body: str,
    insight_type: str,
    confidence: int,
    action: str,
    route: str,
    severity: str,
) -> dict[str, Any]:
    return {
        "id": insight_id,
        "title": title,
        "body": body,
        "type": insight_type,
        "confidence": confidence,
        "action": action,
        "route": route,
        "severity": severity,
    }


def generate_insights(state: dict[str, Any]) -> list[dict[str, Any]]:
    insights: list[dict[str, Any]] = []
    today_tasks = _today_tasks(state)
    overdue_tasks = _overdue_tasks(state)
    expiring_items = _expiring_items(state)
    pending_groceries = _pending_groceries(state)
    pending_shopping = _pending_shopping_items(state)
    dinner = _dinner(state)
    missing_meals = _missing_today_meal_types(state)
    unread = _unread_notifications(state)

    if overdue_tasks:
        names = _join_names([str(task.get("title") or "").lower() for task in overdue_tasks], limit=3)
        insights.append(
            _insight(
                insight_id="overdue-reminders",
                title="Overdue reminders",
                body=f"{len(overdue_tasks)} reminder{'s are' if len(overdue_tasks) != 1 else ' is'} overdue: {names}.",
                insight_type="task",
                confidence=96,
                action="Open tasks",
                route="/tasks",
                severity="critical",
            )
        )

    school_task = next((task for task in today_tasks if task.get("category") == "school"), None)
    if school_task:
        drive_minutes = _drive_minutes(school_task)
        insights.append(
            _insight(
                insight_id="leave-window",
                title="Leave window",
                body=f"Leave by {_leave_time(school_task)} for {str(school_task.get('title') or '').lower()}; current drive estimate is {drive_minutes} minutes.",
                insight_type="schedule",
                confidence=91,
                action=school_task.get("actionLabel") or "Open tasks",
                route="/tasks",
                severity="warning",
            )
        )

    if missing_meals:
        insights.append(
            _insight(
                insight_id="meal-plan-gaps",
                title="Meal plan gaps",
                body=f"Today's plan is missing {', '.join(missing_meals)}. Apply a weekly template or edit the open slots.",
                insight_type="meal",
                confidence=89,
                action="Open meals",
                route="/meals",
                severity="warning",
            )
        )

    if pending_shopping or pending_groceries:
        items = _unique_by_name([*pending_shopping, *pending_groceries])
        names = _join_names([str(item.get("itemName") or "").lower() for item in items], limit=5)
        insights.append(
            _insight(
                insight_id="shopping-gaps",
                title="Shopping gaps",
                body=f"{len(items)} grocery item{'s need' if len(items) != 1 else ' needs'} action: {names}.",
                insight_type="grocery",
                confidence=90,
                action="Review groceries",
                route="/groceries",
                severity="warning",
            )
        )

    if expiring_items:
        names = _join_names([str(item.get("itemName") or "").lower() for item in expiring_items], limit=4)
        insights.append(
            _insight(
                insight_id="expiry-watch",
                title="Expiry watch",
                body=f"{names} expire within 48 hours. Use them before the next grocery cycle closes.",
                insight_type="grocery",
                confidence=88,
                action="Review groceries",
                route="/groceries",
                severity="warning",
            )
        )

    if today_tasks:
        names = _join_names([str(task.get("title") or "").lower() for task in today_tasks], limit=4)
        insights.append(
            _insight(
                insight_id="today-reminders",
                title="Today's reminders",
                body=f"{len(today_tasks)} active reminder{'s' if len(today_tasks) != 1 else ''} remain today: {names}.",
                insight_type="task",
                confidence=84,
                action="Open tasks",
                route="/tasks",
                severity="info",
            )
        )

    if dinner:
        insights.append(
            _insight(
                insight_id="dinner-suggestion",
                title="Dinner fit",
                body=f"{dinner.get('mealName')} is planned for dinner. {_backup_recipe(state)} remains a fallback because it can clear expiring groceries.",
                insight_type="meal",
                confidence=82,
                action="Open meals",
                route="/meals",
                severity="info",
            )
        )

    load = _task_load(state)
    if load:
        busiest, lightest, difference = load
        insights.append(
            _insight(
                insight_id="family-load-balance",
                title="Load balance",
                body=f"{busiest} has {difference} more upcoming tasks than {lightest}. Reassign one reminder if the day gets tight.",
                insight_type="family",
                confidence=77,
                action="Open family",
                route="/family",
                severity="info",
            )
        )

    if unread:
        insights.append(
            _insight(
                insight_id="unread-notifications",
                title="Unread notifications",
                body=f"{len(unread)} notification{'s are' if len(unread) != 1 else ' is'} unread. Check these before closing the day.",
                insight_type="family",
                confidence=74,
                action="Open home",
                route="/",
                severity="info",
            )
        )

    if not insights:
        insights.append(
            _insight(
                insight_id="all-clear",
                title="No urgent gaps",
                body="No overdue reminders, missing meal slots, or urgent grocery gaps are visible right now.",
                insight_type="family",
                confidence=72,
                action="Open home",
                route="/",
                severity="info",
            )
        )

    return sorted(
        insights,
        key=lambda item: (SEVERITY_RANK.get(str(item.get("severity")), 3), -int(item.get("confidence") or 0), str(item.get("title") or "")),
    )


def _top_attention_summary(state: dict[str, Any]) -> str:
    insights = [insight for insight in generate_insights(state) if insight["id"] != "all-clear"]
    if not insights:
        return "No critical gaps are visible right now. The current reminders, meals, and grocery signals look covered."
    critical = [insight for insight in insights if insight.get("severity") == "critical"]
    warnings = [insight for insight in insights if insight.get("severity") == "warning"]
    lead = f"I found {len(insights)} attention item{'s' if len(insights) != 1 else ''}"
    if critical:
        lead += f", including {len(critical)} critical"
    if warnings:
        lead += f" and {len(warnings)} warning"
    titles = "; ".join(f"{insight['title']}: {insight['body']}" for insight in insights[:3])
    return f"{lead}. {titles}"


def _answer_item_query(query: str, state: dict[str, Any]) -> str | None:
    normalized = query.lower()
    for item in _rows(state, "groceryItems"):
        name = str(item.get("itemName") or "")
        if name and name.lower() in normalized:
            stock = "in stock" if item.get("currentStock") else "not in current stock"
            purchase = "marked purchased" if item.get("purchased") else "not yet purchased"
            expiry = f", expires {_format_day(item.get('expiryDate'), state)}" if item.get("expiryDate") else ""
            return f"{name} is {stock} and {purchase}. Frequency is {item.get('purchaseFrequency', 'weekly')}; quantity is {item.get('quantity', 0)} {item.get('unit', '')}{expiry}."
    return None


def _answer_member_query(query: str, state: dict[str, Any]) -> str | None:
    member = _member_for_query(query, state)
    if not member:
        return None
    member_id = int(member.get("id") or 0)
    tasks = [task for task in _active_tasks(state) if int(task.get("assignedTo") or 0) == member_id]
    meals = [meal for meal in _today_meals(state) if int(meal.get("assignedTo") or 0) in {0, member_id}]
    next_task = sorted(tasks, key=lambda task: str(task.get("dueAt") or ""))[0] if tasks else None
    name = str(member.get("name") or "This member")
    if next_task:
        return f"{name} has {len(tasks)} active task{'s' if len(tasks) != 1 else ''}. Next is {str(next_task.get('title') or '').lower()} due {_format_day(next_task.get('dueAt'), state)}. {len(meals)} meal slot{'s are' if len(meals) != 1 else ' is'} visible for today."
    return f"{name} has no active tasks. {len(meals)} meal slot{'s are' if len(meals) != 1 else ' is'} visible for today."


def _answer_groceries(state: dict[str, Any]) -> str:
    expiring = _expiring_items(state)
    pending = _unique_by_name([*_pending_shopping_items(state), *_pending_groceries(state)])
    if not expiring and not pending:
        return "No urgent grocery action is open. Current stock and shopping-cycle signals look clean."
    parts: list[str] = []
    if pending:
        names = _join_names([str(item.get("itemName") or "").lower() for item in pending], limit=5)
        parts.append(f"buy or confirm {names}")
    if expiring:
        names = _join_names([str(item.get("itemName") or "").lower() for item in expiring], limit=4)
        parts.append(f"use {names} before expiry")
    return "Grocery priority: " + "; ".join(parts) + "."


def _answer_meals(state: dict[str, Any]) -> str:
    missing = _missing_today_meal_types(state)
    dinner = _dinner(state)
    if missing and dinner:
        return f"{dinner.get('mealName')} is planned for dinner, but today's plan is missing {', '.join(missing)}. Fill those slots from the weekly template."
    if missing:
        return f"Today's meal plan is missing {', '.join(missing)}. Apply a weekly template or edit those slots directly."
    if dinner:
        return f"{dinner.get('mealName')} is planned for dinner at about {dinner.get('calories')} calories. {_backup_recipe(state)} is the best fallback because it can use expiring groceries."
    return f"No dinner is planned for today. Apply the weekly template or pick {_backup_recipe(state)} from the recipe library."


def _answer_tasks(state: dict[str, Any]) -> str:
    overdue = _overdue_tasks(state)
    today = _today_tasks(state)
    upcoming = _upcoming_tasks(state)
    if overdue:
        names = _join_names([str(task.get("title") or "").lower() for task in overdue], limit=4)
        return f"Start with overdue reminders: {names}. Then clear today's active reminders."
    if today:
        first = sorted(today, key=lambda task: str(task.get("dueAt") or ""))[0]
        return f"The next active reminder is {str(first.get('title') or '').lower()} due {_format_day(first.get('dueAt'), state)}. {len(today)} active reminder{'s' if len(today) != 1 else ''} remain today."
    if upcoming:
        names = _join_names([str(task.get("title") or "").lower() for task in upcoming], limit=4)
        return f"No active task remains today. Upcoming reminders in the next 3 days: {names}."
    return "No active reminders are visible in the next 3 days."


def _answer_notifications(state: dict[str, Any]) -> str:
    unread = _unread_notifications(state)
    if not unread:
        return "No unread notifications are visible."
    names = _join_names([str(item.get("title") or "").lower() for item in unread], limit=4)
    return f"{len(unread)} unread notification{'s need' if len(unread) != 1 else ' needs'} review: {names}."


def _answer_school(state: dict[str, Any]) -> str:
    school_task = next((task for task in _today_tasks(state) if task.get("category") == "school"), None)
    if school_task:
        return f"Leave by {_leave_time(school_task)} for {str(school_task.get('title') or '').lower()}. The event is scheduled for {school_task.get('dueAt')}."
    return "There is no school event in today's active task list."


def answer_query(query: str, state: dict[str, Any]) -> str:
    normalized = query.lower().strip()

    item_answer = _answer_item_query(normalized, state)
    if item_answer:
        return item_answer

    member_answer = _answer_member_query(normalized, state)
    if member_answer:
        return member_answer

    if any(token in normalized for token in ["gap", "miss", "alert", "risk", "issue", "attention", "what should", "next"]):
        return _top_attention_summary(state)

    if any(token in normalized for token in ["grocery", "groceries", "expire", "shopping", "buy", "stock"]):
        return _answer_groceries(state)

    if any(token in normalized for token in ["meal", "dinner", "cook", "breakfast", "lunch", "snack"]):
        return _answer_meals(state)

    if any(token in normalized for token in ["task", "reminder", "today", "overdue", "chore"]):
        return _answer_tasks(state)

    if any(token in normalized for token in ["school", "leave", "travel"]):
        return _answer_school(state)

    if any(token in normalized for token in ["notification", "unread", "message"]):
        return _answer_notifications(state)

    if any(token in normalized for token in ["family", "load", "balance", "assign"]):
        load = _task_load(state)
        if load:
            busiest, lightest, difference = load
            return f"{busiest} has {difference} more upcoming tasks than {lightest}. Reassign one reminder if needed."
        return f"The active task load looks balanced. {_open_slot_member(state)} has the next open slot if something new comes in."

    return _top_attention_summary(state)
