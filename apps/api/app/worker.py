from celery import Celery
from celery.schedules import crontab

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "reputation",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    broker_connection_retry_on_startup=True,
    # ── Celery Beat — periodic tasks ──────────────────────────────────────────
    beat_schedule={
        # Check every day at 07:00 UTC which brands are due for an auto-run
        "scheduled-brand-runs": {
            "task": "reputation.run_scheduled_brands",
            "schedule": crontab(minute=0, hour=7),
        },
        # Send alert digest emails every day at 08:00 UTC (after runs complete)
        "daily-alert-emails": {
            "task": "reputation.send_daily_alert_emails",
            "schedule": crontab(minute=0, hour=8),
        },
    },
)
