from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import MealPlan, MealPlanTemplate, Recipe
from app.schemas.familyhub import MealUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_meal, serialize_recipe
from app.services.notification_service import create_notification
from app.utils.dates import start_of_week
from app.utils.sanitize import sanitize_text


def weekly_meals(db: Session, family_id: int) -> list[dict]:
    start = start_of_week()
    end = start + timedelta(days=6)
    rows = (
        db.query(MealPlan)
        .filter(MealPlan.family_id == family_id, MealPlan.plan_date >= start, MealPlan.plan_date <= end, MealPlan.is_active.is_(True))
        .order_by(MealPlan.plan_date, MealPlan.id)
        .all()
    )
    return [serialize_meal(row) for row in rows]


def recipes(db: Session, family_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    rows = db.query(Recipe).filter(Recipe.family_id.in_([family_id, None]), Recipe.is_active.is_(True)).order_by(Recipe.id).all()
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return [serialize_recipe(row) for row in rows[offset : offset + limit]]


def update_meal(db: Session, meal_id: int, payload: MealUpdate, family_id: int, user_id: int) -> dict:
    meal = db.get(MealPlan, meal_id)
    if not meal or meal.family_id != family_id:
        raise HTTPException(status_code=404, detail="Meal not found")

    updates = payload.model_dump(exclude_unset=True)
    if "mealName" in updates and updates["mealName"]:
        meal.meal_name = sanitize_text(updates["mealName"])
    if "description" in updates:
        meal.description = sanitize_text(updates["description"]) if updates["description"] else None
    if "calories" in updates:
        meal.calories = updates["calories"]
    if "prepTime" in updates:
        meal.prep_time = updates["prepTime"]
    if "assignedTo" in updates:
        meal.assigned_to = updates["assignedTo"]
    if "dietaryFlags" in updates:
        meal.dietary_flags = updates["dietaryFlags"]

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="meal_plan",
        entity_id=meal.id,
        changes=updates,
    )
    db.commit()
    db.refresh(meal)
    invalidate_entity("meals", family_id)
    return serialize_meal(meal)


def apply_template(db: Session, family_id: int, user_id: int, template_name: str = "Default Weekly Meal Plan") -> list[dict]:
    templates = (
        db.query(MealPlanTemplate)
        .filter_by(family_id=family_id, template_name=template_name, is_active=True)
        .order_by(MealPlanTemplate.id)
        .all()
    )
    if not templates:
        raise HTTPException(status_code=404, detail="Meal template not found")

    start = start_of_week()
    day_lookup = {day.lower(): start + timedelta(days=index) for index, day in enumerate(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"])}

    for template in templates:
        plan_date = day_lookup.get(template.day_of_week or "")
        if not plan_date:
            continue

        meal = (
            db.query(MealPlan)
            .filter_by(family_id=family_id, plan_date=plan_date, meal_type=template.meal_type)
            .first()
        )
        if not meal:
            meal = MealPlan(family_id=family_id, plan_date=plan_date, meal_type=template.meal_type, created_by=user_id)
            db.add(meal)
        meal.day_of_week = (template.day_of_week or "").title()
        meal.meal_name = template.meal_name
        meal.description = template.description
        meal.calories = template.calories
        meal.prep_time = template.prep_time
        meal.recipe_id = template.recipe_id
        meal.color_class = {
            "monday": "bg-rose-500",
            "tuesday": "bg-orange-500",
            "wednesday": "bg-yellow-500",
            "thursday": "bg-green-500",
            "friday": "bg-sky-500",
            "saturday": "bg-blue-500",
            "sunday": "bg-indigo-500",
        }.get(template.day_of_week or "", "bg-blue-500")

    create_notification(
        db,
        user_id=user_id,
        family_id=family_id,
        title="Weekly template applied",
        message="The full breakfast, lunch, snacks, and dinner plan is active for this week.",
        type_="meal",
    )
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="apply_template",
        entity_type="meal_plan",
        entity_id=template_name,
    )
    db.commit()
    invalidate_entity("meals", family_id)
    return weekly_meals(db, family_id)
