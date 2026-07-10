import os

from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "familyhub",
    broker=os.getenv("CELERY_BROKER_URL", os.getenv("REDIS_URL", "redis://localhost:6379/1")),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/2"),
    include=["app.tasks.grocery_scheduler", "app.tasks.notification_tasks"],
)

celery_app.conf.timezone = "Asia/Singapore"
celery_app.conf.beat_schedule = {
    "regenerate-grocery-cycles-every-night": {
        "task": "app.tasks.grocery_scheduler.regenerate_all_family_cycles",
        "schedule": crontab(hour=2, minute=0),
    },
    "scan-reminders-every-15-minutes": {
        "task": "app.tasks.notification_tasks.scan_due_reminders",
        "schedule": crontab(minute="*/15"),
    },
}
