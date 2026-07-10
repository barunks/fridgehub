from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_parent
from app.core.database import get_db
from app.schemas.familyhub import (
    FrequencyTypeOut,
    GroceryCycleOut,
    GroceryItemCreate,
    GroceryItemOut,
    GroceryItemUpdate,
    GroceryListTypeOut,
    GroceryTypeOut,
)
from app.services import grocery_service

router = APIRouter()


@router.get("/list-types", response_model=list[GroceryListTypeOut])
def get_list_types(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return grocery_service.list_types(db, current_user.family_id)


@router.get("/master-types", response_model=list[GroceryTypeOut])
def get_master_types(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return grocery_service.master_grocery_types(db)


@router.get("/frequency-types", response_model=list[FrequencyTypeOut])
def get_frequency_types(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return grocery_service.frequency_types(db)


@router.get("/items", response_model=list[GroceryItemOut])
def get_items(
    list_type_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.list_items(db, current_user.family_id, list_type_id, limit, offset)


@router.post("/items", response_model=GroceryItemOut)
def create_item(
    payload: GroceryItemCreate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.create_item(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/items/{item_id}", response_model=GroceryItemOut)
def update_item(
    item_id: int,
    payload: GroceryItemUpdate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.update_item(db, item_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    item_id: int,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> None:
    grocery_service.delete_item(db, item_id, current_user.family_id, current_user.user_id)


@router.post("/regenerate-cycles", response_model=list[GroceryCycleOut])
def regenerate_cycles(
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.regenerate_cycles(db, current_user.family_id, current_user.user_id)
