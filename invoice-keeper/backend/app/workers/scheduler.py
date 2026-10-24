"""Фоновый планировщик: периоды + напоминания."""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.database import AsyncSessionLocal
from app.services.periods import ensure_current_and_next_occurrences
from app.services.reminders import process_reminders

scheduler = AsyncIOScheduler()


async def job_periods_and_reminders():
    async with AsyncSessionLocal() as db:
        created = await ensure_current_and_next_occurrences(db)
        if created:
            print(f"[Scheduler] Created {created} occurrence(s)")
        sent = await process_reminders(db)
        if sent:
            print(f"[Scheduler] Sent {sent} reminder(s)")


def start_scheduler():
    if scheduler.running:
        return
    # Каждые 5 минут (для демо можно 1 мин)
    scheduler.add_job(
        job_periods_and_reminders,
        trigger=IntervalTrigger(minutes=5),
        id="periods_reminders",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    print("[Scheduler] Started (every 5 min)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[Scheduler] Stopped")
