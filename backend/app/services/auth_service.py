import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.config import settings
from app.core.dependencies import CurrentUser, token_revocation_key
from app.core.permissions import effective_permissions, normalize_permission
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models import Device, DeviceSession, Family, FamilyInvite, FamilyMember, GroceryListType, User
from app.schemas.fridgehub import BootstrapSignupRequest, InviteSignupRequest, SignupInviteCreate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, invalidate_family_cache
from app.utils.sanitize import sanitize_text


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


def _matching_device(
    db: Session,
    user: User,
    device_name: str | None,
    device_type: str | None,
    platform: str | None,
    user_agent: str | None,
) -> Device | None:
    if not user_agent or not (device_name or device_type or platform):
        return None

    normalized_name = sanitize_text(device_name) if device_name else None
    normalized_type = sanitize_text(device_type) if device_type else None
    normalized_platform = sanitize_text(platform) if platform else None
    candidates = (
        db.query(Device)
        .filter(Device.user_id == user.id, Device.is_active.is_(True), Device.is_revoked.is_(False))
        .order_by(Device.last_used_at.desc(), Device.id.desc())
        .all()
    )
    for candidate in candidates:
        candidate_agents = {candidate.user_agent, candidate.last_user_agent}
        if user_agent not in candidate_agents:
            continue
        same_name = not normalized_name or not candidate.device_name or candidate.device_name == normalized_name
        same_type = not normalized_type or candidate.device_type in (normalized_type, "browser")
        same_platform = not normalized_platform or not candidate.platform or candidate.platform == normalized_platform
        if same_name and same_type and same_platform:
            return candidate
    return None


def _register_device(
    db: Session,
    user: User,
    family_id: int,
    device_id: str | None,
    device_name: str | None,
    device_type: str | None,
    platform: str | None,
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
        device = _matching_device(db, user, device_name, device_type, platform, user_agent)

    if not device:
        # Enforce max devices per user if configured (None = unlimited)
        limit = settings.max_devices_per_user
        if limit is not None:
            active_device_count = (
                db.query(Device)
                .filter(Device.user_id == user.id, Device.is_active.is_(True), Device.is_revoked.is_(False))
                .count()
            )
            if active_device_count >= limit:
                raise HTTPException(
                    status_code=403,
                    detail=f"Maximum number of devices ({limit}) reached. Revoke an existing device to register a new one.",
                )
        device = Device(
            user_id=user.id,
            family_id=family_id,
            device_id=device_id,
            device_name=device_name,
            device_type=sanitize_text(device_type or "browser"),
            platform=sanitize_text(platform) if platform else None,
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
        device.device_type = sanitize_text(device_type or device.device_type)
        device.platform = sanitize_text(platform) if platform else device.platform
    db.flush()
    return device.device_id


def _clean_permissions(values: list[str] | None) -> list[str]:
    cleaned: list[str] = []
    for value in values or []:
        permission = normalize_permission(str(value))
        if permission and permission not in cleaned:
            cleaned.append(permission)
    return cleaned


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _invite_token() -> str:
    return secrets.token_urlsafe(32)


def _invite_is_available(invite: FamilyInvite) -> bool:
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return invite.is_active and invite.used_count < invite.max_uses and expires_at > datetime.now(timezone.utc)


def _serialize_invite(invite: FamilyInvite, token: str | None = None) -> dict[str, object]:
    return {
        "id": invite.id,
        "inviteToken": token,
        "email": invite.email,
        "role": invite.role,
        "permissions": invite.permissions or [],
        "maxUses": invite.max_uses,
        "usedCount": invite.used_count,
        "expiresAt": invite.expires_at,
        "createdAt": invite.created_at,
        "isActive": invite.is_active and _invite_is_available(invite),
    }


def _require_unique_user(db: Session, email: str, username: str, phone: str | None = None) -> None:
    if phone:
        existing_phone = db.query(User).filter(User.phone == phone).first()
        if existing_phone:
            raise HTTPException(status_code=409, detail="That phone number is already registered. Please sign in or use a different number.")
    existing = db.query(User).filter((User.email == email) | (User.username == username)).first()
    if existing:
        if existing.email == email:
            raise HTTPException(status_code=409, detail=f"The email address '{email}' is already registered.")
        raise HTTPException(status_code=409, detail=f"The username '{username}' is already taken. Please choose a different username.")


def _create_default_grocery_places(db: Session, family_id: int, user_id: int) -> None:
    defaults = (
        ("Wet Market", "Fresh produce, fish, greens, and herbs", "bg-rose-500"),
        ("Super Market", "Packaged groceries and household supplies", "bg-teal-500"),
        ("Murugan", "Indian pantry staples and spices", "bg-sky-500"),
        ("NTUC", "Weekly supermarket run", "bg-amber-500"),
    )
    db.add_all(
        [
            GroceryListType(
                list_name=name,
                list_type="standard",
                description=description,
                color_class=color,
                family_id=family_id,
                created_by=user_id,
            )
            for name, description, color in defaults
        ]
    )


_DEFAULT_MEAL_TEMPLATE = {
    "monday": {"breakfast": "Walnut Oatmeal and Yogurt", "lunch": "Pesto Turkey Sandwich", "snacks": "Salmon with Brown Rice", "dinner": "Fresh Fruit and Espresso"},
    "tuesday": {"breakfast": "Greek Yogurt with Berries", "lunch": "Pasta with Salmon Salad", "snacks": "Veggie Burger and Corn", "dinner": "Carrots and Cheese"},
    "wednesday": {"breakfast": "Egg English Muffin", "lunch": "Couscous Lentil Salad", "snacks": "Turkey Stir-fry with Quinoa", "dinner": "Mango Cottage Cheese"},
    "thursday": {"breakfast": "Cottage Cheese and Tomato", "lunch": "Tuna and Bulgur Salad", "snacks": "Grilled Chicken and Potato", "dinner": "Banana and Popcorn"},
    "friday": {"breakfast": "Breakfast Muffin Crostini", "lunch": "Tuna Pasta Salad", "snacks": "Steak and Sweet Potato", "dinner": "Yogurt and Strawberries"},
    "saturday": {"breakfast": "Cereal with Blueberries", "lunch": "Turkey and Avocado Roll", "snacks": "Chicken and Beet Salad", "dinner": "Apricots and Ice Cream"},
    "sunday": {"breakfast": "Eggs with Mushrooms and Bacon", "lunch": "Broccoli-Cheese Potato", "snacks": "Pork with Pasta", "dinner": "Pear Celery and Grapes"},
}


def _create_default_meal_template(db: Session, family_id: int, user_id: int) -> None:
    from app.models import MealPlanTemplate

    meal_order = ["breakfast", "lunch", "snacks", "dinner"]
    for day_index, (day, meals) in enumerate(_DEFAULT_MEAL_TEMPLATE.items()):
        for meal_index, meal_type in enumerate(meal_order):
            db.add(
                MealPlanTemplate(
                    template_name="Default Weekly Meal Plan",
                    day_of_week=day,
                    meal_type=meal_type,
                    meal_name=meals[meal_type],
                    description=f"{day.title()} {meal_type}",
                    calories=260 + day_index * 25 + meal_index * 40,
                    prep_time=10 + meal_index * 8,
                    family_id=family_id,
                    template_scope=f"family:{family_id}",
                    is_global=False,
                    created_by=user_id,
                )
            )


def signup_status(db: Session) -> dict[str, bool]:
    return {"signupOpen": True}


def create_signup_invite(
    db: Session,
    payload: SignupInviteCreate,
    family_id: int,
    user_id: int,
    base_url: str = "",
) -> dict[str, object]:
    from app.services.notification_service import send_invite_email

    if sanitize_text(payload.role) == "admin":
        raise HTTPException(
            status_code=400,
            detail="Invites cannot be issued with the 'admin' role. Family admins must sign up independently via the bootstrap flow.",
        )
    # Always single use
    token = _invite_token()
    # None expiresInDays = never expires (100 years)
    expires_days = payload.expiresInDays if payload.expiresInDays else 36500
    invite = FamilyInvite(
        family_id=family_id,
        invited_by=user_id,
        token_hash=_token_hash(token),
        email=sanitize_text(payload.email.lower()),
        role=sanitize_text(payload.role),
        permissions=_clean_permissions(payload.permissions),
        max_uses=1,
        used_count=0,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
    )
    db.add(invite)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="signup_invite_created",
        entity_type="family_invite",
        entity_id=invite.id,
        changes={"email": invite.email, "role": invite.role},
    )
    db.commit()
    db.refresh(invite)

    # Send invite email
    family = db.get(Family, family_id)
    inviter = db.get(User, user_id)
    invite_link = f"{base_url}/?invite={token}" if base_url else f"/?invite={token}"
    send_invite_email(
        to=invite.email,
        family_name=family.family_name if family else "FridgeHub",
        role=invite.role,
        invite_link=invite_link,
        invited_by=inviter.full_name or inviter.username if inviter else "Admin",
    )
    return _serialize_invite(invite, token)


def list_signup_invites(db: Session, family_id: int) -> list[dict[str, object]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    invites = (
        db.query(FamilyInvite)
        .filter(FamilyInvite.family_id == family_id, FamilyInvite.created_at >= cutoff)
        .order_by(FamilyInvite.created_at.desc())
        .all()
    )
    return [_serialize_invite(invite) for invite in invites]


def revoke_signup_invite(db: Session, invite_id: int, family_id: int, user_id: int) -> None:
    invite = db.query(FamilyInvite).filter(FamilyInvite.id == invite_id, FamilyInvite.family_id == family_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="signup_invite_revoked",
        entity_type="family_invite",
        entity_id=invite.id,
    )
    db.commit()


def preview_signup_invite(db: Session, token: str) -> dict[str, object]:
    invite = db.query(FamilyInvite).filter(FamilyInvite.token_hash == _token_hash(token)).first()
    if not invite or not _invite_is_available(invite):
        raise HTTPException(status_code=404, detail="This invite link is invalid, has already been used, or has expired. Ask your family admin for a new invite.")
    family = db.get(Family, invite.family_id)
    if not family or not family.is_active:
        raise HTTPException(status_code=404, detail="The family associated with this invite no longer exists or has been deactivated.")
    return {
        "familyName": family.family_name,
        "email": invite.email,
        "role": invite.role,
        "expiresAt": invite.expires_at,
        "country": family.country or "",
        "address": family.address or "",
        "postalCode": family.postal_code or "",
    }


def bootstrap_signup(
    db: Session,
    payload: BootstrapSignupRequest,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, str]:
    email = sanitize_text(payload.email.lower())
    username = sanitize_text(payload.username)
    phone = sanitize_text(payload.phone)
    _require_unique_user(db, email, username, phone)

    # One user can only be a family admin once
    existing_admin = db.query(User).filter(User.phone == phone, User.family_role == "admin").first()
    if existing_admin:
        raise HTTPException(status_code=409, detail="This phone number is already registered as a family admin. A user can only create one family.")

    user = User(
        email=email,
        username=username,
        password_hash=hash_password(payload.password),
        full_name=sanitize_text(payload.fullName),
        family_role="admin",
        phone=phone,
    )
    db.add(user)
    db.flush()

    family = Family(
        family_name=sanitize_text(payload.familyName),
        home_base=sanitize_text(payload.homeBase),
        timezone=sanitize_text(payload.timezone),
        country=sanitize_text(payload.country),
        address=sanitize_text(payload.address) or None,
        postal_code=sanitize_text(payload.postalCode) or None,
        created_by=user.id,
    )
    db.add(family)
    db.flush()

    member = FamilyMember(
        family_id=family.id,
        user_id=user.id,
        role="admin",
        initial=sanitize_text(payload.fullName[:1].upper() or "?"),
        color_class="bg-indigo-500",
        status="Family admin",
        permissions=[],
    )
    db.add(member)
    db.flush()
    _create_default_grocery_places(db, family.id, user.id)
    _create_default_meal_template(db, family.id, user.id)

    registered_device_id = _register_device(
        db,
        user,
        family.id,
        payload.deviceId,
        payload.deviceName,
        payload.deviceType,
        payload.platform,
        user_agent,
        ip_address,
    )
    tokens = _issue_tokens(user, member, {"device_id": registered_device_id})
    _record_session(db, user, family.id, registered_device_id, tokens, user_agent, ip_address)
    write_audit_log(
        db,
        user_id=user.id,
        family_id=family.id,
        action="family_bootstrap_signup",
        entity_type="family",
        entity_id=family.id,
        changes={"username": user.username, "device_id": registered_device_id},
    )
    from app.services.verification_service import issue_otp
    issue_otp(db, user)
    db.commit()
    invalidate_family_cache(family.id)
    return tokens


def signup_with_invite(
    db: Session,
    payload: InviteSignupRequest,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, str]:
    invite = db.query(FamilyInvite).filter(FamilyInvite.token_hash == _token_hash(payload.inviteToken)).with_for_update().first()
    if not invite or not _invite_is_available(invite):
        raise HTTPException(status_code=404, detail="This invite link is invalid, has already been used, or has expired. Ask your family admin for a new invite.")

    email = sanitize_text(payload.email.lower())
    if invite.email and invite.email.lower() != email:
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address. Sign up using the email address that received the invite.")
    username = sanitize_text(payload.username)
    phone = sanitize_text(payload.phone)
    _require_unique_user(db, email, username, phone)

    family = db.get(Family, invite.family_id)
    if not family or not family.is_active:
        raise HTTPException(status_code=404, detail="The family associated with this invite no longer exists or has been deactivated.")

    # Enforce one admin per family
    if sanitize_text(invite.role) == "admin":
        from app.core.permissions import ROLE_DEFAULT_PERMISSIONS
        from sqlalchemy import func as sa_func
        admin_roles = {role for role, perms in ROLE_DEFAULT_PERMISSIONS.items() if "manage_family" in perms}
        existing_admin = (
            db.query(FamilyMember)
            .join(User, FamilyMember.user_id == User.id)
            .filter(
                FamilyMember.family_id == family.id,
                FamilyMember.is_active.is_(True),
                User.is_active.is_(True),
                (sa_func.lower(FamilyMember.role).in_(admin_roles)) | (sa_func.lower(User.family_role).in_(admin_roles)),
            )
            .first()
        )
        if existing_admin:
            raise HTTPException(
                status_code=409,
                detail="This family already has an admin. The invite role cannot be 'admin'. Ask the current admin to update the invite role.",
            )

    user = User(
        email=email,
        username=username,
        password_hash=hash_password(payload.password),
        full_name=sanitize_text(payload.fullName),
        family_role=sanitize_text(invite.role),
        phone=phone,
    )
    db.add(user)
    db.flush()
    member = FamilyMember(
        family_id=family.id,
        user_id=user.id,
        role=sanitize_text(invite.role),
        initial=sanitize_text(payload.fullName[:1].upper() or "?"),
        color_class="bg-slate-500",
        status="Active",
        permissions=invite.permissions or [],
    )
    db.add(member)
    db.flush()

    invite.used_count += 1
    invite.last_used_at = datetime.now(timezone.utc)
    if invite.used_count >= invite.max_uses:
        invite.is_active = False

    registered_device_id = _register_device(
        db,
        user,
        family.id,
        payload.deviceId,
        payload.deviceName,
        payload.deviceType,
        payload.platform,
        user_agent,
        ip_address,
    )
    tokens = _issue_tokens(user, member, {"device_id": registered_device_id})
    _record_session(db, user, family.id, registered_device_id, tokens, user_agent, ip_address)
    write_audit_log(
        db,
        user_id=user.id,
        family_id=family.id,
        action="signup_invite_accepted",
        entity_type="family_member",
        entity_id=member.user_id,
        changes={"invite_id": invite.id, "username": user.username, "role": member.role, "device_id": registered_device_id},
    )
    from app.services.verification_service import issue_otp
    issue_otp(db, user)
    db.commit()
    invalidate_entity("members", family.id)
    invalidate_entity("family", family.id)
    return tokens


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
    device_type: str | None = None,
    platform: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> dict[str, str]:
    user = db.query(User).filter((User.username == username) | (User.email == username)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="No active account found for that username or email.")
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")

    from app.services.verification_service import require_verified_or_resend
    require_verified_or_resend(db, user)

    membership = _select_membership(db, user, family_id)
    registered_device_id = _register_device(
        db,
        user,
        membership.family_id,
        device_id,
        device_name,
        device_type,
        platform,
        user_agent,
        ip_address,
    )
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
