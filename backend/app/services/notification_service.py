from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Notification
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    family_id: int,
    title: str,
    message: str,
    type_: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        family_id=family_id,
        title=title,
        message=message,
        type=type_,
        is_read=False,
    )
    db.add(notification)
    db.flush()
    invalidate_entity("notifications", family_id)
    return notification


def list_notifications(
    db: Session,
    user_id: int,
    family_id: int,
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    query = db.query(Notification).filter_by(user_id=user_id, family_id=family_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return [
        serialize_notification(notification)
        for notification in query.order_by(Notification.created_at.desc()).offset(offset).limit(limit).all()
    ]


def mark_read(db: Session, notification_id: int, user_id: int, family_id: int) -> dict:
    notification = db.get(Notification, notification_id)
    if not notification or notification.family_id != family_id or notification.user_id != user_id:
        raise ValueError("Notification not found")
    notification.is_read = True
    notification.read_at = datetime.now(UTC)
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="mark_read",
        entity_type="notification",
        entity_id=notification.id,
    )
    db.commit()
    invalidate_entity("notifications", family_id)
    return serialize_notification(notification)


def bulk_mark_read(db: Session, user_id: int, family_id: int) -> int:
    """Mark all unread notifications as read for a user. Returns count."""
    count = (
        db.query(Notification)
        .filter_by(user_id=user_id, family_id=family_id, is_read=False)
        .update({"is_read": True, "read_at": datetime.now(UTC)})
    )
    db.commit()
    invalidate_entity("notifications", family_id)
    return count
