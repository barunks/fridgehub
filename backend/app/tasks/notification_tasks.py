from datetime import UTC, datetime, timedelta

from app.core.database import SessionLocal
from app.models import FamilyMember, Task
from app.services.family_service import invalidate_entity
from app.services.notification_service import create_notification
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.notification_tasks.scan_due_reminders")
def scan_due_reminders() -> dict[str, int]:
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        soon = now + timedelta(minutes=15)
        # Compare using timezone-aware datetimes; for naive DB columns, strip tz at query level
        now_naive = now.replace(tzinfo=None)
        soon_naive = soon.replace(tzinfo=None)
        tasks = (
            db.query(Task)
            .filter(
                Task.is_active.is_(True),
                Task.status.in_(["pending", "in_progress"]),
                Task.reminder_date.is_not(None),
                Task.reminder_date >= now_naive,
                Task.reminder_date <= soon_naive,
            )
            .all()
        )
        family_ids: set[int] = set()
        notification_count = 0
        for task in tasks:
            recipient = task.assigned_to or task.created_by
            if not recipient:
                continue
            membership = db.query(FamilyMember).filter_by(family_id=task.family_id, user_id=recipient, is_active=True).first()
            if not membership:
                continue
            create_notification(
                db,
                user_id=recipient,
                family_id=task.family_id,
                title=f"Reminder: {task.title}",
                message=task.description or "A family reminder is due soon.",
                type_="task",
            )
            family_ids.add(task.family_id)
            notification_count += 1
        db.commit()
        for family_id in family_ids:
            invalidate_entity("notifications", family_id)
        return {"notifications": notification_count}
    finally:
        db.close()
