from calendar import monthrange
from datetime import UTC, datetime, timedelta

from app.core.database import SessionLocal
from app.models import FamilyMember, Task
from app.services.family_service import invalidate_entity
from app.services.notification_service import create_notification
from app.tasks.celery_app import celery_app


def _add_months(value: datetime, months: int) -> datetime:
    total_month = value.month - 1 + months
    year = value.year + total_month // 12
    month = total_month % 12 + 1
    day = min(value.day, monthrange(year, month)[1])
    return value.replace(year=year, month=month, day=day)


def _next_stepped_day_occurrence(anchor: datetime, step_days: int, window_start: datetime) -> datetime:
    if anchor >= window_start:
        return anchor
    step = timedelta(days=max(1, step_days))
    elapsed_steps = max(0, int((window_start - anchor).total_seconds() // step.total_seconds()))
    occurrence = anchor + step * elapsed_steps
    while occurrence < window_start:
        occurrence += step
    return occurrence


def _next_stepped_month_occurrence(anchor: datetime, step_months: int, window_start: datetime) -> datetime:
    if anchor >= window_start:
        return anchor
    step = max(1, step_months)
    rough_months = (window_start.year - anchor.year) * 12 + (window_start.month - anchor.month)
    offset = max(0, rough_months // step * step)
    occurrence = _add_months(anchor, offset)
    while occurrence < window_start:
        offset += step
        occurrence = _add_months(anchor, offset)
    return occurrence


def _reminder_occurs_in_window(task: Task, window_start: datetime, window_end: datetime) -> bool:
    anchor = task.reminder_date or task.due_date
    if not anchor:
        return False
    recurrence_type = task.recurrence_type or "none"
    interval = max(1, task.recurrence_interval or 1)

    if recurrence_type == "none":
        return window_start <= anchor <= window_end
    if task.recurrence_end_date and task.recurrence_end_date < window_start:
        return False

    if recurrence_type == "daily":
        occurrence = _next_stepped_day_occurrence(anchor, interval, window_start)
    elif recurrence_type == "weekly":
        occurrence = _next_stepped_day_occurrence(anchor, interval * 7, window_start)
    elif recurrence_type == "monthly":
        occurrence = _next_stepped_month_occurrence(anchor, interval, window_start)
    elif recurrence_type == "quarterly":
        occurrence = _next_stepped_month_occurrence(anchor, interval * 3, window_start)
    elif recurrence_type == "semi_annually":
        occurrence = _next_stepped_month_occurrence(anchor, interval * 6, window_start)
    elif recurrence_type == "yearly":
        occurrence = _next_stepped_month_occurrence(anchor, interval * 12, window_start)
    else:
        return False

    if task.recurrence_end_date and occurrence > task.recurrence_end_date:
        return False
    return window_start <= occurrence <= window_end


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
                Task.due_date.is_not(None),
            )
            .all()
        )
        family_ids: set[int] = set()
        notification_count = 0
        for task in tasks:
            if not _reminder_occurs_in_window(task, now_naive, soon_naive):
                continue
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
