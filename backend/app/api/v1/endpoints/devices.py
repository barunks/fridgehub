from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.dependencies import CurrentUser, get_current_user, require_permission, token_revocation_key
from app.core.permissions import Permission
from app.models import Device, DeviceSession
from app.schemas.familyhub import DeviceOut, DeviceUpdate, ErrorResponse
from app.services.audit_service import write_audit_log

router = APIRouter()


def _serialize_device(device: Device) -> dict:
    return {
        "id": device.id,
        "deviceId": device.device_id,
        "deviceName": device.device_name or "Unknown device",
        "deviceType": device.device_type,
        "platform": device.platform,
        "ipAddress": device.last_ip or device.ip_address,
        "isActive": device.is_active,
        "isRevoked": device.is_revoked,
        "isTrusted": device.is_trusted,
        "registeredAt": device.registered_at,
        "lastUsedAt": device.last_used_at,
    }


@router.get("", response_model=list[DeviceOut])
def list_devices(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    devices = (
        db.query(Device)
        .filter(Device.user_id == current_user.user_id, Device.is_active.is_(True))
        .order_by(Device.last_used_at.desc())
        .all()
    )
    return [_serialize_device(d) for d in devices]


@router.patch("/{device_id}", response_model=DeviceOut, responses={404: {"model": ErrorResponse}})
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    device = db.query(Device).filter(Device.id == device_id, Device.user_id == current_user.user_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    updates = payload.model_dump(exclude_unset=True)
    if "deviceName" in updates:
        device.device_name = updates["deviceName"]
    if "isTrusted" in updates:
        device.is_trusted = updates["isTrusted"]

    write_audit_log(db, user_id=current_user.user_id, family_id=current_user.family_id, action="device_updated", entity_type="device", entity_id=device.id, changes=updates)
    db.commit()
    db.refresh(device)
    return _serialize_device(device)


@router.delete("/{device_id}", status_code=204, responses={404: {"model": ErrorResponse}})
def revoke_device(
    device_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    device = db.query(Device).filter(Device.id == device_id, Device.user_id == current_user.user_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.is_revoked = True
    device.is_active = False

    # Revoke all active sessions for this device
    sessions = db.query(DeviceSession).filter(DeviceSession.device_id == device.id, DeviceSession.is_active.is_(True)).all()
    for session in sessions:
        session.is_active = False
        session.revoked_at = datetime.now(timezone.utc)
        cache.set(token_revocation_key(session.jti), True, ttl_seconds=7 * 24 * 60 * 60)

    write_audit_log(db, user_id=current_user.user_id, family_id=current_user.family_id, action="device_revoked", entity_type="device", entity_id=device.id)
    db.commit()


@router.post("/{device_id}/revoke-sessions", responses={404: {"model": ErrorResponse}})
def revoke_device_sessions(
    device_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    device = db.query(Device).filter(Device.id == device_id, Device.user_id == current_user.user_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    sessions = db.query(DeviceSession).filter(DeviceSession.device_id == device.id, DeviceSession.is_active.is_(True)).all()
    count = 0
    for session in sessions:
        session.is_active = False
        session.revoked_at = datetime.now(timezone.utc)
        cache.set(token_revocation_key(session.jti), True, ttl_seconds=7 * 24 * 60 * 60)
        count += 1

    write_audit_log(db, user_id=current_user.user_id, family_id=current_user.family_id, action="device_sessions_revoked", entity_type="device", entity_id=device.id, changes={"revoked_count": count})
    db.commit()
    return {"revoked": count}
