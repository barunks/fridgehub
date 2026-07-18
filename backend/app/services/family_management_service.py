from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.permissions import normalize_permission
from app.core.security import hash_password
from app.models import EmergencyContact, FamilyMember, User
from app.schemas.fridgehub import (
    EmergencyContactCreate,
    EmergencyContactUpdate,
    FamilyMemberCreate,
    FamilyMemberUpdate,
)
from app.services.audit_service import write_audit_log
from app.services.family_service import (
    invalidate_entity,
    serialize_emergency_contact,
    serialize_member,
)
from app.utils.sanitize import sanitize_text


def _clean_permissions(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    cleaned = []
    for value in values:
        permission = normalize_permission(str(value))
        if permission and permission not in cleaned:
            cleaned.append(permission)
    return cleaned


def _assert_single_admin(db: Session, family_id: int, exclude_user_id: int | None = None) -> None:
    """Raise 409 if the family already has an active admin-equivalent member (other than exclude_user_id)."""
    from app.core.permissions import ROLE_DEFAULT_PERMISSIONS
    from sqlalchemy import func as sa_func
    admin_roles = {role for role, perms in ROLE_DEFAULT_PERMISSIONS.items() if "manage_family" in perms}
    query = (
        db.query(FamilyMember)
        .join(User, FamilyMember.user_id == User.id)
        .filter(
            FamilyMember.family_id == family_id,
            FamilyMember.is_active.is_(True),
            User.is_active.is_(True),
            (sa_func.lower(FamilyMember.role).in_(admin_roles)) | (sa_func.lower(User.family_role).in_(admin_roles)),
        )
    )
    if exclude_user_id is not None:
        query = query.filter(FamilyMember.user_id != exclude_user_id)
    if query.first():
        raise HTTPException(
            status_code=409,
            detail="This family already has an admin. Only one admin is allowed per family. Revoke the current admin role before assigning a new one.",
        )


def list_members(db: Session, family_id: int) -> list[dict]:
    rows = (
        db.query(FamilyMember)
        .join(User, FamilyMember.user_id == User.id)
        .filter(
            FamilyMember.family_id == family_id,
            FamilyMember.is_active.is_(True),
            User.is_active.is_(True),
        )
        .order_by(FamilyMember.id)
        .all()
    )
    return [serialize_member(row) for row in rows]


def create_member(db: Session, payload: FamilyMemberCreate, family_id: int, user_id: int) -> dict:
    from app.core.config import settings
    limit = settings.max_family_members
    if limit is not None:
        active_count = (
            db.query(FamilyMember)
            .join(User, FamilyMember.user_id == User.id)
            .filter(FamilyMember.family_id == family_id, FamilyMember.is_active.is_(True), User.is_active.is_(True))
            .count()
        )
        if active_count >= limit:
            raise HTTPException(
                status_code=409,
                detail=f"Family member limit ({limit}) reached. Remove an existing member before adding a new one.",
            )
    email = sanitize_text(payload.email)
    username = sanitize_text(payload.username)
    existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
    if existing:
        if existing.email == email and existing.username == username:
            raise HTTPException(status_code=409, detail="Both that email address and username are already registered.")
        if existing.email == email:
            raise HTTPException(status_code=409, detail=f"The email address '{email}' is already registered.")
        raise HTTPException(status_code=409, detail=f"The username '{username}' is already taken.")
    if sanitize_text(payload.role) == "admin":
        _assert_single_admin(db, family_id)
    user = User(
        email=sanitize_text(payload.email),
        username=sanitize_text(payload.username),
        password_hash=hash_password(payload.password),
        full_name=sanitize_text(payload.name),
        family_role=sanitize_text(payload.role),
    )
    db.add(user)
    db.flush()
    member = FamilyMember(
        family_id=family_id,
        user_id=user.id,
        role=sanitize_text(payload.role),
        initial=sanitize_text(payload.name[:1].upper() or "?"),
        color_class=sanitize_text(payload.colorClass),
        status=sanitize_text(payload.status),
        dietary_notes=[sanitize_text(note) for note in payload.dietaryNotes] if payload.dietaryNotes else None,
        permissions=_clean_permissions(payload.permissions),
    )
    db.add(member)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="family_member",
        entity_id=member.user_id,
        changes={"username": user.username, "role": member.role, "permissions": member.permissions or []},
    )
    db.commit()
    db.refresh(member)
    invalidate_entity("members", family_id)
    invalidate_entity("family", family_id)
    return serialize_member(member)


def update_member(db: Session, member_user_id: int, payload: FamilyMemberUpdate, family_id: int, user_id: int) -> dict:
    member = db.query(FamilyMember).filter_by(family_id=family_id, user_id=member_user_id, is_active=True).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"]:
        member.user.full_name = sanitize_text(updates["name"])
        member.initial = sanitize_text(updates["name"][:1].upper())
    if "role" in updates and updates["role"]:
        new_role = sanitize_text(updates["role"])
        if new_role == "admin" and member.role != "admin":
            _assert_single_admin(db, family_id, exclude_user_id=member_user_id)
        member.role = new_role
        member.user.family_role = member.role
    if "permissions" in updates:
        member.permissions = _clean_permissions(updates["permissions"])
    if "status" in updates and updates["status"]:
        member.status = sanitize_text(updates["status"])
    if "colorClass" in updates and updates["colorClass"]:
        member.color_class = sanitize_text(updates["colorClass"])
    if "points" in updates and updates["points"] is not None:
        member.points = int(updates["points"])
    if "dietaryNotes" in updates:
        member.dietary_notes = [sanitize_text(note) for note in (updates["dietaryNotes"] or [])]
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="family_member",
        entity_id=member_user_id,
        changes=updates,
    )
    db.commit()
    db.refresh(member)
    invalidate_entity("members", family_id)
    invalidate_entity("family", family_id)
    return serialize_member(member)


def delete_member(db: Session, member_user_id: int, family_id: int, user_id: int) -> None:
    if member_user_id == user_id:
        raise HTTPException(status_code=409, detail="You cannot remove your own active membership")
    member = db.query(FamilyMember).filter_by(family_id=family_id, user_id=member_user_id, is_active=True).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    member.is_active = False
    member.status = "Inactive"
    remaining_memberships = (
        db.query(FamilyMember)
        .filter(FamilyMember.user_id == member_user_id, FamilyMember.id != member.id, FamilyMember.is_active.is_(True))
        .count()
    )
    if remaining_memberships == 0:
        member.user.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="family_member",
        entity_id=member_user_id,
    )
    db.commit()
    invalidate_entity("members", family_id)
    invalidate_entity("family", family_id)


def list_emergency_contacts(db: Session, family_id: int) -> list[dict]:
    rows = db.query(EmergencyContact).filter_by(family_id=family_id).order_by(EmergencyContact.id).all()
    return [serialize_emergency_contact(row) for row in rows]


def create_emergency_contact(db: Session, payload: EmergencyContactCreate, family_id: int, user_id: int) -> dict:
    contact = EmergencyContact(family_id=family_id, label=sanitize_text(payload.label), value=sanitize_text(payload.value))
    db.add(contact)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="emergency_contact",
        entity_id=contact.id,
    )
    db.commit()
    db.refresh(contact)
    invalidate_entity("contacts", family_id)
    return serialize_emergency_contact(contact)


def update_emergency_contact(
    db: Session,
    contact_id: int,
    payload: EmergencyContactUpdate,
    family_id: int,
    user_id: int,
) -> dict:
    contact = db.get(EmergencyContact, contact_id)
    if not contact or contact.family_id != family_id:
        raise HTTPException(status_code=404, detail="Emergency contact not found")
    updates = payload.model_dump(exclude_unset=True)
    if "label" in updates and updates["label"]:
        contact.label = sanitize_text(updates["label"])
    if "value" in updates and updates["value"]:
        contact.value = sanitize_text(updates["value"])
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="emergency_contact",
        entity_id=contact.id,
        changes=updates,
    )
    db.commit()
    db.refresh(contact)
    invalidate_entity("contacts", family_id)
    return serialize_emergency_contact(contact)


def delete_emergency_contact(db: Session, contact_id: int, family_id: int, user_id: int) -> None:
    contact = db.get(EmergencyContact, contact_id)
    if not contact or contact.family_id != family_id:
        raise HTTPException(status_code=404, detail="Emergency contact not found")
    db.delete(contact)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="emergency_contact",
        entity_id=contact_id,
    )
    db.commit()
    invalidate_entity("contacts", family_id)


def purge_family_data(db: Session, family_id: int, user_id: int) -> dict[str, int]:
    """Hard-delete all operational data for a family. Keeps family record and members."""
    from app.models import (
        Announcement,
        GroceryItem,
        GroceryPurchaseCycle,
        GrocerySubList,
        MealPlan,
        MealPlanTemplate,
        Notification,
        Recipe,
        Task,
    )

    counts: dict[str, int] = {}

    # Order matters — delete dependents before parents
    # shopping_items requires subquery because of the join
    cycle_ids = db.query(GroceryPurchaseCycle.id).filter_by(family_id=family_id).scalar_subquery()
    counts["shopping_items"] = db.query(GrocerySubList).filter(
        GrocerySubList.purchase_cycle_id.in_(cycle_ids)
    ).delete(synchronize_session=False)

    counts["purchase_cycles"] = db.query(GroceryPurchaseCycle).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["grocery_items"] = db.query(GroceryItem).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["tasks"] = db.query(Task).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["meals"] = db.query(MealPlan).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["meal_templates"] = db.query(MealPlanTemplate).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["recipes"] = db.query(Recipe).filter(Recipe.family_id == family_id).delete(synchronize_session=False)
    counts["announcements"] = db.query(Announcement).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["notifications"] = db.query(Notification).filter_by(family_id=family_id).delete(synchronize_session=False)
    counts["emergency_contacts"] = db.query(EmergencyContact).filter_by(family_id=family_id).delete(synchronize_session=False)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="family_data_purged",
        entity_type="family",
        entity_id=family_id,
        changes=counts,
    )
    db.commit()
    from app.services.family_service import invalidate_family_cache
    invalidate_family_cache(family_id)
    return counts
