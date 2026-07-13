import logging
from datetime import UTC, datetime
from decimal import Decimal
from threading import Lock
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.cache import cache, cache_key
from app.core.permissions import effective_permissions
from app.models import (
    Announcement,
    EmergencyContact,
    Family,
    FamilyMember,
    GroceryItem,
    GroceryListType,
    GroceryPurchaseCycle,
    GrocerySubList,
    MealPlan,
    Notification,
    Recipe,
    Task,
    User,
)
from app.services.assistant_rules import generate_insights

_bootstrap_locks: dict[int, Lock] = {}
logger = logging.getLogger("familyhub.family_service")

# Entity cache key helpers
ENTITIES = (
    "members",
    "list_types",
    "groceries",
    "cycles",
    "shopping_items",
    "tasks",
    "meals",
    "recipes",
    "notifications",
    "announcements",
    "contacts",
)


def _entity_key(entity: str, family_id: int) -> str:
    namespace = f"family:{family_id}:{entity}"
    version = cache.namespace_version(namespace)
    return cache_key(entity, family_id=family_id, version=version)


def invalidate_entity(entity: str, family_id: int) -> None:
    """Invalidate a single entity cache for a family."""
    try:
        cache.bump_namespace(f"family:{family_id}:{entity}")
    except Exception:
        logger.exception("Failed to invalidate cache entity=%s family_id=%s", entity, family_id)


def invalidate_family_cache(family_id: int) -> None:
    """Invalidate all entity caches for a family (used for bulk operations)."""
    for entity in (*ENTITIES, "family"):
        invalidate_entity(entity, family_id)


def _number(value: Decimal | int | float | None) -> float:
    return float(value or 0)


def get_family(db: Session, family_id: int) -> Family:
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family


def serialize_family(family: Family) -> dict[str, Any]:
    return {
        "id": family.id,
        "familyName": family.family_name,
        "homeBase": family.home_base,
        "timezone": family.timezone,
        "planStatus": "api-ready",
    }


def serialize_member(member: FamilyMember) -> dict[str, Any]:
    return {
        "id": member.user_id,
        "name": member.user.full_name or member.user.username,
        "role": member.role,
        "permissions": sorted(effective_permissions(member.role, member.permissions)),
        "colorClass": member.color_class,
        "initial": member.initial,
        "status": member.status,
        "points": member.points,
        "dietaryNotes": member.dietary_notes,
    }


def serialize_list_type(list_type: GroceryListType) -> dict[str, Any]:
    return {
        "id": list_type.id,
        "listName": list_type.list_name,
        "listType": list_type.list_type,
        "description": list_type.description,
        "colorClass": list_type.color_class,
    }


def item_is_purchased(item: GroceryItem) -> bool:
    if not item.is_active:
        return False
    active_sub_items = [sub_item for sub_item in item.sub_list_items if sub_item.purchase_cycle and not sub_item.purchase_cycle.is_completed]
    if not active_sub_items:
        return False
    return any(sub_item.is_purchased for sub_item in active_sub_items)


def serialize_grocery_item(item: GroceryItem) -> dict[str, Any]:
    purchased = item_is_purchased(item)
    return {
        "id": item.id,
        "itemNumber": item.item_number,
        "itemName": item.item_name,
        "listTypeId": item.list_type_id,
        "quantity": _number(item.quantity),
        "unit": item.unit or "",
        "purchaseFrequency": item.purchase_frequency,
        "currentStock": item.current_stock,
        "startDate": item.start_date,
        "expiryDate": item.expiry_date,
        "notes": item.notes or "",
        "familyId": item.family_id,
        "purchased": purchased,
        "needsPurchase": not item.current_stock and not purchased,
    }


def serialize_cycle(cycle: GroceryPurchaseCycle) -> dict[str, Any]:
    return {
        "id": cycle.id,
        "listTypeId": cycle.list_type_id,
        "frequency": cycle.frequency,
        "cycleStartDate": cycle.cycle_start_date,
        "cycleEndDate": cycle.cycle_end_date,
        "isCompleted": cycle.is_completed,
    }


def serialize_shopping_item(sub_item: GrocerySubList) -> dict[str, Any]:
    item = sub_item.item
    cycle = sub_item.purchase_cycle
    return {
        "id": sub_item.id,
        "cycleId": sub_item.purchase_cycle_id,
        "itemId": sub_item.item_id,
        "itemNumber": item.item_number if item else "",
        "itemName": item.item_name if item else "",
        "listTypeId": cycle.list_type_id if cycle else item.list_type_id if item else 0,
        "frequency": cycle.frequency if cycle else item.purchase_frequency if item else "weekly",
        "quantity": _number(sub_item.quantity),
        "unit": sub_item.unit or "",
        "isPurchased": sub_item.is_purchased,
        "purchasedQuantity": _number(sub_item.purchased_quantity),
        "notes": sub_item.notes or "",
        "isAdhoc": sub_item.is_adhoc,
        "carriedForward": sub_item.carried_forward,
    }


def serialize_task(task: Task) -> dict[str, Any]:
    due_at = task.due_date or datetime.now(UTC)
    reminder_at = task.reminder_date or due_at

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description or "",
        "priority": task.priority,
        "status": task.status,
        "dueAt": due_at,
        "reminderAt": reminder_at,
        "recurrenceType": task.recurrence_type,
        "recurrenceInterval": task.recurrence_interval,
        "assignedTo": task.assigned_to or 0,
        "category": task.category or "general",
        "actionLabel": task.action_label,
    }


def serialize_meal(meal: MealPlan) -> dict[str, Any]:
    return {
        "id": meal.id,
        "planDate": meal.plan_date,
        "dayOfWeek": meal.day_of_week,
        "mealType": meal.meal_type or "breakfast",
        "mealName": meal.meal_name or "",
        "description": meal.description or "",
        "calories": meal.calories or 0,
        "prepTime": meal.prep_time or 0,
        "recipeId": meal.recipe_id,
        "colorClass": meal.color_class,
        "assignedTo": meal.assigned_to,
        "dietaryFlags": meal.dietary_flags or [],
    }


def serialize_recipe(recipe: Recipe) -> dict[str, Any]:
    return {
        "id": recipe.id,
        "recipeName": recipe.recipe_name,
        "description": recipe.description or "",
        "ingredients": recipe.ingredients or [],
        "prepTime": recipe.prep_time or 0,
        "cookTime": recipe.cook_time or 0,
        "servings": recipe.servings or 0,
        "difficulty": recipe.difficulty or "easy",
        "cuisine": recipe.cuisine or "",
        "dietaryTags": recipe.dietary_tags or [],
    }


def serialize_notification(notification: Notification) -> dict[str, Any]:
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message or "",
        "type": notification.type or "system",
        "isRead": notification.is_read,
        "createdAt": notification.created_at,
    }


def serialize_announcement(announcement: Announcement) -> dict[str, Any]:
    return {
        "id": announcement.id,
        "title": announcement.title,
        "message": announcement.message,
        "ownerId": announcement.owner_id or 0,
        "createdAt": announcement.created_at,
        "tag": announcement.tag,
    }


def serialize_emergency_contact(contact: EmergencyContact) -> dict[str, Any]:
    return {
        "id": contact.id,
        "label": contact.label,
        "value": contact.value,
    }


def default_assistant_messages() -> list[dict[str, Any]]:
    return [
        {
            "id": 1,
            "sender": "assistant",
            "content": "School travel and grocery expiry alerts are ready.",
            "createdAt": datetime.now(UTC),
        }
    ]


def _fetch_entity(db: Session, entity: str, family_id: int) -> Any:
    """Fetch and cache a single entity for a family."""
    key: str | None = None
    try:
        key = _entity_key(entity, family_id)
        cached = cache.get(key)
        if cached is not None:
            return cached
    except Exception:
        logger.exception("Failed to read cache entity=%s family_id=%s", entity, family_id)

    if entity == "family":
        family = (
            db.query(Family)
            .options(selectinload(Family.members).selectinload(FamilyMember.user))
            .filter(Family.id == family_id)
            .first()
        )
        if not family:
            raise HTTPException(status_code=404, detail="Family not found")
        data = serialize_family(family)
    elif entity == "members":
        members = (
            db.query(FamilyMember)
            .options(selectinload(FamilyMember.user))
            .join(User, FamilyMember.user_id == User.id)
            .filter(
                FamilyMember.family_id == family_id,
                FamilyMember.is_active.is_(True),
                User.is_active.is_(True),
            )
            .order_by(FamilyMember.id)
            .all()
        )
        data = [serialize_member(m) for m in members]
    elif entity == "list_types":
        data = [serialize_list_type(lt) for lt in db.query(GroceryListType).filter_by(family_id=family_id, is_active=True).order_by(GroceryListType.id).all()]
    elif entity == "groceries":
        items = (
            db.query(GroceryItem)
            .options(selectinload(GroceryItem.sub_list_items).selectinload(GrocerySubList.purchase_cycle))
            .filter_by(family_id=family_id, is_active=True)
            .order_by(GroceryItem.id)
            .all()
        )
        data = [serialize_grocery_item(i) for i in items]
    elif entity == "cycles":
        cycles = (
            db.query(GroceryPurchaseCycle)
            .join(GroceryListType, GroceryPurchaseCycle.list_type_id == GroceryListType.id)
            .join(GrocerySubList, GrocerySubList.purchase_cycle_id == GroceryPurchaseCycle.id)
            .join(GroceryItem, GrocerySubList.item_id == GroceryItem.id)
            .filter(
                GroceryPurchaseCycle.family_id == family_id,
                GroceryListType.is_active.is_(True),
                GroceryItem.is_active.is_(True),
            )
            .distinct()
            .order_by(GroceryPurchaseCycle.id)
            .all()
        )
        data = [serialize_cycle(c) for c in cycles]
    elif entity == "shopping_items":
        sub_items = (
            db.query(GrocerySubList)
            .join(GroceryPurchaseCycle, GrocerySubList.purchase_cycle_id == GroceryPurchaseCycle.id)
            .join(GroceryItem, GrocerySubList.item_id == GroceryItem.id)
            .join(GroceryListType, GroceryPurchaseCycle.list_type_id == GroceryListType.id)
            .filter(
                GroceryPurchaseCycle.family_id == family_id,
                GroceryPurchaseCycle.is_completed.is_(False),
                GroceryListType.is_active.is_(True),
                GroceryItem.is_active.is_(True),
            )
            .options(selectinload(GrocerySubList.item), selectinload(GrocerySubList.purchase_cycle))
            .order_by(GroceryPurchaseCycle.id, GrocerySubList.id)
            .all()
        )
        data = [serialize_shopping_item(sub_item) for sub_item in sub_items]
    elif entity == "tasks":
        data = [serialize_task(t) for t in db.query(Task).filter_by(family_id=family_id, is_active=True).order_by(Task.due_date).all()]
    elif entity == "meals":
        data = [serialize_meal(m) for m in db.query(MealPlan).filter_by(family_id=family_id, is_active=True).order_by(MealPlan.plan_date, MealPlan.id).all()]
    elif entity == "recipes":
        data = [
            serialize_recipe(r)
            for r in db.query(Recipe)
            .filter(((Recipe.family_id == family_id) | (Recipe.family_id.is_(None))), Recipe.is_active.is_(True))
            .order_by(Recipe.id)
            .all()
        ]
    elif entity == "notifications":
        data = [serialize_notification(n) for n in db.query(Notification).filter_by(family_id=family_id).order_by(Notification.created_at.desc()).all()]
    elif entity == "announcements":
        data = [serialize_announcement(a) for a in db.query(Announcement).filter_by(family_id=family_id).order_by(Announcement.created_at.desc()).all()]
    elif entity == "contacts":
        data = [serialize_emergency_contact(c) for c in db.query(EmergencyContact).filter_by(family_id=family_id).order_by(EmergencyContact.id).all()]
    else:
        data = []

    if key:
        try:
            cache.set(key, data, ttl_seconds=300)
        except Exception:
            logger.exception("Failed to write cache entity=%s family_id=%s", entity, family_id)
    return data


def bootstrap_state(db: Session, family_id: int) -> dict[str, Any]:
    lock = _bootstrap_locks.setdefault(family_id, Lock())
    with lock:
        state = {
            "family": _fetch_entity(db, "family", family_id),
            "members": _fetch_entity(db, "members", family_id),
            "listTypes": _fetch_entity(db, "list_types", family_id),
            "groceryItems": _fetch_entity(db, "groceries", family_id),
            "groceryCycles": _fetch_entity(db, "cycles", family_id),
            "shoppingItems": _fetch_entity(db, "shopping_items", family_id),
            "tasks": _fetch_entity(db, "tasks", family_id),
            "meals": _fetch_entity(db, "meals", family_id),
            "recipes": _fetch_entity(db, "recipes", family_id),
            "notifications": _fetch_entity(db, "notifications", family_id),
            "announcements": _fetch_entity(db, "announcements", family_id),
            "emergencyContacts": _fetch_entity(db, "contacts", family_id),
            "assistantMessages": default_assistant_messages(),
        }
        state["assistantInsights"] = generate_insights(state)
        return state
