from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.familyhub import (
    ErrorResponse,
    FrequencyTypeOut,
    GroceryCycleOut,
    GroceryItemCreate,
    GroceryItemOut,
    GroceryItemUpdate,
    GroceryListTypeCreate,
    GroceryListTypeOut,
    GroceryListTypeUpdate,
    GroceryTypeCreate,
    GroceryTypeOut,
    GroceryTypeUpdate,
)
from app.services import grocery_service

router = APIRouter()


# --- GroceryType admin CRUD ---


@router.get("/types", response_model=list[GroceryTypeOut])
def get_types(_: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return grocery_service.master_grocery_types(db)


@router.get("/types/{type_id}", response_model=GroceryTypeOut, responses={404: {"model": ErrorResponse}})
def get_type(type_id: int, _: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    return grocery_service.get_grocery_type(db, type_id)


@router.post("/types", response_model=GroceryTypeOut, status_code=201, responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def create_type(payload: GroceryTypeCreate, current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERY_TYPES)), db: Session = Depends(get_db)) -> dict:
    return grocery_service.create_grocery_type(db, payload, current_user.user_id)


@router.patch("/types/{type_id}", response_model=GroceryTypeOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_type(type_id: int, payload: GroceryTypeUpdate, current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERY_TYPES)), db: Session = Depends(get_db)) -> dict:
    return grocery_service.update_grocery_type(db, type_id, payload, current_user.user_id)


@router.delete("/types/{type_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def delete_type(type_id: int, current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERY_TYPES)), db: Session = Depends(get_db)) -> None:
    grocery_service.delete_grocery_type(db, type_id, current_user.user_id)


@router.get("/list-types", response_model=list[GroceryListTypeOut])
def get_list_types(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return grocery_service.list_types(db, current_user.family_id)


@router.post("/list-types", response_model=GroceryListTypeOut, status_code=201, responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def create_list_type(
    payload: GroceryListTypeCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.create_list_type(db, payload.listName, payload.description, payload.colorClass, current_user.family_id, current_user.user_id)


@router.patch("/list-types/{list_type_id}", response_model=GroceryListTypeOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_list_type(
    list_type_id: int,
    payload: GroceryListTypeUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.update_list_type(db, list_type_id, payload.model_dump(exclude_unset=True), current_user.family_id, current_user.user_id)


@router.delete("/list-types/{list_type_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def delete_list_type(
    list_type_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> None:
    grocery_service.delete_list_type(db, list_type_id, current_user.family_id, current_user.user_id)


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


@router.get("/items/{item_id}", response_model=GroceryItemOut, responses={404: {"model": ErrorResponse}})
def get_item(
    item_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.get_item(db, item_id, current_user.family_id)


@router.post("/items", response_model=GroceryItemOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def create_item(
    payload: GroceryItemCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.create_item(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/items/{item_id}", response_model=GroceryItemOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_item(
    item_id: int,
    payload: GroceryItemUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.update_item(db, item_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/items/{item_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def delete_item(
    item_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> None:
    grocery_service.delete_item(db, item_id, current_user.family_id, current_user.user_id)


@router.post("/regenerate-cycles", response_model=list[GroceryCycleOut])
def regenerate_cycles(
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.regenerate_cycles(db, current_user.family_id, current_user.user_id)
