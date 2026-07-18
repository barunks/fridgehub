from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Family, FrequencyType, GroceryItem, GroceryListType, GroceryPurchaseCycle, GrocerySubList, GroceryType
from app.schemas.fridgehub import (
    GroceryItemCreate,
    GroceryItemUpdate,
    GroceryTypeCreate,
    GroceryTypeUpdate,
    ShoppingAdhocCreate,
    ShoppingItemUpdate,
)
from app.services.audit_service import write_audit_log
from app.services.family_service import (
    invalidate_entity,
    serialize_cycle,
    serialize_grocery_item,
    serialize_shopping_item,
    serialize_list_type,
)
from app.services.notification_service import create_notification
from app.utils.dates import today_for_timezone
from app.utils.sanitize import sanitize_text


FALLBACK_FREQUENCY_DAYS = {
    "daily": 1,
    "weekly": 7,
    "monthly": 30,
    "quarterly": 90,
    "semi_annually": 182,
    "yearly": 365,
}


def _invalidate_shopping_state(family_id: int) -> None:
    invalidate_entity("groceries", family_id)
    invalidate_entity("cycles", family_id)
    invalidate_entity("shopping_items", family_id)


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
    sanitized_name = sanitize_text(list_name)
    existing = db.query(GroceryListType).filter_by(family_id=family_id, list_name=sanitized_name, is_active=True).first()
    if existing:
        raise HTTPException(status_code=409, detail="A list with this name already exists")
    inactive = db.query(GroceryListType).filter_by(family_id=family_id, list_name=sanitized_name, is_active=False).first()
    if inactive:
        inactive.description = sanitize_text(description)
        inactive.color_class = color_class
        inactive.created_by = user_id
        inactive.is_active = True
        write_audit_log(db, user_id=user_id, family_id=family_id, action="restore", entity_type="grocery_list_type", entity_id=inactive.id, changes={"list_name": inactive.list_name})
        db.commit()
        db.refresh(inactive)
        invalidate_entity("list_types", family_id)
        return serialize_list_type(inactive)
    lt = GroceryListType(
        list_name=sanitized_name,
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
        next_name = sanitize_text(updates["listName"])
        active_duplicate = (
            db.query(GroceryListType)
            .filter(
                GroceryListType.family_id == family_id,
                GroceryListType.list_name == next_name,
                GroceryListType.id != list_type_id,
                GroceryListType.is_active.is_(True),
            )
            .first()
        )
        if active_duplicate:
            raise HTTPException(status_code=409, detail="A list with this name already exists")
        inactive_duplicates = (
            db.query(GroceryListType)
            .filter(
                GroceryListType.family_id == family_id,
                GroceryListType.list_name == next_name,
                GroceryListType.id != list_type_id,
                GroceryListType.is_active.is_(False),
            )
            .all()
        )
        for duplicate in inactive_duplicates:
            duplicate.list_name = f"{duplicate.list_name}__deleted_{duplicate.id}"
        lt.list_name = next_name
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
    lt.list_name = f"{lt.list_name}__deleted_{lt.id}"
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


def _today_for_family(db: Session, family_id: int) -> date:
    family = db.get(Family, family_id)
    return today_for_timezone(family.timezone if family else None)


def _frequency_days(db: Session, frequency: str) -> int:
    days = (
        db.query(FrequencyType.days_interval)
        .filter(FrequencyType.frequency_name == frequency)
        .scalar()
    )
    return int(days or FALLBACK_FREQUENCY_DAYS.get(frequency, 7))


def _cycle_start_for_item(db: Session, item: GroceryItem, today: date | None = None) -> date:
    current = today or date.today()
    anchor = item.start_date or current
    if current < anchor:
        return anchor
    days = _frequency_days(db, item.purchase_frequency)
    elapsed = (current - anchor).days
    return anchor + timedelta(days=(elapsed // days) * days)


def _ensure_cycle_for_item(db: Session, item: GroceryItem, today: date | None = None) -> GroceryPurchaseCycle:
    today = today or _today_for_family(db, item.family_id)
    start = _cycle_start_for_item(db, item, today)
    days = _frequency_days(db, item.purchase_frequency)
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
            cycle_end_date=start + timedelta(days=days - 1),
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
                carried_forward=False,
            )
        )
        db.flush()

    return cycle


def create_item(db: Session, payload: GroceryItemCreate, family_id: int, user_id: int) -> dict:
    list_type = db.get(GroceryListType, payload.listTypeId)
    if not list_type or list_type.family_id != family_id or not list_type.is_active:
        raise HTTPException(status_code=404, detail="Grocery list type not found")

    item_name = sanitize_text(payload.itemName)
    existing = db.query(GroceryItem).filter_by(list_type_id=payload.listTypeId, item_name=item_name, is_active=True).first()
    if existing:
        raise HTTPException(status_code=409, detail="A grocery item with this name already exists in this list")
    today = _today_for_family(db, family_id)
    start_date = payload.startDate or today
    inactive = db.query(GroceryItem).filter_by(list_type_id=payload.listTypeId, item_name=item_name, is_active=False).first()
    if inactive:
        inactive.quantity = Decimal(str(payload.quantity))
        inactive.unit = sanitize_text(payload.unit)
        inactive.purchase_frequency = payload.purchaseFrequency
        inactive.current_stock = payload.currentStock
        inactive.start_date = start_date
        inactive.expiry_date = payload.expiryDate or (start_date + timedelta(days=5) if payload.purchaseFrequency == "weekly" else None)
        inactive.notes = sanitize_text(payload.notes)
        inactive.created_by = user_id
        inactive.is_active = True
        _ensure_cycle_for_item(db, inactive, today)
        write_audit_log(
            db,
            user_id=user_id,
            family_id=family_id,
            action="restore",
            entity_type="grocery_item",
            entity_id=inactive.id,
            changes={"item_name": inactive.item_name, "list_type_id": inactive.list_type_id},
        )
        db.commit()
        db.refresh(inactive)
        invalidate_entity("groceries", family_id)
        invalidate_entity("cycles", family_id)
        invalidate_entity("shopping_items", family_id)
        return serialize_grocery_item(inactive)

    item = GroceryItem(
        item_number="PENDING",
        item_name=item_name,
        list_type_id=payload.listTypeId,
        quantity=Decimal(str(payload.quantity)),
        unit=sanitize_text(payload.unit),
        purchase_frequency=payload.purchaseFrequency,
        current_stock=payload.currentStock,
        start_date=start_date,
        expiry_date=payload.expiryDate or (start_date + timedelta(days=5) if payload.purchaseFrequency == "weekly" else None),
        notes=sanitize_text(payload.notes),
        family_id=family_id,
        created_by=user_id,
    )
    db.add(item)
    db.flush()
    item.item_number = f"GRC-{item.id:04d}"
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
    invalidate_entity("shopping_items", family_id)
    invalidate_entity("notifications", family_id)
    return serialize_grocery_item(item)


def update_item(db: Session, item_id: int, payload: GroceryItemUpdate, family_id: int, user_id: int) -> dict:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id or not item.is_active:
        raise HTTPException(status_code=404, detail="Grocery item not found")

    updates = payload.model_dump(exclude_unset=True)
    next_list_type_id = int(updates.get("listTypeId") or item.list_type_id)
    if "listTypeId" in updates and updates["listTypeId"] is not None:
        list_type = db.get(GroceryListType, next_list_type_id)
        if not list_type or list_type.family_id != family_id or not list_type.is_active:
            raise HTTPException(status_code=404, detail="Grocery list type not found")

    next_item_name = item.item_name
    if "itemName" in updates and updates["itemName"]:
        next_item_name = sanitize_text(updates["itemName"])

    if "itemName" in updates or "listTypeId" in updates:
        active_duplicate = (
            db.query(GroceryItem)
            .filter(
                GroceryItem.list_type_id == next_list_type_id,
                GroceryItem.item_name == next_item_name,
                GroceryItem.id != item.id,
                GroceryItem.is_active.is_(True),
            )
            .first()
        )
        if active_duplicate:
            raise HTTPException(status_code=409, detail="A grocery item with this name already exists in this list")
        inactive_duplicates = (
            db.query(GroceryItem)
            .filter(
                GroceryItem.list_type_id == next_list_type_id,
                GroceryItem.item_name == next_item_name,
                GroceryItem.id != item.id,
                GroceryItem.is_active.is_(False),
            )
            .all()
        )
        for duplicate in inactive_duplicates:
            duplicate.item_name = f"{duplicate.item_name}__deleted_{duplicate.id}"

    field_map = {
        "itemName": "item_name",
        "listTypeId": "list_type_id",
        "quantity": "quantity",
        "unit": "unit",
        "purchaseFrequency": "purchase_frequency",
        "currentStock": "current_stock",
        "startDate": "start_date",
        "notes": "notes",
        "expiryDate": "expiry_date",
    }
    for api_field, model_field in field_map.items():
        if api_field in updates:
            value = updates[api_field]
            if value is None and api_field != "expiryDate":
                continue
            if api_field == "quantity":
                value = Decimal(str(value))
            if api_field == "listTypeId":
                value = int(value)
            if isinstance(value, str):
                value = sanitize_text(value)
            setattr(item, model_field, value)

    if "purchased" in updates:
        _set_item_purchased(db, item, bool(updates["purchased"]))
        item.current_stock = bool(updates["purchased"])
    elif "currentStock" in updates:
        _set_item_purchased(db, item, bool(updates["currentStock"]))

    today = _today_for_family(db, family_id)
    target_cycle_start = _cycle_start_for_item(db, item, today)
    for sub_item in list(item.sub_list_items):
        cycle = sub_item.purchase_cycle
        if cycle and not cycle.is_completed and (
            cycle.list_type_id != item.list_type_id
            or cycle.frequency != item.purchase_frequency
            or cycle.cycle_start_date != target_cycle_start
        ):
            db.delete(sub_item)

    cycle = _ensure_cycle_for_item(db, item, today)
    sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if sub_item and any(field in updates for field in ("quantity", "unit", "notes", "listTypeId", "purchaseFrequency", "startDate")):
        sub_item.quantity = item.quantity
        sub_item.unit = item.unit
        sub_item.notes = item.notes
        if item.current_stock:
            sub_item.is_purchased = True
            sub_item.purchased_quantity = item.quantity
        else:
            _reconcile_sub_item_purchase(sub_item)

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
    invalidate_entity("shopping_items", family_id)
    return serialize_grocery_item(item)


def _set_item_purchased(db: Session, item: GroceryItem, purchased: bool) -> None:
    cycle = _ensure_cycle_for_item(db, item)
    sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if sub_item:
        sub_item.is_purchased = purchased
        sub_item.purchased_quantity = sub_item.quantity if purchased else Decimal("0.00")


def _to_decimal(value: Decimal | int | float | str | None) -> Decimal:
    return Decimal(str(value if value is not None else 0))


def _reconcile_sub_item_purchase(sub_item: GrocerySubList) -> None:
    required = _to_decimal(sub_item.quantity)
    purchased = min(_to_decimal(sub_item.purchased_quantity), required) if required >= 0 else Decimal("0.00")
    sub_item.purchased_quantity = purchased
    sub_item.is_purchased = required <= 0 or purchased >= required


def _shopping_items_query(db: Session, family_id: int, list_type_id: int | None = None):
    query = (
        db.query(GrocerySubList)
        .join(GroceryPurchaseCycle, GrocerySubList.purchase_cycle_id == GroceryPurchaseCycle.id)
        .join(GroceryItem, GrocerySubList.item_id == GroceryItem.id)
        .join(GroceryListType, GroceryPurchaseCycle.list_type_id == GroceryListType.id)
        .filter(
            GroceryPurchaseCycle.family_id == family_id,
            GroceryPurchaseCycle.is_completed.is_(False),
            GroceryListType.is_active.is_(True),
            GroceryItem.is_active.is_(True),
        )
    )
    if list_type_id:
        query = query.filter(GroceryPurchaseCycle.list_type_id == list_type_id)
    return query


def list_current_shopping_items(db: Session, family_id: int, list_type_id: int | None = None) -> list[dict]:
    rows = _shopping_items_query(db, family_id, list_type_id).order_by(GroceryPurchaseCycle.id, GrocerySubList.id).all()
    return [serialize_shopping_item(row) for row in rows]


def build_current_shopping_list(db: Session, family_id: int) -> list[dict]:
    today = _today_for_family(db, family_id)
    items = (
        db.query(GroceryItem)
        .join(GroceryListType, GroceryItem.list_type_id == GroceryListType.id)
        .filter(
            GroceryItem.family_id == family_id,
            GroceryItem.is_active.is_(True),
            GroceryListType.is_active.is_(True),
        )
        .order_by(GroceryItem.id)
        .all()
    )
    for item in items:
        _ensure_cycle_for_item(db, item, today)

    db.commit()
    _invalidate_shopping_state(family_id)
    return list_current_shopping_items(db, family_id)


def get_shopping_item(db: Session, sub_item_id: int, family_id: int) -> dict:
    sub_item = _get_active_shopping_sub_item(db, sub_item_id, family_id)
    return serialize_shopping_item(sub_item)


def _get_active_shopping_sub_item(db: Session, sub_item_id: int, family_id: int) -> GrocerySubList:
    sub_item = (
        _shopping_items_query(db, family_id)
        .filter(GrocerySubList.id == sub_item_id)
        .first()
    )
    if not sub_item:
        raise HTTPException(status_code=404, detail="Shopping item not found")
    return sub_item


def update_shopping_item(
    db: Session,
    sub_item_id: int,
    payload: ShoppingItemUpdate,
    family_id: int,
    user_id: int,
) -> dict:
    sub_item = _get_active_shopping_sub_item(db, sub_item_id, family_id)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return serialize_shopping_item(sub_item)

    if "quantity" in updates:
        sub_item.quantity = _to_decimal(updates["quantity"])
    if "unit" in updates and updates["unit"] is not None:
        sub_item.unit = sanitize_text(updates["unit"]) or "Units"
    if "notes" in updates:
        sub_item.notes = sanitize_text(updates["notes"] or "")

    if "isPurchased" in updates:
        purchased = bool(updates["isPurchased"])
        sub_item.is_purchased = purchased
        sub_item.purchased_quantity = _to_decimal(sub_item.quantity) if purchased else Decimal("0.00")
    elif "purchasedQuantity" in updates:
        required = _to_decimal(sub_item.quantity)
        sub_item.purchased_quantity = min(_to_decimal(updates["purchasedQuantity"]), required)
        _reconcile_sub_item_purchase(sub_item)
    elif "quantity" in updates:
        _reconcile_sub_item_purchase(sub_item)

    if sub_item.item:
        sub_item.item.current_stock = bool(sub_item.is_purchased)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="grocery_sub_list",
        entity_id=sub_item.id,
        changes=updates,
    )
    db.commit()
    db.refresh(sub_item)
    _invalidate_shopping_state(family_id)
    return serialize_shopping_item(sub_item)


def add_adhoc_shopping_item(
    db: Session,
    payload: ShoppingAdhocCreate,
    family_id: int,
    user_id: int,
) -> dict:
    list_type = db.get(GroceryListType, payload.listTypeId)
    if not list_type or list_type.family_id != family_id or not list_type.is_active:
        raise HTTPException(status_code=404, detail="Grocery list type not found")

    item_name = sanitize_text(payload.itemName)
    unit = sanitize_text(payload.unit) or "Units"
    notes = sanitize_text(payload.notes)
    quantity = _to_decimal(payload.quantity)
    today = _today_for_family(db, family_id)

    item = (
        db.query(GroceryItem)
        .filter_by(family_id=family_id, list_type_id=payload.listTypeId, item_name=item_name, is_active=True)
        .first()
    )
    if not item:
        item = GroceryItem(
            item_number="PENDING",
            item_name=item_name,
            list_type_id=payload.listTypeId,
            quantity=quantity,
            unit=unit,
            purchase_frequency=payload.purchaseFrequency,
            current_stock=False,
            start_date=today,
            expiry_date=today + timedelta(days=5) if payload.purchaseFrequency == "weekly" else None,
            notes=notes,
            family_id=family_id,
            created_by=user_id,
        )
        db.add(item)
        db.flush()
        item.item_number = f"GRC-{item.id:04d}"
    else:
        item.current_stock = False

    cycle_start = _cycle_start_for_item(db, item, today)
    cycle = (
        db.query(GroceryPurchaseCycle)
        .filter_by(
            family_id=family_id,
            list_type_id=item.list_type_id,
            frequency=item.purchase_frequency,
            cycle_start_date=cycle_start,
        )
        .first()
    )
    existing_sub_item = None
    if cycle:
        existing_sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()

    cycle = _ensure_cycle_for_item(db, item, today)
    sub_item = existing_sub_item or db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
    if not sub_item:
        sub_item = GrocerySubList(
            purchase_cycle_id=cycle.id,
            item_id=item.id,
            quantity=quantity,
            unit=unit,
            is_purchased=False,
            purchased_quantity=Decimal("0.00"),
            notes=notes,
            is_adhoc=True,
        )
        db.add(sub_item)
        db.flush()

    if existing_sub_item:
        sub_item.quantity = _to_decimal(sub_item.quantity) + quantity
        sub_item.purchased_quantity = min(_to_decimal(sub_item.purchased_quantity), _to_decimal(sub_item.quantity))
    else:
        sub_item.quantity = quantity
        sub_item.purchased_quantity = Decimal("0.00")
    sub_item.unit = unit
    sub_item.is_adhoc = True
    if notes:
        existing_notes = sub_item.notes or ""
        sub_item.notes = notes if not existing_notes else existing_notes if notes in existing_notes else f"{existing_notes}; {notes}"
    _reconcile_sub_item_purchase(sub_item)
    if sub_item.item:
        sub_item.item.current_stock = bool(sub_item.is_purchased)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="grocery_sub_list",
        entity_id=sub_item.id,
        changes={"item_name": item_name, "list_type_id": payload.listTypeId, "quantity": float(quantity), "adhoc": True},
    )
    db.commit()
    db.refresh(sub_item)
    _invalidate_shopping_state(family_id)
    return serialize_shopping_item(sub_item)


def delete_item(db: Session, item_id: int, family_id: int, user_id: int) -> None:
    item = db.get(GroceryItem, item_id)
    if not item or item.family_id != family_id or not item.is_active:
        raise HTTPException(status_code=404, detail="Grocery item not found")
    item.is_active = False
    item.item_name = f"{item.item_name}__deleted_{item.id}"
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
    invalidate_entity("shopping_items", family_id)


def regenerate_cycles(db: Session, family_id: int, user_id: int | None = None) -> list[dict]:
    items = db.query(GroceryItem).filter_by(family_id=family_id, is_active=True).all()

    # Snapshot sub_item IDs that exist in active cycles before this regen
    pre_regen_sub_ids: set[int] = set()
    carry_forward_items: list[tuple[int, int]] = []  # (item_id, list_type_id)
    for cycle in db.query(GroceryPurchaseCycle).filter_by(family_id=family_id, is_completed=False).all():
        for sub_item in cycle.sub_list_items:
            pre_regen_sub_ids.add(sub_item.id)
            if sub_item.item and sub_item.item.is_active and not sub_item.item.current_stock and not sub_item.is_purchased:
                carry_forward_items.append((sub_item.item_id, cycle.list_type_id))
            sub_item.carried_forward = False
        cycle.is_completed = True
    db.flush()

    cycles: list[GroceryPurchaseCycle] = []
    today = _today_for_family(db, family_id)
    for item in items:
        cycle = _ensure_cycle_for_item(db, item, today)
        cycle.is_completed = False
        sub_item = db.query(GrocerySubList).filter_by(purchase_cycle_id=cycle.id, item_id=item.id).first()
        if sub_item:
            # Only carry forward if this sub_item existed before this regen (not newly created)
            sub_item.carried_forward = (
                sub_item.id in pre_regen_sub_ids
                and (item.id, item.list_type_id) in carry_forward_items
            )
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
    invalidate_entity("shopping_items", family_id)
    return [serialize_cycle(cycle) for cycle in cycles]
