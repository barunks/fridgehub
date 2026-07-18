"""OTP-based email + phone verification service.

Flow
----
1. After signup (bootstrap or invite), call ``issue_otp(db, user)`` which:
   - generates two independent 6-digit OTPs
   - stores their SHA-256 hashes in ``verification_otps``
   - sends the email OTP via SMTP and the phone OTP via Twilio (or logs to
     console when credentials are absent)
   - returns the user id so the caller can pass it to the frontend

2. The frontend calls ``POST /api/v1/auth/verify`` with
   ``{userId, emailOtp, phoneOtp}``.  ``verify_otp()`` checks both codes,
   marks ``user.email_verified`` and ``user.phone_verified``, and invalidates
   the OTP row.

3. On every login attempt for an unverified user, ``require_verified_or_resend``
   re-issues a fresh OTP pair and raises HTTP 403 with a structured body so the
   frontend knows to show the verification screen.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import User, VerificationOtp
from app.services.notification_service import send_otp_email, send_otp_sms

_OTP_TTL_MINUTES = 10
_MAX_ATTEMPTS = 5


def _has_phone(user: User) -> bool:
    return bool(user.phone and user.phone.strip())


def verification_status(user: User) -> dict[str, object]:
    has_phone = _has_phone(user)
    phone_verified = bool(user.phone_verified) if has_phone else True
    email_verified = bool(user.email_verified)
    return {
        "userId": user.id,
        "emailVerified": email_verified,
        "phoneVerified": phone_verified,
        "verified": email_verified and phone_verified,
        "email": user.email,
        "phone": user.phone if has_phone else None,
    }


def _pending_channels(user: User) -> list[str]:
    channels = []
    if not user.email_verified:
        channels.append("email")
    if _has_phone(user) and not user.phone_verified:
        channels.append("phone")
    return channels


def _six_digit_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _invalidate_existing(db: Session, user_id: int) -> None:
    """Mark any active OTP rows for this user as used so only the latest is valid."""
    db.query(VerificationOtp).filter(
        VerificationOtp.entity_type == "user",
        VerificationOtp.entity_id == user_id,
        VerificationOtp.is_used.is_(False),
    ).update({"is_used": True}, synchronize_session=False)


def issue_otp(db: Session, user: User) -> int:
    """Generate, store, and dispatch a fresh OTP pair for *user*.

    Returns the user id (convenience for callers that need to pass it to the
    frontend response).
    """
    email_otp = _six_digit_otp()
    phone_otp = _six_digit_otp() if _has_phone(user) else None

    _invalidate_existing(db, user.id)

    otp_row = VerificationOtp(
        entity_type="user",
        entity_id=user.id,
        email_otp_hash=_hash_otp(email_otp),
        phone_otp_hash=_hash_otp(phone_otp) if phone_otp else None,
        email_target=user.email,
        phone_target=user.phone if _has_phone(user) else None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=_OTP_TTL_MINUTES),
    )
    db.add(otp_row)
    db.flush()

    send_otp_email(user.email, email_otp)
    if phone_otp and user.phone:
        if not send_otp_sms(user.phone, phone_otp):
            raise HTTPException(
                status_code=502,
                detail="Could not send SMS verification code. Check Twilio configuration and the recipient phone number.",
            )

    return user.id


def verify_otp(db: Session, user_id: int, email_otp: str, phone_otp: str) -> dict:
    """Validate both OTP codes and mark the user as verified.

    Raises HTTP 400 on wrong codes, expired OTP, or exceeded attempts.
    Returns a ``VerificationStatusOut``-compatible dict on success.
    """
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found.")

    if verification_status(user)["verified"]:
        return verification_status(user)

    now = datetime.now(timezone.utc)
    row = (
        db.query(VerificationOtp)
        .filter(
            VerificationOtp.entity_type == "user",
            VerificationOtp.entity_id == user_id,
            VerificationOtp.is_used.is_(False),
        )
        .order_by(VerificationOtp.created_at.desc())
        .first()
    )

    if not row:
        raise HTTPException(status_code=400, detail="No active verification code found. Please request a new one.")

    expires_at = row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new one.")

    if row.attempts >= _MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new verification code.")

    email_ok = _hash_otp(email_otp.strip()) == row.email_otp_hash
    # Phone OTP is optional — skip check when user has no phone number
    phone_ok = row.phone_otp_hash is None or _hash_otp(phone_otp.strip()) == row.phone_otp_hash

    if not email_ok or not phone_ok:
        row.attempts += 1
        db.flush()
        wrong = []
        if not email_ok:
            wrong.append("email")
        if not phone_ok:
            wrong.append("phone")
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect {' and '.join(wrong)} verification code{'s' if len(wrong) > 1 else ''}. Please try again.",
        )

    # Both correct — mark verified
    user.email_verified = True
    user.phone_verified = True
    row.is_used = True
    db.flush()

    return verification_status(user)


def require_verified_or_resend(db: Session, user: User) -> None:
    """Called during login. If the user is not fully verified, re-issue OTPs
    and raise HTTP 403 so the frontend redirects to the verification screen.
    """
    status = verification_status(user)
    if status["verified"]:
        return

    issue_otp(db, user)
    channels = _pending_channels(user)
    channel_text = " and ".join(channels) if channels else "account"
    raise HTTPException(
        status_code=403,
        detail={
            "message": f"Account not verified. A new verification code has been sent to your {channel_text}. Please verify to continue.",
            "code": "account_unverified",
            **status,
        },
    )
