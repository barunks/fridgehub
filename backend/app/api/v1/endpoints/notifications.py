from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user
from app.core.database import get_db
from app.schemas.familyhub import NotificationOut
from app.services.notification_service import list_notifications, mark_read

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
def get_notifications(
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return list_notifications(db, current_user.user_id, current_user.family_id, unread_only, limit, offset)


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
