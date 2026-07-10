from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import FrequencyType, GroceryItem, GroceryListType, GroceryPurchaseCycle, GrocerySubList, GroceryType
from app.schemas.familyhub import GroceryItemCreate, GroceryItemUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import (
    invalidate_family_cache,
    serialize_cycle,
    serialize_grocery_item,
    serialize_list_type,
)
from app.services.notification_service import create_notification
from app.utils.dates import cycle_end, date_offset
from app.utils.sanitize import sanitize_text


def list_types(db: Session, family_id: int) -> list[dict]:
    rows = db.query(GroceryListType).filter_by(family_id=family_id, is_active=True).order_by(GroceryListType.id).all()
    return [serialize_list_type(row) for row in rows]


def master_grocery_types(db: Session) -> list[dict]:
    return [
        {
            "id": row.id,
            "typeName": row.type_name,
            "description": row.description,
            "icon": row.icon,
            "color": row.color,
        }
        for row in db.query(GroceryType).order_by(GroceryType.id).all()
    ]


def frequency_types(db: Session) -> list[dict]:
    return [
        {
            "id": row.id,
            "frequencyName": row.frequency_name,
            "daysInterval": row.days_interval,
            "displayOrder": row.display_order,
        }
        for row in db.query(FrequencyType).order_by(FrequencyType.display_order).all()
    ]


def list_items(
    db: Session,
    family_id: int,
    list_type_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    query = db.query(GroceryItem).filter_by(family_id=family_id, is_active=True)
    if list_type_id:
        query = query.filter(GroceryItem.list_type_id == list_type_id)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return [serialize_grocery_item(item) for item in query.order_by(GroceryItem.id).offset(offset).limit(limit).all()]


def _ensure_cycle_for_item(db: Session, item: GroceryItem) -> GroceryPurchaseCycle:
    start = date.today()
    cycle = (
        db.query(GroceryPurchaseCycle)
        .filter_by(
            family_id=item.family_id,
            list_type_id=item.list_type_id,
            frequency=item.purchase_frequency,
            cycle_start_date=start,
        )
        .first()
    )
    if not cycle:
        cycle = GroceryPurchaseCycle(
            family_id=item.family_id,
            list_type_id=item.list_type_id,
            frequency=item.purchase_frequency,
            cycle_start_date=start,
            cycle_end_date=cycle_end(start, item.purchase_frequency),
        )
        db.add(cycle)
        db.flush()

    existing_sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if not existing_sub_item:
        db.add(
            GrocerySubList(
                purchase_cycle_id=cycle.id,
                item_id=item.id,
                quantity=item.quantity,
                unit=item.unit,
                is_purchased=False,
                purchased_quantity=Decimal("0.00"),
                notes=item.notes,
            )
        )
        db.flush()

    return cycle


def create_item(db: Session, payload: GroceryItemCreate, family_id: int, user_id: int) -> dict:
    list_type = db.get(GroceryListType, payload.listTypeId)
    if not list_type or list_type.family_id != family_id:
        raise HTTPException(status_code=404, detail="Grocery list type not found")

    item = GroceryItem(
        item_number="PENDING",
        item_name=sanitize_text(payload.itemName),
        list_type_id=payload.listTypeId,
        quantity=Decimal(str(payload.quantity)),
        unit=sanitize_text(payload.unit),
        purchase_frequency=payload.purchaseFrequency,
        current_stock=payload.currentStock,
        start_date=date.today(),
        expiry_date=payload.expiryDate or (date_offset(5) if payload.purchaseFrequency == "weekly" else None),
        notes=sanitize_text(payload.notes),
        family_id=family_id,
        created_by=user_id,
    )
    db.add(item)
    db.flush()
    item.item_number = f"GRC-{item.id:04d}"
    _ensure_cycle_for_item(db, item)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="grocery_item",
        entity_id=item.id,
        changes={"item_name": item.item_name, "list_type_id": item.list_type_id},
    )
    create_notification(
        db,
        user_id=user_id,
        family_id=family_id,
        title="Grocery item added",
        message=f"{item.item_name} was added to the master list.",
        type_="grocery",
    )
    db.commit()
    db.refresh(item)
    invalidate_family_cache(family_id)
    return serialize_grocery_item(item)


def update_item(db: Session, item_id: int, payload: GroceryItemUpdate, family_id: int, user_id: int) -> dict:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Grocery item not found")

    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "itemName": "item_name",
        "quantity": "quantity",
        "unit": "unit",
        "purchaseFrequency": "purchase_frequency",
        "currentStock": "current_stock",
        "notes": "notes",
        "expiryDate": "expiry_date",
    }
    for api_field, model_field in field_map.items():
        if api_field in updates:
            value = updates[api_field]
            if api_field == "quantity":
                value = Decimal(str(value))
            if isinstance(value, str):
                value = sanitize_text(value)
            setattr(item, model_field, value)

    if "purchased" in updates:
        _set_item_purchased(db, item, bool(updates["purchased"]))
        item.current_stock = bool(updates["purchased"])

    _ensure_cycle_for_item(db, item)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="grocery_item",
        entity_id=item.id,
        changes=updates,
    )
    db.commit()
    db.refresh(item)
    invalidate_family_cache(family_id)
    return serialize_grocery_item(item)


def _set_item_purchased(db: Session, item: GroceryItem, purchased: bool) -> None:
    cycle = _ensure_cycle_for_item(db, item)
    sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if sub_item:
        sub_item.is_purchased = purchased
        sub_item.purchased_quantity = item.quantity if purchased else Decimal("0.00")


def delete_item(db: Session, item_id: int, family_id: int, user_id: int) -> None:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id:
        raise HTTPException(status_code=404, detail="Grocery item not found")
    item.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="grocery_item",
        entity_id=item_id,
    )
    db.commit()
    invalidate_family_cache(family_id)


def regenerate_cycles(db: Session, family_id: int, user_id: int | None = None) -> list[dict]:
    items = db.query(GroceryItem).filter_by(family_id=family_id, is_active=True).all()
    for cycle in db.query(GroceryPurchaseCycle).filter_by(family_id=family_id, is_completed=False).all():
        cycle.is_completed = True
    db.flush()

    cycles: list[GroceryPurchaseCycle] = []
    for item in items:
        cycle = _ensure_cycle_for_item(db, item)
        cycle.is_completed = False
        if cycle not in cycles:
            cycles.append(cycle)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="regenerate",
        entity_type="grocery_purchase_cycle",
        entity_id="active",
        changes={"cycle_count": len(cycles)},
    )
    db.commit()
    invalidate_family_cache(family_id)
    return [serialize_cycle(cycle) for cycle in cycles]
