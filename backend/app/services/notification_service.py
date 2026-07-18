"""Notification service — DB notifications + email/SMS delivery."""

import logging
import smtplib
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Notification
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_entity, serialize_notification

logger = logging.getLogger(__name__)


def _mask_secret(value: str | None, visible: int = 4) -> str:
    if not value:
        return "unset"
    if len(value) <= visible * 2:
        return "***"
    return f"{value[:visible]}...{value[-visible:]}"


# ---------------------------------------------------------------------------
# DB notification helpers (existing)
# ---------------------------------------------------------------------------

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
    count = (
        db.query(Notification)
        .filter_by(user_id=user_id, family_id=family_id, is_read=False)
        .update({"is_read": True, "read_at": datetime.now(UTC)})
    )
    db.commit()
    invalidate_entity("notifications", family_id)
    return count


# ---------------------------------------------------------------------------
# Email delivery
# ---------------------------------------------------------------------------

def send_email(to: str, subject: str, html_body: str, text_body: str | None = None) -> bool:
    if not settings.email_enabled:
        logger.info("EMAIL (stub — SMTP not configured) to=%s subject=%s", to, subject)
        return True
    logger.info("EMAIL sending to=%s subject=%s smtp_host=%s", to, subject, settings.smtp_host)
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from_email
        msg["To"] = to
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, to, msg.as_string())
        logger.info("EMAIL sent OK to=%s subject=%s", to, subject)
        return True
    except Exception:
        logger.exception("EMAIL FAILED to=%s subject=%s", to, subject)
        return False


# ---------------------------------------------------------------------------
# SMS delivery
# ---------------------------------------------------------------------------

def send_sms(to: str, body: str) -> bool:
    if not settings.twilio_direct_sms_enabled:
        logger.info(
            "SMS (stub — Twilio direct messaging not configured) to=%s | "
            "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and either "
            "TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID to enable direct SMS",
            to,
        )
        return True
    logger.info(
        "SMS sending to=%s from=%s messaging_service=%s account_sid=%s",
        to,
        _mask_secret(settings.twilio_from_number),
        _mask_secret(settings.twilio_messaging_service_sid),
        _mask_secret(settings.twilio_account_sid),
    )
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        message_payload = {"to": to, "body": body}
        if settings.twilio_messaging_service_sid:
            message_payload["messaging_service_sid"] = settings.twilio_messaging_service_sid
        else:
            message_payload["from_"] = settings.twilio_from_number
        message = client.messages.create(**message_payload)
        logger.info("SMS sent OK to=%s sid=%s status=%s", to, message.sid, message.status)
        return True
    except Exception:
        logger.exception(
            "SMS FAILED to=%s from=%s messaging_service=%s account_sid=%s",
            to,
            _mask_secret(settings.twilio_from_number),
            _mask_secret(settings.twilio_messaging_service_sid),
            _mask_secret(settings.twilio_account_sid),
        )
        return False


def send_verify_sms(to: str, otp: str) -> bool:
    if not settings.twilio_verify_enabled:
        return False
    logger.info(
        "VERIFY SMS sending to=%s service_sid=%s account_sid=%s",
        to, _mask_secret(settings.twilio_verify_sid), _mask_secret(settings.twilio_account_sid),
    )
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        verification = (
            client.verify.v2
            .services(settings.twilio_verify_sid)
            .verifications
            .create(to=to, channel="sms", custom_code=otp)
        )
        logger.info(
            "VERIFY SMS sent OK to=%s verification_sid=%s status=%s",
            to, verification.sid, verification.status,
        )
        return True
    except Exception:
        logger.exception(
            "VERIFY SMS FAILED to=%s service_sid=%s account_sid=%s",
            to, _mask_secret(settings.twilio_verify_sid), _mask_secret(settings.twilio_account_sid),
        )
        return False


# ---------------------------------------------------------------------------
# Invite email
# ---------------------------------------------------------------------------

def send_invite_email(to: str, family_name: str, role: str, invite_link: str, invited_by: str) -> bool:
    subject = f"You're invited to join {family_name} on FridgeHub"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">You've been invited to FridgeHub</h2>
      <p style="color:#475569">{invited_by} has invited you to join
        <strong>{family_name}</strong> as a <strong>{role}</strong>.</p>
      <p style="margin:24px 0">
        <a href="{invite_link}"
           style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;
                  text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
      </p>
      <p style="color:#94a3b8;font-size:12px">
        This invite link is single-use and can only be used once.
        If you did not expect this invitation, you can ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px">FridgeHub — Family Command Center</p>
    </div>
    """
    text_body = (
        f"You've been invited to join {family_name} on FridgeHub as {role}.\n\n"
        f"Accept your invitation: {invite_link}\n\n"
        f"This invite link is single-use."
    )
    return send_email(to, subject, html_body, text_body)


# ---------------------------------------------------------------------------
# OTP delivery
# ---------------------------------------------------------------------------

def send_otp_email(to: str, otp: str, purpose: str = "signup") -> bool:
    subject = "Your FridgeHub verification code"
    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#1e293b">Verify your email</h2>
      <p style="color:#475569">Use the code below to complete your {purpose}. It expires in <strong>10 minutes</strong>.</p>
      <div style="margin:24px 0;text-align:center">
        <span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;
                     padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1e293b">
          {otp}
        </span>
      </div>
      <p style="color:#94a3b8;font-size:12px">
        If you did not request this code, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px">FridgeHub — Family Command Center</p>
    </div>
    """
    text_body = f"Your FridgeHub verification code is: {otp}\nIt expires in 10 minutes."
    return send_email(to, subject, html_body, text_body)


def send_otp_sms(to: str, otp: str, purpose: str = "signup") -> bool:
    if settings.twilio_verify_enabled:
        return send_verify_sms(to, otp)
    body = f"Your FridgeHub {purpose} code is {otp}. Valid for 10 minutes. Do not share this code."
    return send_sms(to, body)
