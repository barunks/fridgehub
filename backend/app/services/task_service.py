from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Task
from app.schemas.familyhub import TaskCreate, TaskUpdate
from app.services.audit_service import write_audit_log
from app.services.family_service import invalidate_family_cache, serialize_task
from app.services.notification_service import create_notification
from app.utils.sanitize import sanitize_optional_text, sanitize_text


def list_tasks(db: Session, family_id: int, status: str | None = None, limit: int = 50, offset: int = 0) -> list[dict]:
    query = db.query(Task).filter_by(family_id=family_id, is_active=True)
    if status:
        query = query.filter(Task.status == status)
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    return [serialize_task(task) for task in query.order_by(Task.due_date).offset(offset).limit(limit).all()]


def create_task(db: Session, payload: TaskCreate, family_id: int, user_id: int) -> dict:
    task = Task(
        title=sanitize_text(payload.title),
        description=sanitize_optional_text(payload.description) or f"{sanitize_text(payload.category)} reminder",
        priority=payload.priority,
        status="pending",
        due_date=payload.dueAt,
        reminder_date=payload.dueAt,
        recurrence_type=payload.recurrenceType,
        recurrence_interval=payload.recurrenceInterval,
        family_id=family_id,
        assigned_to=payload.assignedTo,
        created_by=user_id,
        category=sanitize_text(payload.category),
        action_label="New",
    )
    db.add(task)
    db.flush()
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="create",
        entity_type="task",
        entity_id=task.id,
        changes={"title": task.title, "assigned_to": task.assigned_to},
    )
    create_notification(
        db,
        user_id=user_id,
        family_id=family_id,
        title="Task created",
        message=f"{payload.title} is now on the family board.",
        type_="task",
    )
    db.commit()
    db.refresh(task)
    invalidate_family_cache(family_id)
    return serialize_task(task)


def update_task(db: Session, task_id: int, payload: TaskUpdate, family_id: int, user_id: int) -> dict:
    task = db.get(Task, task_id)
    if not task or task.family_id != family_id:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = payload.model_dump(exclude_unset=True)
    field_map = {
        "title": "title",
        "description": "description",
        "priority": "priority",
        "status": "status",
        "dueAt": "due_date",
        "reminderAt": "reminder_date",
        "recurrenceType": "recurrence_type",
        "recurrenceInterval": "recurrence_interval",
        "assignedTo": "assigned_to",
        "category": "category",
    }
    for api_field, model_field in field_map.items():
        if api_field in updates:
            value = updates[api_field]
            if isinstance(value, str):
                value = sanitize_text(value)
            setattr(task, model_field, value)

    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="update",
        entity_type="task",
        entity_id=task.id,
        changes=updates,
    )
    db.commit()
    db.refresh(task)
    invalidate_family_cache(family_id)
    return serialize_task(task)


def delete_task(db: Session, task_id: int, family_id: int, user_id: int) -> None:
    task = db.get(Task, task_id)
    if not task or task.family_id != family_id:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_active = False
    write_audit_log(
        db,
        user_id=user_id,
        family_id=family_id,
        action="delete",
        entity_type="task",
        entity_id=task_id,
    )
    db.commit()
    invalidate_family_cache(family_id)
