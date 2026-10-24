"""Тестовые данные: аренда RUB, сервер USD, подписка EUR."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.services.periods import next_monthly_date


async def seed_demo_payments(db: AsyncSession) -> None:
    result = await db.execute(select(RecurringPayment).limit(1))
    if result.scalar_one_or_none():
        return  # уже есть данные

    today = date.today()
    # Один платёж скоро (через 2 дня) — чтобы сработало напоминание
    soon = today + timedelta(days=2)
    # Один уже «просроченный» период для демо
    past = today - timedelta(days=5)

    demos = [
        {
            "name": "Аренда офиса",
            "amount": Decimal("85000.00"),
            "currency": "RUB",
            "next_due_date": soon,
            "description": "Ежемесячная аренда",
            "extra_past": past,
        },
        {
            "name": "VPS сервер",
            "amount": Decimal("12.00"),
            "currency": "USD",
            "next_due_date": today + timedelta(days=10),
            "description": "Hetzner / Timeweb",
            "extra_past": None,
        },
        {
            "name": "Подписка Figma",
            "amount": Decimal("15.00"),
            "currency": "EUR",
            "next_due_date": today + timedelta(days=20),
            "description": "Team plan",
            "extra_past": None,
        },
    ]

    for d in demos:
        rp = RecurringPayment(
            name=d["name"],
            amount=d["amount"],
            currency=d["currency"],
            next_due_date=d["next_due_date"],
            periodicity="monthly",
            description=d["description"],
            is_active=True,
        )
        db.add(rp)
        await db.flush()

        # Текущий период
        db.add(
            PaymentOccurrence(
                recurring_payment_id=rp.id,
                due_date=d["next_due_date"],
                is_paid=False,
                reminder_sent=False,
            )
        )

        # Прошлый период (для истории / просрочки)
        if d["extra_past"]:
            db.add(
                PaymentOccurrence(
                    recurring_payment_id=rp.id,
                    due_date=d["extra_past"],
                    is_paid=False,
                    reminder_sent=True,
                )
            )

    await db.commit()
    print("[Seed] Demo payments created (RUB / USD / EUR)")
