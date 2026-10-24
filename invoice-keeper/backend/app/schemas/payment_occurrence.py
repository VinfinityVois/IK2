from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class PaymentOccurrenceOut(BaseModel):
    id: int
    recurring_payment_id: int
    due_date: date
    is_paid: bool
    paid_at: Optional[date] = None
    is_overdue: bool
    reminder_sent: bool
    # Для удобства фронта
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None

    model_config = {"from_attributes": True}


class PaymentOccurrenceUpdate(BaseModel):
    is_paid: Optional[bool] = None
    paid_at: Optional[date] = None


class PaymentOccurrenceList(BaseModel):
    items: list[PaymentOccurrenceOut]
    total: int
