from typing import Any

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
) -> None:
    db.add(
        AuditLog(
            user_id=user_id,
            family_id=family_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            changes=_json_safe(changes or {}),
        )
    )
