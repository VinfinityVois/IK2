"""Персональные Telegram-напоминания с кнопкой оплаты и журналированием."""
from datetime import date, timedelta
from html import escape

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.telegram_message_log import TelegramMessageLog
from app.models.user import User


async def _send(
    chat_id: int, text: str, occurrence_id: int
) -> tuple[bool, str | None, str | None]:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or token.startswith("123456"):
        return False, None, "TELEGRAM_BOT_TOKEN не настроен"

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {
            "inline_keyboard": [[{
                "text": "✅ Оплачено",
                "callback_data": f"pay:{occurrence_id}",
            }]]
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=payload)
        data = response.json()
        if response.is_success and data.get("ok"):
            message_id = data.get("result", {}).get("message_id")
            return True, str(message_id) if message_id is not None else None, None
        return False, None, str(data.get("description", f"HTTP {response.status_code}"))[:1000]
    except Exception as exc:
        return False, None, str(exc)[:1000]


async def process_reminders(db: AsyncSession) -> int:
    """Отправляет одно напоминание о неоплаченном платеже в заданном окне.

    Учитывает REMINDER_DAYS_BEFORE, не отправляет уведомления по уже
    просроченным платежам и помечает напоминание отправленным только при успехе.
    """
    today = date.today()
    threshold = today + timedelta(days=max(0, settings.REMINDER_DAYS_BEFORE))

    query = (
        select(PaymentOccurrence)
        .join(RecurringPayment)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(
            PaymentOccurrence.is_paid.is_(False),
            PaymentOccurrence.reminder_sent.is_(False),
            PaymentOccurrence.due_date >= today,
            PaymentOccurrence.due_date <= threshold,
            RecurringPayment.is_active.is_(True),
            RecurringPayment.owner_id.is_not(None),
        )
        .order_by(PaymentOccurrence.due_date)
    )
    result = await db.execute(query)
    occurrences = result.scalars().all()
    sent = 0

    for occurrence in occurrences:
        payment = occurrence.recurring_payment
        if payment is None or payment.owner_id is None:
            continue

        owner_result = await db.execute(
            select(User).where(
                User.id == payment.owner_id,
                User.is_active.is_(True),
            )
        )
        owner = owner_result.scalar_one_or_none()
        if owner is None or not owner.telegram_id:
            continue

        name = escape(payment.name)
        currency = escape(payment.currency)
        message_text = (
            "🔔 <b>Напоминание об оплате</b>\n\n"
            f"<b>{name}</b>\n"
            f"Сумма: <code>{payment.amount} {currency}</code>\n"
            f"Срок оплаты: <b>{occurrence.due_date.isoformat()}</b>\n\n"
            "Нажмите «Оплачено» после платежа."
        )
        ok, message_id, error = await _send(
            owner.telegram_id, message_text, occurrence.id
        )
        db.add(
            TelegramMessageLog(
                user_id=owner.id,
                payment_occurrence_id=occurrence.id,
                message_type="reminder",
                status="sent" if ok else "failed",
                message_text=message_text,
                telegram_message_id=message_id,
                error=error,
            )
        )
        if ok:
            occurrence.reminder_sent = True
            sent += 1

    await db.commit()
    return sent
