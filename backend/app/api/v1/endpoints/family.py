from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, current_user_payload, get_current_user, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.fridgehub import (
    AnnouncementCreate,
    AnnouncementOut,
    AuditLogOut,
    BootstrapState,
    EmergencyContactCreate,
    EmergencyContactOut,
    EmergencyContactUpdate,
    ErrorResponse,
    FamilyMemberCreate,
    FamilyMemberOut,
    FamilyMemberUpdate,
)
from app.services.announcement_service import create_announcement, delete_announcement
from app.services.audit_service import list_audit_logs
from app.services.family_service import bootstrap_state
from app.services import family_management_service

router = APIRouter()


@router.get("/bootstrap", response_model=BootstrapState)
def bootstrap(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    state = bootstrap_state(db, current_user.family_id)
    session = current_user_payload(current_user)
    return {
        **state,
        "currentUser": session,
        "capabilities": session["capabilities"],
    }


@router.get("/audit-logs", response_model=list[AuditLogOut])
def get_audit_logs(
    entity_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(require_permission(Permission.VIEW_AUDIT)),
    db: Session = Depends(get_db),
) -> list[dict]:
    return list_audit_logs(db, current_user.family_id, entity_type, limit, offset)


@router.post("/announcements", response_model=AnnouncementOut)
def add_announcement(
    payload: AnnouncementCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_ANNOUNCEMENTS)),
    db: Session = Depends(get_db),
) -> dict:
    return create_announcement(db, payload, current_user.family_id, current_user.user_id)


@router.delete("/announcements/{announcement_id}", status_code=204)
def remove_announcement(
    announcement_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_ANNOUNCEMENTS)),
    db: Session = Depends(get_db),
) -> None:
    delete_announcement(db, announcement_id, current_user.family_id, current_user.user_id)


@router.get("/members", response_model=list[FamilyMemberOut])
def get_members(current_user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    return family_management_service.list_members(db, current_user.family_id)


@router.post("/members", response_model=FamilyMemberOut, responses={403: {"model": ErrorResponse}, 409: {"model": ErrorResponse}})
def add_member(
    payload: FamilyMemberCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> dict:
    return family_management_service.create_member(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/members/{member_user_id}", response_model=FamilyMemberOut, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def update_member(
    member_user_id: int,
    payload: FamilyMemberUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> dict:
    return family_management_service.update_member(db, member_user_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/members/{member_user_id}", status_code=204, responses={403: {"model": ErrorResponse}, 404: {"model": ErrorResponse}})
def remove_member(
    member_user_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> None:
    family_management_service.delete_member(db, member_user_id, current_user.family_id, current_user.user_id)


@router.get("/emergency-contacts", response_model=list[EmergencyContactOut])
def get_emergency_contacts(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return family_management_service.list_emergency_contacts(db, current_user.family_id)


@router.post("/emergency-contacts", response_model=EmergencyContactOut)
def add_emergency_contact(
    payload: EmergencyContactCreate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_CONTACTS)),
    db: Session = Depends(get_db),
) -> dict:
    return family_management_service.create_emergency_contact(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/emergency-contacts/{contact_id}", response_model=EmergencyContactOut)
def update_emergency_contact(
    contact_id: int,
    payload: EmergencyContactUpdate,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_CONTACTS)),
    db: Session = Depends(get_db),
) -> dict:
    return family_management_service.update_emergency_contact(
        db,
        contact_id,
        payload,
        current_user.family_id,
        current_user.user_id,
    )


@router.delete("/emergency-contacts/{contact_id}", status_code=204)
def remove_emergency_contact(
    contact_id: int,
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_CONTACTS)),
    db: Session = Depends(get_db),
) -> None:
    family_management_service.delete_emergency_contact(db, contact_id, current_user.family_id, current_user.user_id)


@router.delete("/data", responses={403: {"model": ErrorResponse}})
def purge_family_data(
    current_user: CurrentUser = Depends(require_permission(Permission.MANAGE_FAMILY)),
    db: Session = Depends(get_db),
) -> dict:
    return family_management_service.purge_family_data(db, current_user.family_id, current_user.user_id)
