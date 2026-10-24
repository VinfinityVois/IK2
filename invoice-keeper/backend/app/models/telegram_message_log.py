from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TelegramMessageLog(Base):
    __tablename__ = "telegram_message_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    payment_occurrence_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("payment_occurrences.id", ondelete="SET NULL"), nullable=True, index=True)
    message_type: Mapped[str] = mapped_column(String(32), nullable=False, default="info")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="sent")
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    telegram_message_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
