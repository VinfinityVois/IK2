from datetime import date, datetime
from zoneinfo import ZoneInfo
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.core.database import Base


class PaymentOccurrence(Base):
    __tablename__ = "payment_occurrences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    recurring_payment_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("recurring_payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reminder_sent: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    recurring_payment: Mapped["RecurringPayment"] = relationship(
        "RecurringPayment",
        back_populates="occurrences",
    )

    @property
    def is_overdue(self) -> bool:
        today = datetime.now(ZoneInfo(settings.TIMEZONE)).date()

        if self.is_paid:
            return self.paid_at is not None and self.paid_at > self.due_date

        return today > self.due_date
