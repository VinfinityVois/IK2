from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_admin   # ← добавили get_current_admin
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.schemas.recurring_payment import (
    RecurringPaymentCreate,
    RecurringPaymentList,
    RecurringPaymentOut,
)
from app.services.reminders import send_reminder_for_occurrence

router = APIRouter(prefix="/recurring-payments", tags=["recurring-payments"])


# ---------- УБРАТЬ _owner_filter ----------
# def _owner_filter(...): ...


@router.get("", response_model=RecurringPaymentList)
async def list_recurring_payments(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    active_only: bool = True,
):
    """Все пользователи видят общий список платежей."""
    query = select(RecurringPayment).order_by(RecurringPayment.next_due_date)
    if active_only:
        query = query.where(RecurringPayment.is_active == True)  # noqa: E712
    # больше не фильтруем по owner_id
    result = await db.execute(query)
    items = result.scalars().all()
    return RecurringPaymentList(items=items, total=len(items))


@router.post("", response_model=RecurringPaymentOut, status_code=status.HTTP_201_CREATED)
async def create_recurring_payment(
    data: RecurringPaymentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],   # ← только админ
):
    """Создание регулярного платежа — только администратор."""
    rp = RecurringPayment(
        owner_id=current_user.id,          # или None, если не нужно
        name=data.name,
        amount=data.amount,
        currency=data.currency,
        next_due_date=data.next_due_date,
        periodicity=data.periodicity,
        description=data.description,
        is_active=True,
        # важно: сохраняем исходный день месяца (см. патч дат ниже)
        original_day=data.next_due_date.day,
    )
    db.add(rp)
    await db.flush()

    occurrence = PaymentOccurrence(
        recurring_payment_id=rp.id,
        due_date=data.next_due_date,
        is_paid=False,
        reminder_sent=False,
    )
    db.add(occurrence)
    await db.commit()
    await db.refresh(rp)
    await db.refresh(occurrence)

    occurrence.recurring_payment = rp
    try:
        await send_reminder_for_occurrence(db, occurrence, commit=True)
    except Exception as e:
        print(f"[Reminder] immediate send failed: {e}")

    return rp


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring_payment(
    payment_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],   # ← только админ
):
    result = await db.execute(
        select(RecurringPayment).where(RecurringPayment.id == payment_id)
    )
    rp = result.scalar_one_or_none()
    if not rp:
        raise HTTPException(status_code=404, detail="Recurring payment not found")

    rp.is_active = False
    await db.commit()


from pydantic import BaseModel

class BulkDeleteRequest(BaseModel):
    ids: list[int]


@router.post("/bulk-deactivate", status_code=status.HTTP_200_OK)
async def bulk_deactivate(
    data: BulkDeleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_admin)],   # ← только админ
):
    if not data.ids:
        return {"deactivated": 0}
    result = await db.execute(
        select(RecurringPayment).where(RecurringPayment.id.in_(data.ids))
    )
    items = result.scalars().all()
    n = 0
    for rp in items:
        if rp.is_active:
            rp.is_active = False
            n += 1
    await db.commit()
    return {"deactivated": n}