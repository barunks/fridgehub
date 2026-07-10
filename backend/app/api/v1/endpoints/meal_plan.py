from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_parent
from app.core.database import get_db
from app.schemas.familyhub import MealPlanItemOut, MealUpdate, RecipeCreate, RecipeOut, RecipeUpdate
from app.services import meal_plan_service
from app.services import recipe_service

router = APIRouter()


@router.get("/week", response_model=list[MealPlanItemOut])
def get_week(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return meal_plan_service.weekly_meals(db, current_user.family_id)


@router.patch("/{meal_id}", response_model=MealPlanItemOut)
def update_meal(
    meal_id: int,
    payload: MealUpdate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return meal_plan_service.update_meal(db, meal_id, payload, current_user.family_id, current_user.user_id)


@router.post("/apply-template", response_model=list[MealPlanItemOut])
def apply_template(
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> list[dict]:
    return meal_plan_service.apply_template(db, current_user.family_id, current_user.user_id)


@router.get("/recipes", response_model=list[RecipeOut])
def get_recipes(
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return meal_plan_service.recipes(db, current_user.family_id, limit, offset)


@router.post("/recipes", response_model=RecipeOut)
def create_recipe(
    payload: RecipeCreate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return recipe_service.create_recipe(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/recipes/{recipe_id}", response_model=RecipeOut)
def update_recipe(
    recipe_id: int,
    payload: RecipeUpdate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return recipe_service.update_recipe(db, recipe_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(
    recipe_id: int,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> None:
    recipe_service.delete_recipe(db, recipe_id, current_user.family_id, current_user.user_id)
