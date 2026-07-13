from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Family, FamilyMember, MealPlan, MealPlanTemplate, Recipe
from app.schemas.familyhub import MealUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_meal, serialize_recipe
from app.services.notification_service import create_notification
from app.utils.dates import start_of_week, today_for_timezone
from app.utils.sanitize import sanitize_text


DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
DAY_COLORS = {
    "monday": "bg-rose-500",
    "tuesday": "bg-orange-500",
    "wednesday": "bg-yellow-500",
    "thursday": "bg-green-500",
    "friday": "bg-sky-500",
    "saturday": "bg-blue-500",
    "sunday": "bg-indigo-500",
}


def _meal_scope(member_id: int | None) -> str:
    return f"user:{member_id}" if member_id else "family"


def _family_week_start(db: Session, family_id: int) -> date:
    family = db.get(Family, family_id)
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")
    return start_of_week(today_for_timezone(family.timezone))


def _ensure_active_member(db: Session, family_id: int, member_id: int | None) -> None:
    if member_id is None:
        return
    membership = (
        db.query(FamilyMember)
        .filter_by(family_id=family_id, user_id=member_id, is_active=True)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=400, detail="Meal assignee is not an active family member")


def _active_member_ids(db: Session, family_id: int) -> list[int]:
    return [
        member.user_id
        for member in db.query(FamilyMember)
        .filter_by(family_id=family_id, is_active=True)
        .order_by(FamilyMember.id)
        .all()
    ]


def _resolve_templates(
    db: Session,
    family_id: int,
    template_name: str | None = None,
) -> tuple[str, list[MealPlanTemplate]]:
    selected_template_name = template_name
    if not selected_template_name:
        selected_template_name = (
            db.query(MealPlanTemplate.template_name)
            .filter(MealPlanTemplate.family_id == family_id, MealPlanTemplate.is_active.is_(True))
            .order_by(MealPlanTemplate.id)
            .limit(1)
            .scalar()
        )
    if not selected_template_name:
        selected_template_name = (
            db.query(MealPlanTemplate.template_name)
            .filter(MealPlanTemplate.is_global.is_(True), MealPlanTemplate.is_active.is_(True))
            .order_by(MealPlanTemplate.id)
            .limit(1)
            .scalar()
        )

    if not selected_template_name:
        raise HTTPException(status_code=404, detail="Meal template not found")

    templates = (
        db.query(MealPlanTemplate)
        .filter(
            MealPlanTemplate.template_name == selected_template_name,
            MealPlanTemplate.family_id == family_id,
            MealPlanTemplate.is_active.is_(True),
        )
        .order_by(MealPlanTemplate.id)
        .all()
    )
    if not templates:
        templates = (
            db.query(MealPlanTemplate)
            .filter(
                MealPlanTemplate.template_name == selected_template_name,
                MealPlanTemplate.is_global.is_(True),
                MealPlanTemplate.is_active.is_(True),
            )
            .order_by(MealPlanTemplate.id)
            .all()
        )
    if not templates:
        raise HTTPException(status_code=404, detail="Meal template not found")
    return selected_template_name, templates


def _apply_templates_to_scope(
    db: Session,
    *,
    family_id: int,
    user_id: int,
    templates: list[MealPlanTemplate],
    member_id: int | None,
) -> None:
    week_start = _family_week_start(db, family_id)
    day_lookup = {day: week_start + timedelta(days=index) for index, day in enumerate(DAY_NAMES)}
    meal_scope = _meal_scope(member_id)

    for template in templates:
        day_key = (template.day_of_week or "").lower()
        plan_date = day_lookup.get(day_key)
        if not plan_date:
            continue

        meal = (
            db.query(MealPlan)
            .filter_by(
                family_id=family_id,
                plan_date=plan_date,
                meal_type=template.meal_type,
                meal_plan_scope=meal_scope,
            )
            .first()
        )
        if not meal:
            meal = MealPlan(
                family_id=family_id,
                plan_date=plan_date,
                meal_type=template.meal_type,
                created_by=user_id,
                assigned_to=member_id,
                meal_plan_scope=meal_scope,
            )
            db.add(meal)
        meal.assigned_to = member_id
        meal.meal_plan_scope = meal_scope
        meal.day_of_week = day_key.title()
        meal.meal_name = template.meal_name
        meal.description = template.description
        meal.calories = template.calories
        meal.prep_time = template.prep_time
        meal.recipe_id = template.recipe_id
        meal.color_class = DAY_COLORS.get(day_key, "bg-blue-500")


def weekly_meals(db: Session, family_id: int, member_id: int | None = None) -> list[dict]:
    _ensure_active_member(db, family_id, member_id)
    start = _family_week_start(db, family_id)
    end = start + timedelta(days=6)
    query = (
        db.query(MealPlan)
        .filter(MealPlan.family_id == family_id, MealPlan.plan_date >= start, MealPlan.plan_date <= end, MealPlan.is_active.is_(True))
    )
    if member_id is not None:
        query = query.filter(MealPlan.assigned_to == member_id, MealPlan.meal_plan_scope == _meal_scope(member_id))
    rows = query.order_by(MealPlan.plan_date, MealPlan.id).all()
    return [serialize_meal(row) for row in rows]


def recipes(db: Session, family_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    rows = (
        db.query(Recipe)
        .filter(((Recipe.family_id == family_id) | (Recipe.family_id.is_(None))), Recipe.is_active.is_(True))
        .order_by(Recipe.id)
        .all()
    )
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
        _ensure_active_member(db, family_id, updates["assignedTo"])
        meal.assigned_to = updates["assignedTo"]
        meal.meal_plan_scope = _meal_scope(updates["assignedTo"])
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


def apply_template(db: Session, family_id: int, user_id: int, template_name: str | None = None, member_id: int | None = None) -> list[dict]:
    _ensure_active_member(db, family_id, member_id)
    selected_template_name, templates = _resolve_templates(db, family_id, template_name)
    _apply_templates_to_scope(db, family_id=family_id, user_id=user_id, templates=templates, member_id=member_id)

    member_label = f" for member {member_id}" if member_id else ""
    create_notification(
        db,
        user_id=user_id,
        family_id=family_id,
        title="Weekly template applied",
        message=f"The full breakfast, lunch, snacks, and dinner plan is active for this week{member_label}.",
        type_="meal",
    )
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="apply_template",
        entity_type="meal_plan",
        entity_id=selected_template_name,
        changes={"member_id": member_id},
    )
    db.commit()
    invalidate_entity("meals", family_id)
    invalidate_entity("notifications", family_id)
    return weekly_meals(db, family_id, member_id)


def apply_template_for_all(db: Session, family_id: int, user_id: int, template_name: str | None = None) -> list[dict]:
    member_ids = _active_member_ids(db, family_id)
    if not member_ids:
        raise HTTPException(status_code=404, detail="No active family members found")
    selected_template_name, templates = _resolve_templates(db, family_id, template_name)

    for member_id in member_ids:
        _apply_templates_to_scope(db, family_id=family_id, user_id=user_id, templates=templates, member_id=member_id)

    create_notification(
        db,
        user_id=user_id,
        family_id=family_id,
        title="Weekly template applied",
        message="The full breakfast, lunch, snacks, and dinner plan is active for all family members this week.",
        type_="meal",
    )
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="apply_template_all",
        entity_type="meal_plan",
        entity_id=selected_template_name,
        changes={"member_ids": member_ids},
    )
    db.commit()
    invalidate_entity("meals", family_id)
    invalidate_entity("notifications", family_id)
    return weekly_meals(db, family_id)
