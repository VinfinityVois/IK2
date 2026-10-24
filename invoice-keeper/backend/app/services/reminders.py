"""Персональные напоминания в Telegram с кнопкой оплаты и журналированием."""
from datetime import date, timedelta
from html import escape
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.user import User
from app.models.telegram_message_log import TelegramMessageLog

async def _send(chat_id: int, text: str, occurrence_id: int) -> tuple[bool, str | None, str | None]:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or token.startswith("123456"):
        return False, None, "TELEGRAM_BOT_TOKEN не настроен"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML",
               "reply_markup": {"inline_keyboard": [[{"text": "✅ Оплачено", "callback_data": f"pay:{occurrence_id}"}]]}}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(url, json=payload)
        data = response.json()
        if response.is_success and data.get("ok"):
            return True, str(data.get("result", {}).get("message_id", "")), None
        return False, None, str(data.get("description", f"HTTP {response.status_code}"))[:1000]
    except Exception as exc:
        return False, None, str(exc)[:1000]

async def process_reminders(db: AsyncSession) -> int:
    today = date.today()
    threshold = today + timedelta(days=max(0, settings.REMINDER_DAYS_BEFORE))
    result = await db.execute(
        select(PaymentOccurrence).options(selectinload(PaymentOccurrence.recurring_payment))
        .where(PaymentOccurrence.is_paid.is_(False), PaymentOccurrence.reminder_sent.is_(False),
               PaymentOccurrence.due_date <= threshold)
        .order_by(PaymentOccurrence.due_date)
    )

    from datetime import date, timedelta

    today = date.today()
    reminder_date = today + timedelta(days=3)

    sent = 0
    for occ in result.scalars().all():
        rp = occ.recurring_payment
        if not rp or not rp.is_active or not rp.owner_id:
            continue
        owner_result = await db.execute(select(User).where(User.id == rp.owner_id, User.is_active.is_(True)))
        owner = owner_result.scalar_one_or_none()
        if not owner or not owner.telegram_id:
            continue
        name = escape(rp.name)
        text = ("🔔 <b>Напоминание об оплате</b>\n\n"
                f"<b>{name}</b>\nСумма: <code>{rp.amount} {escape(rp.currency)}</code>\n"
                f"Срок оплаты: <b>{occ.due_date.isoformat()}</b>\n\nНажмите «Оплачено» после платежа.")
        ok, message_id, error = await _send(owner.telegram_id, text, occ.id)
        db.add(TelegramMessageLog(user_id=owner.id, payment_occurrence_id=occ.id,
                                  message_type="reminder", status="sent" if ok else "failed",
                                  message_text=text, telegram_message_id=message_id, error=error))
        if ok:
            occ.reminder_sent = True
            sent += 1
    await db.commit()
    return sent
