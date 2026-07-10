from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import EmergencyContact, FamilyMember, User
from app.schemas.familyhub import (
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


def list_members(db: Session, family_id: int) -> list[dict]:
    rows = db.query(FamilyMember).filter_by(family_id=family_id).order_by(FamilyMember.id).all()
    return [serialize_member(row) for row in rows]


def create_member(db: Session, payload: FamilyMemberCreate, family_id: int, user_id: int) -> dict:
    if db.query(User).filter((User.email == payload.email) | (User.username == payload.username)).first():
        raise HTTPException(status_code=409, detail="Email or username already exists")
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
        changes={"username": user.username, "role": member.role},
    )
    db.commit()
    db.refresh(member)
    invalidate_entity("members", family_id)
    return serialize_member(member)


def update_member(db: Session, member_user_id: int, payload: FamilyMemberUpdate, family_id: int, user_id: int) -> dict:
    member = db.query(FamilyMember).filter_by(family_id=family_id, user_id=member_user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"]:
        member.user.full_name = sanitize_text(updates["name"])
        member.initial = sanitize_text(updates["name"][:1].upper())
    if "role" in updates and updates["role"]:
        member.role = sanitize_text(updates["role"])
        member.user.family_role = member.role
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
    return serialize_member(member)


def delete_member(db: Session, member_user_id: int, family_id: int, user_id: int) -> None:
    member = db.query(FamilyMember).filter_by(family_id=family_id, user_id=member_user_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    # Soft-delete: deactivate user account instead of hard delete
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
