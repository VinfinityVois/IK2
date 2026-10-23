from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class RecurringPaymentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: Literal["RUB", "USD", "EUR"]
    next_due_date: date
    periodicity: Literal["monthly"] = "monthly"
    description: Optional[str] = None


class RecurringPaymentOut(BaseModel):
    id: int
    name: str
    amount: Decimal
    currency: str
    next_due_date: date
    periodicity: str
    is_active: bool
    description: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RecurringPaymentList(BaseModel):
    items: list[RecurringPaymentOut]
    total: int