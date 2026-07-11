from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.models import AuditLog


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def write_audit_log(
    db: Session,
    *,
    user_id: int | None,
    family_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | str | None,
    changes: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            family_id=family_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            changes=_json_safe(changes or {}),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )


def request_audit_metadata(request: Request) -> dict[str, str | None]:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded_for.split(",", 1)[0].strip() or (request.client.host if request.client else None)
    return {
        "ip_address": ip_address,
        "user_agent": request.headers.get("user-agent"),
    }


def write_security_audit_log(
    db: Session,
    request: Request,
    *,
    action: str,
    user_id: int | None = None,
    family_id: int | None = None,
    entity_id: int | str | None = None,
    changes: dict[str, Any] | None = None,
) -> None:
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action=action,
        entity_type="auth_session",
        entity_id=entity_id,
        changes=changes,
        **request_audit_metadata(request),
    )


def list_audit_logs(
    db: Session,
    family_id: int,
    entity_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    query = db.query(AuditLog).filter_by(family_id=family_id)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    rows = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    return [
        {
            "id": row.id,
            "userId": row.user_id,
            "action": row.action,
            "entityType": row.entity_type,
            "entityId": row.entity_id,
            "changes": row.changes,
            "ipAddress": row.ip_address,
            "userAgent": row.user_agent,
            "createdAt": row.created_at,
        }
        for row in rows
    ]
