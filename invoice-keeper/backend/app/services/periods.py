"""Логика периодов: следующий месяц, последний день месяца."""
from calendar import monthrange
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment


def next_monthly_date(from_date: date) -> date:
    """Следующий месяц. Если дня нет (31 → 30/28) — последний день месяца."""
    year = from_date.year
    month = from_date.month + 1
    if month > 12:
        month = 1
        year += 1
    last_day = monthrange(year, month)[1]
    day = min(from_date.day, last_day)
    return date(year, month, day)


async def create_next_period_after_payment(
    db: AsyncSession, occurrence: PaymentOccurrence
) -> PaymentOccurrence | None:
    """
    После оплаты текущего периода:
    - сдвигаем next_due_date у recurring
    - создаём следующий occurrence, если его ещё нет
    """
    result = await db.execute(
        select(RecurringPayment)
        .where(RecurringPayment.id == occurrence.recurring_payment_id)
        .options(selectinload(RecurringPayment.occurrences))
    )
    rp = result.scalar_one_or_none()
    if not rp or not rp.is_active:
        return None

    # База для следующего периода — due_date оплаченного
    candidate = next_monthly_date(occurrence.due_date)

    # Если next_due_date уже дальше — используем его
    if rp.next_due_date > candidate:
        candidate = rp.next_due_date

    existing = {o.due_date for o in rp.occurrences}
    if candidate in existing:
        # уже есть — просто синхронизируем next_due_date
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
    today = date.today()

    for rp in payments:
        existing_dates = {occ.due_date for occ in rp.occurrences}

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
            rp.next_due_date = next_monthly_date(rp.next_due_date)

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
