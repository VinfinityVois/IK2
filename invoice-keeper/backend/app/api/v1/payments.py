from collections import defaultdict
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.schemas.summary import CurrencySummary, PaymentsSummary

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/summary", response_model=PaymentsSummary)
async def get_payments_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Возвращает сводку только по платежам текущего пользователя.

    Администратор может просматривать сводку по всем владельцам.
    """
    query = (
        select(PaymentOccurrence)
        .join(
            RecurringPayment,
            PaymentOccurrence.recurring_payment_id == RecurringPayment.id,
        )
        .options(selectinload(PaymentOccurrence.recurring_payment))
    )

    result = await db.execute(query)
    occurrences = result.scalars().all()

    stats: dict[str, dict] = defaultdict(
        lambda: {
            "total": Decimal("0"),
            "paid": Decimal("0"),
            "unpaid": Decimal("0"),
            "overdue": Decimal("0"),
            "count_total": 0,
            "count_paid": 0,
            "count_unpaid": 0,
            "count_overdue": 0,
        }
    )

    for occurrence in occurrences:
        payment = occurrence.recurring_payment
        if payment is None:
            continue

        currency = payment.currency
        amount = payment.amount
        bucket = stats[currency]
        bucket["total"] += amount
        bucket["count_total"] += 1

        if occurrence.is_paid:
            bucket["paid"] += amount
            bucket["count_paid"] += 1
        else:
            bucket["unpaid"] += amount
            bucket["count_unpaid"] += 1
            if occurrence.is_overdue:
                bucket["overdue"] += amount
                bucket["count_overdue"] += 1

    by_currency = [
        CurrencySummary(
            currency=currency,
            total_amount=data["total"],
            paid_amount=data["paid"],
            unpaid_amount=data["unpaid"],
            overdue_amount=data["overdue"],
            count_total=data["count_total"],
            count_paid=data["count_paid"],
            count_unpaid=data["count_unpaid"],
            count_overdue=data["count_overdue"],
        )
        for currency, data in sorted(stats.items())
    ]
    return PaymentsSummary(by_currency=by_currency)