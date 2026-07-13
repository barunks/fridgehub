import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.config import settings
from app.core.dependencies import CurrentUser, token_revocation_key
from app.core.permissions import effective_permissions
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.models import Device, DeviceSession, FamilyMember, User
from app.services.audit_service import write_audit_log


def _active_memberships(db: Session, user_id: int) -> list[FamilyMember]:
    return (
        db.query(FamilyMember)
        .filter(FamilyMember.user_id == user_id, FamilyMember.is_active.is_(True))
        .order_by(FamilyMember.id)
        .all()
    )


def _select_membership(db: Session, user: User, family_id: int | None = None) -> FamilyMember:
    memberships = _active_memberships(db, user.id)
    if family_id is not None:
        membership = next((item for item in memberships if item.family_id == family_id), None)
        if not membership:
            raise HTTPException(status_code=403, detail="User is not an active member of that family")
        return membership

    if not memberships:
        raise HTTPException(status_code=403, detail="User has no active family membership")
    if len(memberships) > 1:
        raise HTTPException(status_code=409, detail="Family selection required")
    return memberships[0]


def _token_context(user: User, membership: FamilyMember) -> dict[str, object]:
    return {
        "username": user.username,
        "family_id": membership.family_id,
        "role": membership.role,
        "permissions": sorted(effective_permissions(membership.role, membership.permissions)),
        "ver": int(user.token_version or 0),
    }


def _issue_tokens(user: User, membership: FamilyMember, extra: dict[str, object] | None = None) -> dict[str, str]:
    context = _token_context(user, membership)
    if extra:
        context.update(extra)
    return {
        "accessToken": create_access_token(str(user.id), extra=context),
        "refreshToken": create_refresh_token(str(user.id), extra=context),
        "tokenType": "bearer",
    }


def _device_identifier(device_id: str | None, user_agent: str | None, ip_address: str | None) -> str:
    """Return the client-provided device fingerprint, or derive one from request metadata."""
    if device_id:
        return device_id
    # Fallback for clients that don't send a fingerprint (API tools, curl, etc.)
    fingerprint = f"{user_agent or 'unknown'}|{ip_address or 'unknown'}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, fingerprint))


def _register_device(
    db: Session,
    user: User,
    family_id: int,
    device_id: str | None,
    device_name: str | None,
    user_agent: str | None,
    ip_address: str | None,
) -> str:
    device_id = _device_identifier(device_id, user_agent, ip_address)

    from app.models import Device

    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.device_id == device_id)
        .one_or_none()
    )
    if device and device.is_revoked:
        raise HTTPException(status_code=403, detail="This device has been revoked. Contact a family admin.")
    if not device:
        # Enforce max devices per user (stored on user row, default 5)
        active_device_count = (
            db.query(Device)
            .filter(Device.user_id == user.id, Device.is_active.is_(True), Device.is_revoked.is_(False))
            .count()
        )
        if active_device_count >= user.max_devices:
            raise HTTPException(
                status_code=403,
                detail=f"Maximum number of devices ({user.max_devices}) reached. Revoke an existing device to register a new one.",
            )
        device = Device(
            user_id=user.id,
            family_id=family_id,
            device_id=device_id,
            device_name=device_name,
            device_type="browser",
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(device)
        db.flush()
        write_audit_log(
            db,
            user_id=user.id,
            family_id=family_id,
            action="device_registered",
            entity_type="device",
            entity_id=device.id,
            changes={"device_id": device_id, "device_name": device_name, "ip_address": ip_address},
        )
    else:
        device.device_name = device_name or device.device_name
        device.last_user_agent = user_agent
        device.last_ip = ip_address
        device.last_used_at = datetime.now(timezone.utc)
        device.family_id = family_id
    db.flush()
    return device_id


def _record_session(
    db: Session,
    user: User,
    family_id: int,
    device_id_str: str,
    tokens: dict[str, str],
    user_agent: str | None,
    ip_address: str | None,
) -> None:
    """Record token sessions for the device."""
    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.device_id == device_id_str)
        .one_or_none()
    )
    if not device:
        return
    for token_key, token_type in [("accessToken", "access"), ("refreshToken", "refresh")]:
        try:
            payload = decode_token(tokens[token_key], verify_exp=False)
        except ValueError:
            continue
        jti = payload.get("jti")
        exp = payload.get("exp")
        if not jti or not exp:
            continue
        session = DeviceSession(
            device_id=device.id,
            user_id=user.id,
            family_id=family_id,
            jti=str(jti),
            token_type=token_type,
            expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(session)


def login(
    db: Session,
    username: str,
    password: str,
    family_id: int | None = None,
    device_id: str | None = None,
    device_name: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, str]:
    user = db.query(User).filter((User.username == username) | (User.email == username)).first()
    if not user or not user.is_active or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    membership = _select_membership(db, user, family_id)
    registered_device_id = _register_device(db, user, membership.family_id, device_id, device_name, user_agent, ip_address)
    extra_context: dict[str, object] = {}
    if registered_device_id:
        extra_context["device_id"] = registered_device_id
    tokens = _issue_tokens(user, membership, extra_context)
    _record_session(db, user, membership.family_id, registered_device_id, tokens, user_agent, ip_address)
    db.commit()
    return tokens


def refresh(
    db: Session,
    refresh_token: str,
    family_id: int | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, str]:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token required")

    jti = payload.get("jti")
    if jti and cache.get(token_revocation_key(str(jti))):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    user_id = payload.get("sub")
    user = db.get(User, int(user_id)) if user_id and str(user_id).isdigit() else None
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    token_version = payload.get("ver")
    if token_version is None or not str(token_version).isdigit() or int(token_version) != int(user.token_version or 0):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    device_id = payload.get("device_id")
    if not device_id or not isinstance(device_id, str):
        raise HTTPException(status_code=401, detail="Refresh token is missing device information")

    device = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.device_id == device_id, Device.is_active.is_(True))
        .one_or_none()
    )
    if not device:
        raise HTTPException(status_code=401, detail="Device session is no longer valid")
    if device.is_revoked:
        raise HTTPException(status_code=403, detail="This device has been revoked")

    device.last_used_at = datetime.now(timezone.utc)

    selected_family_id = family_id
    if selected_family_id is None and payload.get("family_id") and str(payload.get("family_id")).isdigit():
        selected_family_id = int(payload["family_id"])
    membership = _select_membership(db, user, selected_family_id)

    if jti:
        cache.set(
            token_revocation_key(str(jti)),
            True,
            ttl_seconds=settings.refresh_token_expire_days * 24 * 60 * 60,
        )

    tokens = _issue_tokens(user, membership, {"device_id": device_id})
    _record_session(db, user, membership.family_id, device_id, tokens, user_agent, ip_address)
    db.commit()
    return tokens


def logout_subject(db: Session, user_id: int | None, token_jti: str | None = None) -> dict[str, str]:
    if token_jti:
        cache.set(
            token_revocation_key(token_jti),
            True,
            ttl_seconds=int(timedelta(days=settings.token_revocation_ttl_days).total_seconds()),
        )

    if user_id:
        user = db.get(User, user_id)
        if user:
            user.token_version = int(user.token_version or 0) + 1
            db.commit()

    return {"status": "logged_out"}


def logout_by_token(db: Session, token: str | None) -> dict[str, str]:
    if not token:
        return {"status": "logged_out"}
    try:
        payload = decode_token(token, verify_exp=False)
    except ValueError:
        return {"status": "logged_out"}

    user_id = payload.get("sub")
    return logout_subject(
        db,
        int(user_id) if user_id and str(user_id).isdigit() else None,
        token_jti=str(payload.get("jti")) if payload.get("jti") else None,
    )


def change_password(db: Session, current_user: CurrentUser, current_password: str, new_password: str) -> dict[str, str]:
    from app.core.security import hash_password

    if not verify_password(current_password, current_user.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.user.password_hash = hash_password(new_password)
    current_user.user.token_version = int(current_user.user.token_version or 0) + 1
    db.commit()
    return {"status": "password_changed"}
