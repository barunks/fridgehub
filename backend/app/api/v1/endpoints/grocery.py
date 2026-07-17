from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.fridgehub import (
    ErrorResponse,
    FrequencyTypeOut,
    GroceryCycleOut,
    GroceryItemCreate,
    GroceryItemOut,
    GroceryItemUpdate,
    GroceryListTypeCreate,
    GroceryListTypeOut,
    GroceryListTypeUpdate,
    ShoppingAdhocCreate,
    ShoppingCycleItemOut,
    ShoppingItemUpdate,
    GroceryTypeCreate,
    GroceryTypeOut,
    GroceryTypeUpdate,
)
from app.services import grocery_service
from app.services.report_service import generate_shopping_report

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


@router.get("/shopping-items", response_model=list[ShoppingCycleItemOut])
def get_shopping_items(
    list_type_id: int | None = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.list_current_shopping_items(db, current_user.family_id, list_type_id)


@router.post("/shopping-items/build", response_model=list[ShoppingCycleItemOut])
def build_shopping_items(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.build_current_shopping_list(db, current_user.family_id)


@router.post("/shopping-items", response_model=ShoppingCycleItemOut, status_code=201, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def create_shopping_item(
    payload: ShoppingAdhocCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.add_adhoc_shopping_item(db, payload, current_user.family_id, current_user.user_id)


@router.get("/shopping-items/{sub_item_id}", response_model=ShoppingCycleItemOut, responses={404: {"model": ErrorResponse}})
def get_shopping_item(
    sub_item_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.get_shopping_item(db, sub_item_id, current_user.family_id)


@router.patch("/shopping-items/{sub_item_id}", response_model=ShoppingCycleItemOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_shopping_item(
    sub_item_id: int,
    payload: ShoppingItemUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> dict:
    return grocery_service.update_shopping_item(db, sub_item_id, payload, current_user.family_id, current_user.user_id)


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


@router.get("/shopping-report")
def download_shopping_report(
    list_type_id: int | None = None,
    list_type_ids: str | None = None,
    frequency: str | None = None,
    stock: str | None = None,
    stock_values: str | None = None,
    item_name: str | None = None,
    item_names: str | None = None,
    only_needed: bool = False,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    parsed_list_type_ids = []
    for value in (list_type_ids or "").split(","):
        if not value:
            continue
        try:
            parsed_list_type_ids.append(int(value))
        except ValueError:
            continue
    parsed_stock_values = [value for value in (stock_values or "").split(",") if value]
    parsed_item_names = [value for value in (item_names or "").split(",") if value]
    pdf_bytes = generate_shopping_report(
        db,
        current_user.family_id,
        list_type_id=list_type_id,
        list_type_ids=parsed_list_type_ids or None,
        frequency=frequency,
        stock_filter=stock,
        stock_filters=parsed_stock_values or None,
        item_name=item_name,
        item_names=parsed_item_names or None,
        only_needed=only_needed,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=shopping-report.pdf"},
    )


@router.post("/regenerate-cycles", response_model=list[GroceryCycleOut])
def regenerate_cycles(
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_GROCERIES)),
    db: Session = Depends(get_db),
) -> list[dict]:
    return grocery_service.regenerate_cycles(db, current_user.family_id, current_user.user_id)
