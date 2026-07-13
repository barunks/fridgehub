from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.familyhub import (
    ApplyTemplateRequest,
    ErrorResponse,
    MealPlanItemOut,
    MealTemplateRowCreate,
    MealTemplateRowOut,
    MealTemplateRowUpdate,
    MealUpdate,
    RecipeCreate,
    RecipeOut,
    RecipeUpdate,
)
from app.services import meal_plan_service
from app.services import recipe_service

router = APIRouter()


@router.get("/week", response_model=list[MealPlanItemOut])
def get_week(
    member_id: int | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return meal_plan_service.weekly_meals(db, current_user.family_id, member_id)


@router.patch("/{meal_id}", response_model=MealPlanItemOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_meal(
    meal_id: int,
    payload: MealUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_MEALS)),
    db: Session = Depends(get_db),
) -> dict:
    return meal_plan_service.update_meal(db, meal_id, payload, current_user.family_id, current_user.user_id)


@router.post("/apply-template", response_model=list[MealPlanItemOut])
def apply_template(
    payload: ApplyTemplateRequest | None = None,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_MEALS)),
    db: Session = Depends(get_db),
) -> list[dict]:
    template_name = payload.templateName if payload else None
    if payload and payload.allMembers:
        return meal_plan_service.apply_template_for_all(db, current_user.family_id, current_user.user_id, template_name)
    member_id = payload.memberId if payload else None
    return meal_plan_service.apply_template(db, current_user.family_id, current_user.user_id, template_name, member_id)


@router.get("/templates", response_model=list[MealTemplateRowOut])
def get_templates(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return meal_plan_service.list_templates(db, current_user.family_id)


@router.post("/templates", response_model=MealTemplateRowOut, responses={403: {"model": ErrorResponse}})
def create_template_row(
    payload: MealTemplateRowCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_MEALS)),
    db: Session = Depends(get_db),
) -> dict:
    return meal_plan_service.upsert_template_row(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/templates/{template_id}", response_model=MealTemplateRowOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_template_row(
    template_id: int,
    payload: MealTemplateRowUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_MEALS)),
    db: Session = Depends(get_db),
) -> dict:
    return meal_plan_service.update_template_row(db, template_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/templates/{template_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def delete_template_row(
    template_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_MEALS)),
    db: Session = Depends(get_db),
) -> None:
    meal_plan_service.delete_template_row(db, template_id, current_user.family_id, current_user.user_id)


@router.get("/recipes", response_model=list[RecipeOut])
def get_recipes(
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return meal_plan_service.recipes(db, current_user.family_id, limit, offset)


@router.post("/recipes", response_model=RecipeOut, responses={403: {"model": ErrorResponse}})
def create_recipe(
    payload: RecipeCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_RECIPES)),
    db: Session = Depends(get_db),
) -> dict:
    return recipe_service.create_recipe(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/recipes/{recipe_id}", response_model=RecipeOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_RECIPES)),
    db: Session = Depends(get_db),
) -> dict:
    return recipe_service.update_recipe(db, recipe_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/recipes/{recipe_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def delete_recipe(
    recipe_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_RECIPES)),
    db: Session = Depends(get_db),
) -> None:
    recipe_service.delete_recipe(db, recipe_id, current_user.family_id, current_user.user_id)
