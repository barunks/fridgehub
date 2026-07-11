from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import FrequencyType, GroceryItem, GroceryListType, GroceryPurchaseCycle, GrocerySubList, GroceryType
from app.schemas.familyhub import GroceryItemCreate, GroceryItemUpdate, GroceryTypeCreate, GroceryTypeUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import (
    invalidate_entity,
    serialize_cycle,
    serialize_grocery_item,
    serialize_list_type,
)
from app.services.notification_service import create_notification
from app.utils.dates import cycle_end, date_offset
from app.utils.sanitize import sanitize_text


# --- GroceryType admin CRUD ---


def get_grocery_type(db: Session, type_id: int) -> dict:
    gt = db.get(GroceryType, type_id)
    if not gt:
        raise HTTPException(status_code=404, detail="Grocery type not found")
    return _serialize_grocery_type(gt)


def create_grocery_type(db: Session, payload: GroceryTypeCreate, user_id: int) -> dict:
    existing = db.query(GroceryType).filter_by(type_name=payload.typeName).first()
    if existing:
        raise HTTPException(status_code=409, detail="Grocery type name already exists")
    gt = GroceryType(
        type_name=sanitize_text(payload.typeName),
        description=sanitize_text(payload.description) if payload.description else None,
        icon=payload.icon,
        color=payload.color,
        is_system=False,
    )
    db.add(gt)
    db.flush()
    write_audit_log(db, user_id=user_id, family_id=None, action="create", entity_type="grocery_type", entity_id=gt.id, changes={"type_name": gt.type_name})
    db.commit()
    db.refresh(gt)
    return _serialize_grocery_type(gt)


def update_grocery_type(db: Session, type_id: int, payload: GroceryTypeUpdate, user_id: int) -> dict:
    gt = db.get(GroceryType, type_id)
    if not gt:
        raise HTTPException(status_code=404, detail="Grocery type not found")
    if gt.is_system:
        raise HTTPException(status_code=403, detail="Cannot modify system grocery types")
    updates = payload.model_dump(exclude_unset=True)
    if "typeName" in updates:
        gt.type_name = sanitize_text(updates["typeName"])
    if "description" in updates:
        gt.description = sanitize_text(updates["description"]) if updates["description"] else None
    if "icon" in updates:
        gt.icon = updates["icon"]
    if "color" in updates:
        gt.color = updates["color"]
    write_audit_log(db, user_id=user_id, family_id=None, action="update", entity_type="grocery_type", entity_id=type_id, changes=updates)
    db.commit()
    db.refresh(gt)
    return _serialize_grocery_type(gt)


def delete_grocery_type(db: Session, type_id: int, user_id: int) -> None:
    gt = db.get(GroceryType, type_id)
    if not gt:
        raise HTTPException(status_code=404, detail="Grocery type not found")
    if gt.is_system:
        raise HTTPException(status_code=403, detail="Cannot delete system grocery types")
    write_audit_log(db, user_id=user_id, family_id=None, action="delete", entity_type="grocery_type", entity_id=type_id)
    db.delete(gt)
    db.commit()


def _serialize_grocery_type(gt: GroceryType) -> dict:
    return {
        "id": gt.id,
        "typeName": gt.type_name,
        "description": gt.description,
        "icon": gt.icon,
        "color": gt.color,
        "isSystem": gt.is_system,
    }


def list_types(db: Session, family_id: int) -> list[dict]:
    rows = db.query(GroceryListType).filter_by(family_id=family_id, is_active=True).order_by(GroceryListType.id).all()
    return [serialize_list_type(row) for row in rows]


def create_list_type(db: Session, list_name: str, description: str, color_class: str, family_id: int, user_id: int) -> dict:
    existing = db.query(GroceryListType).filter_by(family_id=family_id, list_name=list_name, is_active=True).first()
    if existing:
        raise HTTPException(status_code=409, detail="A list with this name already exists")
    lt = GroceryListType(
        list_name=sanitize_text(list_name),
        list_type="standard",
        description=sanitize_text(description),
        color_class=color_class,
        family_id=family_id,
        created_by=user_id,
    )
    db.add(lt)
    db.flush()
    write_audit_log(db, user_id=user_id, family_id=family_id, action="create", entity_type="grocery_list_type", entity_id=lt.id, changes={"list_name": lt.list_name})
    db.commit()
    db.refresh(lt)
    invalidate_entity("list_types", family_id)
    return serialize_list_type(lt)


def update_list_type(db: Session, list_type_id: int, updates: dict, family_id: int, user_id: int) -> dict:
    lt = db.get(GroceryListType, list_type_id)
    if not lt or lt.family_id != family_id or not lt.is_active:
        raise HTTPException(status_code=404, detail="List type not found")
    if "listName" in updates and updates["listName"]:
        lt.list_name = sanitize_text(updates["listName"])
    if "description" in updates and updates["description"] is not None:
        lt.description = sanitize_text(updates["description"])
    if "colorClass" in updates and updates["colorClass"]:
        lt.color_class = updates["colorClass"]
    write_audit_log(db, user_id=user_id, family_id=family_id, action="update", entity_type="grocery_list_type", entity_id=list_type_id, changes=updates)
    db.commit()
    db.refresh(lt)
    invalidate_entity("list_types", family_id)
    return serialize_list_type(lt)


def delete_list_type(db: Session, list_type_id: int, family_id: int, user_id: int) -> None:
    lt = db.get(GroceryListType, list_type_id)
    if not lt or lt.family_id != family_id or not lt.is_active:
        raise HTTPException(status_code=404, detail="List type not found")
    # Check if there are active items using this list type
    active_items = db.query(GroceryItem).filter_by(list_type_id=list_type_id, is_active=True).count()
    if active_items > 0:
        raise HTTPException(status_code=409, detail=f"Cannot delete: {active_items} active items use this list")
    lt.is_active = False
    write_audit_log(db, user_id=user_id, family_id=family_id, action="delete", entity_type="grocery_list_type", entity_id=list_type_id)
    db.commit()
    invalidate_entity("list_types", family_id)


def master_grocery_types(db: Session) -> list[dict]:
    return [_serialize_grocery_type(row) for row in db.query(GroceryType).order_by(GroceryType.id).all()]


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


def get_item(db: Session, item_id: int, family_id: int) -> dict:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id or not item.is_active:
        raise HTTPException(status_code=404, detail="Grocery item not found")
    return serialize_grocery_item(item)


def _cycle_start_for_item(item: GroceryItem, today: date | None = None) -> date:
    current = today or date.today()
    anchor = item.start_date or current
    if current < anchor:
        return anchor
    days = {"daily": 1, "weekly": 7, "monthly": 30, "quarterly": 90}.get(item.purchase_frequency, 7)
    elapsed = (current - anchor).days
    return anchor + timedelta(days=(elapsed // days) * days)


def _ensure_cycle_for_item(db: Session, item: GroceryItem) -> GroceryPurchaseCycle:
    start = _cycle_start_for_item(item)
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
        satisfied = bool(item.current_stock)
        db.add(
            GrocerySubList(
                purchase_cycle_id=cycle.id,
                item_id=item.id,
                quantity=item.quantity,
                unit=item.unit,
                is_purchased=satisfied,
                purchased_quantity=item.quantity if satisfied else Decimal("0.00"),
                notes=item.notes,
            )
        )
        db.flush()

    return cycle


def create_item(db: Session, payload: GroceryItemCreate, family_id: int, user_id: int) -> dict:
    list_type = db.get(GroceryListType, payload.listTypeId)
    if not list_type or list_type.family_id != family_id or not list_type.is_active:
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
    invalidate_entity("groceries", family_id)
    invalidate_entity("cycles", family_id)
    return serialize_grocery_item(item)


def update_item(db: Session, item_id: int, payload: GroceryItemUpdate, family_id: int, user_id: int) -> dict:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id or not item.is_active:
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
    elif "currentStock" in updates:
        _set_item_purchased(db, item, bool(updates["currentStock"]))

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
    invalidate_entity("groceries", family_id)
    invalidate_entity("cycles", family_id)
    return serialize_grocery_item(item)


def _set_item_purchased(db: Session, item: GroceryItem, purchased: bool) -> None:
    cycle = _ensure_cycle_for_item(db, item)
    sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if sub_item:
        sub_item.is_purchased = purchased
        sub_item.purchased_quantity = item.quantity if purchased else Decimal("0.00")


def delete_item(db: Session, item_id: int, family_id: int, user_id: int) -> None:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id or not item.is_active:
        raise HTTPException(status_code=404, detail="Grocery item not found")
    item.is_active = False
    for sub_item in item.sub_list_items:
        sub_item.is_purchased = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="grocery_item",
        entity_id=item_id,
    )
    db.commit()
    invalidate_entity("groceries", family_id)
    invalidate_entity("cycles", family_id)


def regenerate_cycles(db: Session, family_id: int, user_id: int | None = None) -> list[dict]:
    items = db.query(GroceryItem).filter_by(family_id=family_id, is_active=True).all()

    # Collect unpurchased items from current active cycles for carry-forward
    carry_forward_items: list[tuple[int, int]] = []  # (item_id, list_type_id)
    for cycle in db.query(GroceryPurchaseCycle).filter_by(family_id=family_id, is_completed=False).all():
        for sub_item in cycle.sub_list_items:
            if sub_item.item and sub_item.item.is_active and not sub_item.item.current_stock and not sub_item.is_purchased:
                carry_forward_items.append((sub_item.item_id, cycle.list_type_id))
        cycle.is_completed = True
    db.flush()

    cycles: list[GroceryPurchaseCycle] = []
    for item in items:
        cycle = _ensure_cycle_for_item(db, item)
        cycle.is_completed = False
        # Mark carried-forward items
        if (item.id, item.list_type_id) in carry_forward_items:
            sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
            if sub_item:
                sub_item.carried_forward = True
        if cycle not in cycles:
            cycles.append(cycle)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="regenerate",
        entity_type="grocery_purchase_cycle",
        entity_id="active",
        changes={"cycle_count": len(cycles), "carried_forward": len(carry_forward_items)},
    )
    db.commit()
    invalidate_entity("groceries", family_id)
    invalidate_entity("cycles", family_id)
    return [serialize_cycle(cycle) for cycle in cycles]
