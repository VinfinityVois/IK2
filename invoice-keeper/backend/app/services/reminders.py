"""Проверка сроков и отправка напоминаний в Telegram."""
from datetime import date, timedelta
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment


async def send_telegram_message(text: str) -> bool:
    """Отправка сообщения в чат из .env. Возвращает True при успехе."""
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id or token.startswith("123456"):
        print(f"[Telegram] Skip (no token/chat): {text[:80]}...")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "HTML",
                },
            )
            if resp.status_code == 200:
                return True
            print(f"[Telegram] Error {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"[Telegram] Exception: {e}")
        return False


def format_reminder(occ: PaymentOccurrence, rp: RecurringPayment) -> str:
    return (
        f"🔔 <b>Напоминание о платеже</b>\n\n"
        f"<b>{rp.name}</b>\n"
        f"Сумма: <code>{rp.amount} {rp.currency}</code>\n"
        f"Срок оплаты: <b>{occ.due_date.isoformat()}</b>\n\n"
        f"Invoice Keeper · Личное дело"
    )


async def process_reminders(db: AsyncSession) -> int:
    """
    Находит неоплаченные occurrence, у которых:
    - due_date - today <= REMINDER_DAYS_BEFORE (и due_date >= today)
      ИЛИ due_date уже сегодня/скоро и reminder ещё не отправляли
    - reminder_sent == False
    Отправляет в Telegram и ставит reminder_sent = True.
    """
    today = date.today()
    days = settings.REMINDER_DAYS_BEFORE
    # Напоминаем, если до срока осталось от 0 до N дней (включительно)
    # или если добавили платёж позже чем за N дней — тоже сразу
    threshold = today + timedelta(days=days)

    result = await db.execute(
        select(PaymentOccurrence)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(
            PaymentOccurrence.is_paid == False,  # noqa: E712
            PaymentOccurrence.reminder_sent == False,  # noqa: E712
            PaymentOccurrence.due_date <= threshold,
        )
    )
    occurrences = result.scalars().all()
    sent = 0

    for occ in occurrences:
        rp = occ.recurring_payment
        if not rp or not rp.is_active:
            continue

        text = format_reminder(occ, rp)
        ok = await send_telegram_message(text)
        # В демо без токена тоже помечаем, чтобы не дублировать в логах
        token = settings.TELEGRAM_BOT_TOKEN
        demo_mode = not token or token.startswith("123456")
        if ok or demo_mode:
            occ.reminder_sent = True
            sent += 1
            print(f"[Reminder] {rp.name} due {occ.due_date} (sent={ok})")

    if sent:
        await db.commit()
    return sent
