from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.fridgehub import NotificationOut
from app.services.notification_service import bulk_mark_read, list_notifications, mark_read

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_permission(Permission.MARK_NOTIFICATIONS)),
    db: Session = Depends(get_db),
) -> list[dict]:
    return list_notifications(db, current_user.user_id, current_user.family_id, unread_only, limit, offset)


@router.post("/mark-all-read")
def mark_all_read(
    current_user: CurrentUser = Depends(require_permission(Permission.MARK_NOTIFICATIONS)),
    db: Session = Depends(get_db),
) -> dict:
    count = bulk_mark_read(db, current_user.user_id, current_user.family_id)
    return {"marked": count}


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(
    notification_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return mark_read(db, notification_id, current_user.user_id, current_user.family_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
