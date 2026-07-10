from datetime import UTC, datetime, timedelta

from app.core.database import SessionLocal
from app.models import Task
from app.services.notification_service import create_notification
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.notification_tasks.scan_due_reminders")
def scan_due_reminders() -> dict[str, int]:
    db = SessionLocal()
    try:
        now = datetime.now(UTC).replace(tzinfo=None)
        soon = now + timedelta(minutes=15)
        tasks = (
            db.query(Task)
            .filter(Task.status.in_(["pending", "in_progress"]), Task.reminder_date >= now, Task.reminder_date <= soon)
            .all()
        )
        for task in tasks:
            create_notification(
                db,
                user_id=task.assigned_to or task.created_by or 1,
                family_id=task.family_id,
                title=f"Reminder: {task.title}",
                message=task.description or "A family reminder is due soon.",
                type_="task",
            )
        db.commit()
        return {"notifications": len(tasks)}
    finally:
        db.close()
