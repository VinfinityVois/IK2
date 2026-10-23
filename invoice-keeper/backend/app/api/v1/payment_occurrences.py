from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.schemas.payment_occurrence import (
    PaymentOccurrenceList,
    PaymentOccurrenceOut,
    PaymentOccurrenceUpdate,
)

router = APIRouter(prefix="/payment-occurrences", tags=["payment-occurrences"])


def _to_out(occ: PaymentOccurrence) -> PaymentOccurrenceOut:
    return PaymentOccurrenceOut(
        id=occ.id,
        recurring_payment_id=occ.recurring_payment_id,
        due_date=occ.due_date,
        is_paid=occ.is_paid,
        paid_at=occ.paid_at,
        is_overdue=occ.is_overdue,
        reminder_sent=occ.reminder_sent,
        name=occ.recurring_payment.name if occ.recurring_payment else None,
        amount=occ.recurring_payment.amount if occ.recurring_payment else None,
        currency=occ.recurring_payment.currency if occ.recurring_payment else None,
    )


@router.get("", response_model=PaymentOccurrenceList)
async def list_payment_occurrences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    is_paid: Optional[bool] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    recurring_payment_id: Optional[int] = Query(None),
):
    """Список платежей (оплаченные, просроченные и т.д.)."""
    query = (
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .order_by(PaymentOccurrence.due_date.desc())
    )

    if recurring_payment_id is not None:
        query = query.where(PaymentOccurrence.recurring_payment_id == recurring_payment_id)

    result = await db.execute(query)
    items = result.scalars().all()

    # Фильтры после загрузки (is_overdue — вычисляемое)
    if is_paid is not None:
        items = [i for i in items if i.is_paid == is_paid]
    if is_overdue is not None:
        items = [i for i in items if i.is_overdue == is_overdue]

    return PaymentOccurrenceList(
        items=[_to_out(i) for i in items],
        total=len(items),
    )


@router.get("/{occurrence_id}", response_model=PaymentOccurrenceOut)
async def get_payment_occurrence(
    occurrence_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Получение конкретного платежа."""
    result = await db.execute(
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(PaymentOccurrence.id == occurrence_id)
    )
    occ = result.scalar_one_or_none()
    if not occ:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    return _to_out(occ)


@router.patch("/{occurrence_id}", response_model=PaymentOccurrenceOut)
async def update_payment_occurrence(
    occurrence_id: int,
    data: PaymentOccurrenceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Подтверждение или отмена оплаты, исправление фактической даты оплаты.
    При отмене отметки дата очищается.
    """
    result = await db.execute(
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(PaymentOccurrence.id == occurrence_id)
    )
    occ = result.scalar_one_or_none()
    if not occ:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")

    if data.is_paid is not None:
        occ.is_paid = data.is_paid
        if data.is_paid:
            # Если оплатили и дату не передали — ставим сегодня
            occ.paid_at = data.paid_at or date.today()
        else:
            # Отмена оплаты — очищаем дату
            occ.paid_at = None

    if data.paid_at is not None and occ.is_paid:
        occ.paid_at = data.paid_at

    await db.commit()
    await db.refresh(occ)
    return _to_out(occ)
