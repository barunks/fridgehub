from datetime import UTC, datetime
from decimal import Decimal
from threading import Lock
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from app.core.cache import cache, cache_key
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
)

_bootstrap_locks: dict[int, Lock] = {}


def _number(value: Decimal | int | float | None) -> float:
    return float(value or 0)


def get_family(db: Session, family_id: int) -> Family:
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return family


def invalidate_family_cache(family_id: int) -> None:
    cache.invalidate_prefix(cache_key("bootstrap", family_id=family_id))


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
    active_sub_items = [sub_item for sub_item in item.sub_list_items if sub_item.purchase_cycle and not sub_item.purchase_cycle.is_completed]
    if not active_sub_items:
        return False
    return any(sub_item.is_purchased for sub_item in active_sub_items)


def serialize_grocery_item(item: GroceryItem) -> dict[str, Any]:
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
        "purchased": item_is_purchased(item),
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


def bootstrap_state(db: Session, family_id: int) -> dict[str, Any]:
    key = cache_key("bootstrap", family_id=family_id)
    cached = cache.get(key)
    if cached:
        return cached

    lock = _bootstrap_locks.setdefault(family_id, Lock())
    with lock:
        cached = cache.get(key)
        if cached:
            return cached

        family = (
            db.query(Family)
            .options(selectinload(Family.members).selectinload(FamilyMember.user))
            .filter(Family.id == family_id)
            .first()
        )
        if not family:
            raise HTTPException(status_code=404, detail="Family not found")

        list_types = db.query(GroceryListType).filter_by(family_id=family_id, is_active=True).order_by(GroceryListType.id).all()
        grocery_items = (
            db.query(GroceryItem)
            .options(selectinload(GroceryItem.sub_list_items).selectinload(GrocerySubList.purchase_cycle))
            .filter_by(family_id=family_id, is_active=True)
            .order_by(GroceryItem.id)
            .all()
        )
        cycles = db.query(GroceryPurchaseCycle).filter_by(family_id=family_id).order_by(GroceryPurchaseCycle.id).all()
        tasks = db.query(Task).filter_by(family_id=family_id, is_active=True).order_by(Task.due_date).all()
        meals = db.query(MealPlan).filter_by(family_id=family_id, is_active=True).order_by(MealPlan.plan_date, MealPlan.id).all()
        recipes = db.query(Recipe).filter(Recipe.family_id.in_([family_id, None]), Recipe.is_active.is_(True)).order_by(Recipe.id).all()
        notifications = db.query(Notification).filter_by(family_id=family_id).order_by(Notification.created_at.desc()).all()
        announcements = db.query(Announcement).filter_by(family_id=family_id).order_by(Announcement.created_at.desc()).all()
        emergency_contacts = db.query(EmergencyContact).filter_by(family_id=family_id).order_by(EmergencyContact.id).all()

        payload = {
            "family": serialize_family(family),
            "members": [serialize_member(member) for member in family.members],
            "listTypes": [serialize_list_type(list_type) for list_type in list_types],
            "groceryItems": [serialize_grocery_item(item) for item in grocery_items],
            "groceryCycles": [serialize_cycle(cycle) for cycle in cycles],
            "tasks": [serialize_task(task) for task in tasks],
            "meals": [serialize_meal(meal) for meal in meals],
            "recipes": [serialize_recipe(recipe) for recipe in recipes],
            "notifications": [serialize_notification(notification) for notification in notifications],
            "announcements": [serialize_announcement(announcement) for announcement in announcements],
            "emergencyContacts": [serialize_emergency_contact(contact) for contact in emergency_contacts],
            "assistantMessages": default_assistant_messages(),
        }
        cache.set(key, payload, ttl_seconds=300)
        return payload
