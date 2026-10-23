from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentOccurrence(Base):
    __tablename__ = "payment_occurrences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    recurring_payment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("recurring_payments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    paid_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )

    recurring_payment = relationship("RecurringPayment", back_populates="occurrences")

    @property
    def is_overdue(self) -> bool:
        """Просрочка со следующего дня после срока. Оплата в день срока — вовремя."""
        if self.is_paid:
            return False
        return date.today() > self.due_date

    def __repr__(self) -> str:
        status = "paid" if self.is_paid else ("overdue" if self.is_overdue else "pending")
        return f"<PaymentOccurrence {self.id} due={self.due_date} {status}>"
