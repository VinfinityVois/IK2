from decimal import Decimal
from pydantic import BaseModel


class CurrencySummary(BaseModel):
    currency: str
    total_amount: Decimal
    paid_amount: Decimal
    unpaid_amount: Decimal
    overdue_amount: Decimal
    count_total: int
    count_paid: int
    count_unpaid: int
    count_overdue: int


class PaymentsSummary(BaseModel):
    by_currency: list[CurrencySummary]