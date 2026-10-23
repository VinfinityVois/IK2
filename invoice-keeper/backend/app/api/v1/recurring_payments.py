from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_admin, get_current_user
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.schemas.recurring_payment import (
    RecurringPaymentCreate,
    RecurringPaymentList,
    RecurringPaymentOut,
)

router = APIRouter(prefix="/recurring-payments", tags=["recurring-payments"])


@router.get("", response_model=RecurringPaymentList)
async def list_recurring_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    active_only: bool = True,
):
    """Список регулярных платежей."""
    query = select(RecurringPayment).order_by(RecurringPayment.next_due_date)
    if active_only:
        query = query.where(RecurringPayment.is_active == True)  # noqa: E712

    result = await db.execute(query)
    items = result.scalars().all()
    return RecurringPaymentList(items=items, total=len(items))


@router.post("", response_model=RecurringPaymentOut, status_code=status.HTTP_201_CREATED)
async def create_recurring_payment(
    data: RecurringPaymentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],
):
    """Создание регулярного платежа + первый период (только админ)."""
    rp = RecurringPayment(
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        next_due_date=data.next_due_date,
        periodicity=data.periodicity,
        description=data.description,
        is_active=True,
    )
    db.add(rp)
    await db.flush()  # получаем id

    # Создаём первый occurrence
    occurrence = PaymentOccurrence(
        recurring_payment_id=rp.id,
        due_date=data.next_due_date,
        is_paid=False,
        reminder_sent=False,
    )
    db.add(occurrence)
    await db.commit()
    await db.refresh(rp)
    return rp


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_payment(
    payment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],
):
    """
    Прекращение регулярного платежа.
    История occurrences сохраняется, новые напоминания не создаются.
    """
    result = await db.execute(
        select(RecurringPayment).where(RecurringPayment.id == payment_id)
    )
    rp = result.scalar_one_or_none()
    if not rp:
        raise HTTPException(status_code=404, detail="Recurring payment not found")

    rp.is_active = False
    await db.commit()
