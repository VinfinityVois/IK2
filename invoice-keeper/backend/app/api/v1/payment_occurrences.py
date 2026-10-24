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
from app.services.periods import create_next_period_after_payment

router = APIRouter(prefix="/payment-occurrences", tags=["payment-occurrences"])


def _to_out(occurrence: PaymentOccurrence) -> PaymentOccurrenceOut:
    payment = occurrence.recurring_payment
    return PaymentOccurrenceOut(
        id=occurrence.id,
        recurring_payment_id=occurrence.recurring_payment_id,
        due_date=occurrence.due_date,
        is_paid=occurrence.is_paid,
        paid_at=occurrence.paid_at,
        is_overdue=occurrence.is_overdue,
        reminder_sent=occurrence.reminder_sent,
        name=payment.name if payment else None,
        amount=payment.amount if payment else None,
        currency=payment.currency if payment else None,
    )


def _ensure_owner(occurrence: PaymentOccurrence, user: User) -> None:
    payment = occurrence.recurring_payment
    if user.role != "admin" and (
        payment is None or payment.owner_id != user.id
    ):
        # Не раскрываем, существует ли чужая запись.
        raise HTTPException(status_code=404, detail="Payment occurrence not found")


@router.get("", response_model=PaymentOccurrenceList)
async def list_payment_occurrences(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    is_paid: Optional[bool] = Query(None),
    is_overdue: Optional[bool] = Query(None),
    recurring_payment_id: Optional[int] = Query(None),
):
    query = (
        select(PaymentOccurrence)
        .join(RecurringPayment)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .order_by(PaymentOccurrence.due_date.desc())
    )
    if current_user.role != "admin":
        query = query.where(RecurringPayment.owner_id == current_user.id)
    if recurring_payment_id is not None:
        query = query.where(
            PaymentOccurrence.recurring_payment_id == recurring_payment_id
        )
    if is_paid is not None:
        query = query.where(PaymentOccurrence.is_paid.is_(is_paid))

    result = await db.execute(query)
    items = result.scalars().all()
    if is_overdue is not None:
        items = [item for item in items if item.is_overdue == is_overdue]

    return PaymentOccurrenceList(
        items=[_to_out(item) for item in items],
        total=len(items),
    )


@router.get("/{occurrence_id}", response_model=PaymentOccurrenceOut)
async def get_payment_occurrence(
    occurrence_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(PaymentOccurrence.id == occurrence_id)
    )
    occurrence = result.scalar_one_or_none()
    if occurrence is None:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    _ensure_owner(occurrence, current_user)
    return _to_out(occurrence)


@router.patch("/{occurrence_id}", response_model=PaymentOccurrenceOut)
async def update_payment_occurrence(
    occurrence_id: int,
    data: PaymentOccurrenceUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    """Изменение статуса оплаты только владельцем платежа или администратором."""
    result = await db.execute(
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(PaymentOccurrence.id == occurrence_id)
    )
    occurrence = result.scalar_one_or_none()
    if occurrence is None:
        raise HTTPException(status_code=404, detail="Payment occurrence not found")
    _ensure_owner(occurrence, current_user)

    just_paid = False
    if data.is_paid is not None:
        just_paid = data.is_paid and not occurrence.is_paid
        occurrence.is_paid = data.is_paid
        occurrence.paid_at = (data.paid_at or date.today()) if data.is_paid else None

    if data.paid_at is not None and occurrence.is_paid:
        occurrence.paid_at = data.paid_at

    await db.commit()
    await db.refresh(occurrence)

    if just_paid:
        await create_next_period_after_payment(db, occurrence)
        await db.refresh(occurrence)

    return _to_out(occurrence)
