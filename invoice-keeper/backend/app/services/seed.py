"""Создание демонстрационных платежей для администратора при пустой базе."""
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User


async def seed_demo_payments(db: AsyncSession) -> None:
    """Создаёт демо-данные только при пустом списке регулярных платежей.

    Демо-платежи назначаются администратору, чтобы не оставались без владельца
    и не попадали в чужие пользовательские аккаунты.
    """
    existing = await db.execute(select(RecurringPayment.id).limit(1))
    if existing.scalar_one_or_none() is not None:
        return

    admin_result = await db.execute(
        select(User).where(User.role == "admin").order_by(User.id).limit(1)
    )
    admin = admin_result.scalar_one_or_none()
    if admin is None:
        print("[Seed] Demo payments skipped: admin user was not found")
        return

    today = date.today()
    soon = today + timedelta(days=max(1,  settings_days_before()))
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

    for item in demos:
        payment = RecurringPayment(
            owner_id=admin.id,
            name=item["name"],
            amount=item["amount"],
            currency=item["currency"],
            next_due_date=item["next_due_date"],
            periodicity="monthly",
            description=item["description"],
            is_active=True,
        )
        db.add(payment)
        await db.flush()

        db.add(
            PaymentOccurrence(
                recurring_payment_id=payment.id,
                due_date=item["next_due_date"],
                is_paid=False,
                reminder_sent=False,
            )
        )
        if item["extra_past"]:
            db.add(
                PaymentOccurrence(
                    recurring_payment_id=payment.id,
                    due_date=item["extra_past"],
                    is_paid=False,
                    reminder_sent=True,
                )
            )

    await db.commit()
    print("[Seed] Demo payments created and assigned to admin")


def settings_days_before() -> int:
    # Локальный импорт не создаёт цикл при загрузке настроек приложения.
    from app.core.config import settings

    return max(1, settings.REMINDER_DAYS_BEFORE)
