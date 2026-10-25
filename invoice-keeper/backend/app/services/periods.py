"""Логика периодов: следующий месяц, последний день месяца + сохранение исходного дня."""
from calendar import monthrange
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment


def get_today() -> date:
    """Сегодня в едином часовом поясе из .env (TIMEZONE)."""
    return datetime.now(ZoneInfo(settings.TIMEZONE)).date()


def next_monthly_date(from_date: date, original_day: int | None = None) -> date:
    """
    Следующий месяц.
    original_day — день, который был при создании платежа (например 31).
    Если в следующем месяце такого дня нет → последний день месяца.
    Пример: 31 янв → 28/29 фев → 31 мар.
    """
    year = from_date.year
    month = from_date.month + 1
    if month > 12:
        month = 1
        year += 1

    day = original_day if original_day is not None else from_date.day
    last_day = monthrange(year, month)[1]
    day = min(day, last_day)
    return date(year, month, day)


async def create_next_period_after_payment(
    db: AsyncSession, occurrence: PaymentOccurrence
) -> PaymentOccurrence | None:
    result = await db.execute(
        select(RecurringPayment)
        .where(RecurringPayment.id == occurrence.recurring_payment_id)
        .options(selectinload(RecurringPayment.occurrences))
    )
    rp = result.scalar_one_or_none()
    if not rp or not rp.is_active:
        return None

    original_day = getattr(rp, "original_day", None) or occurrence.due_date.day
    candidate = next_monthly_date(occurrence.due_date, original_day)

    if rp.next_due_date > candidate:
        candidate = rp.next_due_date

    existing = {o.due_date for o in rp.occurrences}
    if candidate in existing:
        if rp.next_due_date <= occurrence.due_date:
            rp.next_due_date = candidate
        return None

    new_occ = PaymentOccurrence(
        recurring_payment_id=rp.id,
        due_date=candidate,
        is_paid=False,
        reminder_sent=False,
    )
    db.add(new_occ)
    rp.next_due_date = candidate
    await db.flush()
    return new_occ


async def ensure_current_and_next_occurrences(db: AsyncSession) -> int:
    result = await db.execute(
        select(RecurringPayment)
        .where(RecurringPayment.is_active == True)  # noqa: E712
        .options(selectinload(RecurringPayment.occurrences))
    )
    payments = result.scalars().all()
    created = 0
    today = get_today()

    for rp in payments:
        existing_dates = {occ.due_date for occ in rp.occurrences}
        original_day = getattr(rp, "original_day", None) or rp.next_due_date.day

        while rp.next_due_date < today:
            if rp.next_due_date not in existing_dates:
                db.add(
                    PaymentOccurrence(
                        recurring_payment_id=rp.id,
                        due_date=rp.next_due_date,
                        is_paid=False,
                        reminder_sent=False,
                    )
                )
                created += 1
                existing_dates.add(rp.next_due_date)
            rp.next_due_date = next_monthly_date(rp.next_due_date, original_day)

        if rp.next_due_date not in existing_dates:
            db.add(
                PaymentOccurrence(
                    recurring_payment_id=rp.id,
                    due_date=rp.next_due_date,
                    is_paid=False,
                    reminder_sent=False,
                )
            )
            created += 1

    if created:
        await db.commit()
    return created