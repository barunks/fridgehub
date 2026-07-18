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
        logger.info("EMAIL (stub) to=%s subject=%s", to, subject)
        return True
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
        logger.info("Email sent to=%s subject=%s", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to=%s", to)
        return False


# ---------------------------------------------------------------------------
# SMS delivery
# ---------------------------------------------------------------------------

def send_sms(to: str, body: str) -> bool:
    if not settings.sms_enabled:
        logger.info("SMS (stub) to=%s body=%s", to, body)
        return True
    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(to=to, from_=settings.twilio_from_number, body=body)
        logger.info("SMS sent to=%s", to)
        return True
    except Exception:
        logger.exception("Failed to send SMS to=%s", to)
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
    body = f"Your FridgeHub {purpose} code is {otp}. Valid for 10 minutes. Do not share this code."
    return send_sms(to, body)
