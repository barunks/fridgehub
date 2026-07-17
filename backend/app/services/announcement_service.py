from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Announcement
from app.schemas.fridgehub import AnnouncementCreate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_announcement
from app.utils.sanitize import sanitize_text


def create_announcement(db: Session, payload: AnnouncementCreate, family_id: int, user_id: int) -> dict:
    announcement = Announcement(
        family_id=family_id,
        title=sanitize_text(payload.title),
        message=sanitize_text(payload.message),
        owner_id=user_id,
        tag=sanitize_text(payload.tag),
    )
    db.add(announcement)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="announcement",
        entity_id=announcement.id,
        changes={"title": announcement.title},
    )
    db.commit()
    db.refresh(announcement)
    invalidate_entity("announcements", family_id)
    return serialize_announcement(announcement)


def delete_announcement(db: Session, announcement_id: int, family_id: int, user_id: int) -> None:
    announcement = db.get(Announcement, announcement_id)
    if not announcement or announcement.family_id != family_id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(announcement)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="announcement",
        entity_id=announcement_id,
    )
    db.commit()
    invalidate_entity("announcements", family_id)
