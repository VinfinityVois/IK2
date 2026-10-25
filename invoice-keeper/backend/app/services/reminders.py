"""Проверка сроков и отправка напоминаний в Telegram."""
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment


def get_today() -> date:
    """Сегодня в едином часовом поясе из .env (TIMEZONE)."""
    return datetime.now(ZoneInfo(settings.TIMEZONE)).date()


async def send_telegram_message(text: str) -> bool:
    """Отправка сообщения в чат из .env. Возвращает True при успехе."""
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id or str(token).startswith("123456"):
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


def _needs_reminder(occ: PaymentOccurrence, today: date | None = None) -> bool:
    """Напоминание: неоплачен, ещё не слали, срок ≤ today+N (включая просрочку)."""
    if occ.is_paid or occ.reminder_sent:
        return False
    today = today or get_today()
    threshold = today + timedelta(days=settings.REMINDER_DAYS_BEFORE)
    return occ.due_date <= threshold


async def send_reminder_for_occurrence(
    db: AsyncSession,
    occ: PaymentOccurrence,
    *,
    commit: bool = True,
) -> bool:
    """
    Отправить напоминание по одному occurrence (без дублей).
    Учитывает is_active регулярного платежа.
    """
    if not _needs_reminder(occ):
        return False

    rp = occ.recurring_payment
    if rp is None:
        result = await db.execute(
            select(RecurringPayment).where(RecurringPayment.id == occ.recurring_payment_id)
        )
        rp = result.scalar_one_or_none()
    if not rp or not rp.is_active:
        return False

    text = format_reminder(occ, rp)
    ok = await send_telegram_message(text)
    token = settings.TELEGRAM_BOT_TOKEN
    demo_mode = not token or str(token).startswith("123456")
    # В демо без токена тоже помечаем, чтобы не дублировать
    if ok or demo_mode:
        occ.reminder_sent = True
        if commit:
            await db.commit()
        print(f"[Reminder] {rp.name} due {occ.due_date} (sent={ok})")
        return True
    return False


async def process_reminders(db: AsyncSession) -> int:
    """
    Пакетная проверка:
    - неоплаченные
    - reminder_sent == False
    - due_date в окне [−∞; today+N]  (просрочка и «за 3 дня»)
    - регулярный платёж активен
    Удалённые (is_active=False) не напоминают.
    """
    today = get_today()
    threshold = today + timedelta(days=settings.REMINDER_DAYS_BEFORE)

    result = await db.execute(
        select(PaymentOccurrence)
        .join(RecurringPayment, PaymentOccurrence.recurring_payment_id == RecurringPayment.id)
        .options(selectinload(PaymentOccurrence.recurring_payment))
        .where(
            PaymentOccurrence.is_paid == False,  # noqa: E712
            PaymentOccurrence.reminder_sent == False,  # noqa: E712
            PaymentOccurrence.due_date <= threshold,
            RecurringPayment.is_active == True,  # noqa: E712
        )
    )
    occurrences = result.scalars().all()
    sent = 0

    for occ in occurrences:
        if await send_reminder_for_occurrence(db, occ, commit=False):
            sent += 1

    if sent:
        await db.commit()
    return sent