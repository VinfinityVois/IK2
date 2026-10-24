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
from app.models.user import User
from app.schemas.summary import CurrencySummary, PaymentsSummary

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/summary", response_model=PaymentsSummary)
async def get_payments_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Итоговые суммы платежей по валютам."""
    result = await db.execute(
        select(PaymentOccurrence).options(selectinload(PaymentOccurrence.recurring_payment))
    )
    occurrences = result.scalars().all()

    query = db.query(PaymentOccurrence).join(
        RecurringPayment,
        PaymentOccurrence.recurring_payment_id == RecurringPayment.id,
    )

    if not current_user_is_admin:
        query = query.filter(
            RecurringPayment.owner_id == current_user.id
        )

    # Группируем по валюте
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

    for occ in occurrences:
        if not occ.recurring_payment:
            continue
        cur = occ.recurring_payment.currency
        amount = occ.recurring_payment.amount

        stats[cur]["total"] += amount
        stats[cur]["count_total"] += 1

        if occ.is_paid:
            stats[cur]["paid"] += amount
            stats[cur]["count_paid"] += 1
        else:
            stats[cur]["unpaid"] += amount
            stats[cur]["count_unpaid"] += 1
            if occ.is_overdue:
                stats[cur]["overdue"] += amount
                stats[cur]["count_overdue"] += 1

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
