from datetime import date, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Family, FamilyMember, MealPlan, MealPlanTemplate, Recipe
from app.schemas.familyhub import MealTemplateRowCreate, MealTemplateRowUpdate, MealUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_meal, serialize_recipe
from app.services.notification_service import create_notification
from app.utils.dates import start_of_week, today_for_timezone
from app.utils.sanitize import sanitize_text


DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MEAL_TYPES = ["breakfast", "lunch", "snacks", "dinner"]
DAY_COLORS = {
    "monday": "bg-rose-500",
    "tuesday": "bg-orange-500",
    "wednesday": "bg-yellow-500",
    "thursday": "bg-green-500",
    "friday": "bg-sky-500",
    "saturday": "bg-blue-500",
    "sunday": "bg-indigo-500",
}


def _template_scope(family_id: int) -> str:
    return f"family:{family_id}"


def _sort_templates(templates: list[MealPlanTemplate]) -> list[MealPlanTemplate]:
    day_index = {day: index for index, day in enumerate(DAY_NAMES)}
    meal_index = {meal_type: index for index, meal_type in enumerate(MEAL_TYPES)}
    return sorted(
        templates,
        key=lambda row: (
            row.template_name or "",
            day_index.get((row.day_of_week or "").lower(), 99),
            meal_index.get(row.meal_type or "", 99),
            row.id,
        ),
    )


def _sanitize_tags(values: list[str] | None) -> list[str]:
    if not values:
        return []
    tags: list[str] = []
    seen: set[str] = set()
    for value in values:
        tag = sanitize_text(str(value)).strip()
        if not tag or tag.lower() in seen:
            continue
        tags.append(tag[:60])
        seen.add(tag.lower())
        if len(tags) >= 12:
            break
    return tags


def _ensure_recipe_available(db: Session, family_id: int, recipe_id: int | None) -> None:
    if recipe_id is None:
        return
    recipe = db.get(Recipe, recipe_id)
    if not recipe or not recipe.is_active or recipe.family_id not in (None, family_id):
        raise HTTPException(status_code=400, detail="Recipe is not available for this family")


def _serialize_template_row(template: MealPlanTemplate, family_id: int) -> dict:
    return {
        "id": template.id,
        "templateName": template.template_name,
        "dayOfWeek": (template.day_of_week or "").lower(),
        "mealType": template.meal_type or "breakfast",
        "mealName": template.meal_name or "",
        "description": template.description or "",
        "calories": template.calories or 0,
        "prepTime": template.prep_time or 0,
        "recipeId": template.recipe_id,
        "isGlobal": template.is_global,
        "isEditable": template.family_id == family_id and not template.is_global,
        "createdAt": template.created_at,
        "updatedAt": template.updated_at,
    }


def _template_conflict(
    db: Session,
    *,
    family_id: int,
    template_name: str,
    day_of_week: str,
    meal_type: str,
    exclude_id: int | None = None,
) -> MealPlanTemplate | None:
    query = db.query(MealPlanTemplate).filter(
        MealPlanTemplate.family_id == family_id,
        MealPlanTemplate.template_scope == _template_scope(family_id),
        MealPlanTemplate.template_name == template_name,
        MealPlanTemplate.day_of_week == day_of_week,
        MealPlanTemplate.meal_type == meal_type,
        MealPlanTemplate.is_active.is_(True),
    )
    if exclude_id is not None:
        query = query.filter(MealPlanTemplate.id != exclude_id)
    return query.first()


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
            .all()
        )
    if not templates:
        raise HTTPException(status_code=404, detail="Meal template not found")
    return selected_template_name, _sort_templates(templates)


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


def list_templates(db: Session, family_id: int) -> list[dict]:
    rows = (
        db.query(MealPlanTemplate)
        .filter(
            (
                (MealPlanTemplate.family_id == family_id)
                | ((MealPlanTemplate.family_id.is_(None)) & MealPlanTemplate.is_global.is_(True))
                | MealPlanTemplate.is_global.is_(True)
            ),
            MealPlanTemplate.is_active.is_(True),
        )
        .all()
    )
    return [_serialize_template_row(row, family_id) for row in _sort_templates(rows)]


def upsert_template_row(db: Session, payload: MealTemplateRowCreate, family_id: int, user_id: int) -> dict:
    _ensure_recipe_available(db, family_id, payload.recipeId)
    template_name = sanitize_text(payload.templateName)
    day_of_week = payload.dayOfWeek.lower()
    existing = _template_conflict(
        db,
        family_id=family_id,
        template_name=template_name,
        day_of_week=day_of_week,
        meal_type=payload.mealType,
    )

    if existing:
        template = existing
        action = "update"
    else:
        template = MealPlanTemplate(
            family_id=family_id,
            template_scope=_template_scope(family_id),
            is_global=False,
            created_by=user_id,
        )
        db.add(template)
        action = "create"

    template.template_name = template_name
    template.day_of_week = day_of_week
    template.meal_type = payload.mealType
    template.meal_name = sanitize_text(payload.mealName)
    template.description = sanitize_text(payload.description) if payload.description else None
    template.calories = payload.calories
    template.prep_time = payload.prepTime
    template.recipe_id = payload.recipeId

    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action=action,
        entity_type="meal_template",
        entity_id=template.id,
        changes={
            "templateName": template.template_name,
            "dayOfWeek": template.day_of_week,
            "mealType": template.meal_type,
        },
    )
    db.commit()
    db.refresh(template)
    return _serialize_template_row(template, family_id)


def update_template_row(db: Session, template_id: int, payload: MealTemplateRowUpdate, family_id: int, user_id: int) -> dict:
    template = db.get(MealPlanTemplate, template_id)
    if not template or not template.is_active or template.family_id != family_id or template.is_global:
        raise HTTPException(status_code=404, detail="Meal template row not found")

    updates = payload.model_dump(exclude_unset=True)
    if "recipeId" in updates:
        _ensure_recipe_available(db, family_id, updates["recipeId"])

    next_template_name = sanitize_text(updates.get("templateName", template.template_name))
    next_day = (updates.get("dayOfWeek") or template.day_of_week or "").lower()
    next_meal_type = updates.get("mealType", template.meal_type)
    if not next_meal_type:
        raise HTTPException(status_code=400, detail="Meal type is required")
    conflicting = _template_conflict(
        db,
        family_id=family_id,
        template_name=next_template_name,
        day_of_week=next_day,
        meal_type=next_meal_type,
        exclude_id=template.id,
    )
    if conflicting:
        raise HTTPException(status_code=409, detail="Template row already exists for that day and meal type")

    if "templateName" in updates:
        template.template_name = next_template_name
    if "dayOfWeek" in updates:
        template.day_of_week = next_day
    if "mealType" in updates:
        template.meal_type = next_meal_type
    if "mealName" in updates:
        template.meal_name = sanitize_text(updates["mealName"])
    if "description" in updates:
        template.description = sanitize_text(updates["description"]) if updates["description"] else None
    if "calories" in updates:
        template.calories = updates["calories"]
    if "prepTime" in updates:
        template.prep_time = updates["prepTime"]
    if "recipeId" in updates:
        template.recipe_id = updates["recipeId"]

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="meal_template",
        entity_id=template.id,
        changes=updates,
    )
    db.commit()
    db.refresh(template)
    return _serialize_template_row(template, family_id)


def delete_template_row(db: Session, template_id: int, family_id: int, user_id: int) -> None:
    template = db.get(MealPlanTemplate, template_id)
    if not template or not template.is_active or template.family_id != family_id or template.is_global:
        raise HTTPException(status_code=404, detail="Meal template row not found")
    template.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="meal_template",
        entity_id=template.id,
    )
    db.commit()


def update_meal(db: Session, meal_id: int, payload: MealUpdate, family_id: int, user_id: int) -> dict:
    meal = db.get(MealPlan, meal_id)
    if not meal or meal.family_id != family_id:
        raise HTTPException(status_code=404, detail="Meal not found")

    updates = payload.model_dump(exclude_unset=True)
    if "mealName" in updates:
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
        meal.dietary_flags = _sanitize_tags(updates["dietaryFlags"])
    if "recipeId" in updates:
        _ensure_recipe_available(db, family_id, updates["recipeId"])
        meal.recipe_id = updates["recipeId"]

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
