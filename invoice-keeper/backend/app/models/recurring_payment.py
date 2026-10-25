
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RecurringPayment(Base):
    __tablename__ = "recurring_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    next_due_date: Mapped[date] = mapped_column(Date, nullable=False)
    periodicity: Mapped[str] = mapped_column(
        String(16),
        default="monthly",
        nullable=False,
    )

    original_day: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        onupdate=func.now(),
        nullable=True,
    )

    occurrences = relationship(
        "PaymentOccurrence",
        back_populates="recurring_payment",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<RecurringPayment "
            f"{self.name} {self.amount} {self.currency}>"
        )
