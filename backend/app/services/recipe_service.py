from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Recipe
from app.schemas.familyhub import RecipeCreate, RecipeUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_family_cache, serialize_recipe
from app.utils.sanitize import sanitize_text


def create_recipe(db: Session, payload: RecipeCreate, family_id: int, user_id: int) -> dict:
    recipe = Recipe(
        recipe_name=sanitize_text(payload.recipeName),
        description=sanitize_text(payload.description),
        ingredients=[sanitize_text(item) for item in payload.ingredients],
        instructions=sanitize_text(payload.instructions),
        prep_time=payload.prepTime,
        cook_time=payload.cookTime,
        servings=payload.servings,
        difficulty=payload.difficulty,
        cuisine=sanitize_text(payload.cuisine),
        dietary_tags=[sanitize_text(tag) for tag in payload.dietaryTags],
        family_id=family_id,
        created_by=user_id,
    )
    db.add(recipe)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="recipe",
        entity_id=recipe.id,
    )
    db.commit()
    db.refresh(recipe)
    invalidate_family_cache(family_id)
    return serialize_recipe(recipe)


def update_recipe(db: Session, recipe_id: int, payload: RecipeUpdate, family_id: int, user_id: int) -> dict:
    recipe = db.get(Recipe, recipe_id)
    if not recipe or recipe.family_id != family_id:
        raise HTTPException(status_code=404, detail="Recipe not found")
    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "recipeName": "recipe_name",
        "description": "description",
        "ingredients": "ingredients",
        "instructions": "instructions",
        "prepTime": "prep_time",
        "cookTime": "cook_time",
        "servings": "servings",
        "difficulty": "difficulty",
        "cuisine": "cuisine",
        "dietaryTags": "dietary_tags",
    }
    for api_field, model_field in field_map.items():
        if api_field not in updates:
            continue
        value = updates[api_field]
        if isinstance(value, str):
            value = sanitize_text(value)
        if isinstance(value, list):
            value = [sanitize_text(str(item)) for item in value]
        setattr(recipe, model_field, value)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="recipe",
        entity_id=recipe.id,
        changes=updates,
    )
    db.commit()
    db.refresh(recipe)
    invalidate_family_cache(family_id)
    return serialize_recipe(recipe)


def delete_recipe(db: Session, recipe_id: int, family_id: int, user_id: int) -> None:
    recipe = db.get(Recipe, recipe_id)
    if not recipe or recipe.family_id != family_id:
        raise HTTPException(status_code=404, detail="Recipe not found")
    recipe.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="recipe",
        entity_id=recipe_id,
    )
    db.commit()
    invalidate_family_cache(family_id)
