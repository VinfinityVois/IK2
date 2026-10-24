"""
Telegram-бот Invoice Keeper (aiogram 3).

Запуск (из backend/):
  python -m bot.main

Или отдельным процессом в docker-compose.
"""
import asyncio
import logging
import sys
from pathlib import Path

# Добавляем backend в path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.services.periods import create_next_period_after_payment
from datetime import date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=settings.TELEGRAM_BOT_TOKEN or "0:0")
dp = Dispatcher()


@dp.message(Command("start"))
async def cmd_start(message: Message):
    await message.answer(
        "📁 <b>Invoice Keeper</b>\n\n"
        "Личное дело регулярных платежей.\n\n"
        "Команды:\n"
        "/upcoming — ближайшие платежи\n"
        "/overdue — просроченные\n"
        "/summary — итоги по валютам",
        parse_mode="HTML",
    )


@dp.message(Command("upcoming"))
async def cmd_upcoming(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentOccurrence)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(PaymentOccurrence.is_paid == False)  # noqa: E712
            .order_by(PaymentOccurrence.due_date)
            .limit(10)
        )
        items = result.scalars().all()

    if not items:
        await message.answer("Нет предстоящих платежей.")
        return

    lines = ["📋 <b>Ближайшие платежи</b>\n"]
    for occ in items:
        rp = occ.recurring_payment
        if not rp:
            continue
        mark = "🔴" if occ.is_overdue else "⚪"
        lines.append(
            f"{mark} <b>{rp.name}</b> — {rp.amount} {rp.currency}\n"
            f"   срок: {occ.due_date}"
        )
    await message.answer("\n".join(lines), parse_mode="HTML")


@dp.message(Command("overdue"))
async def cmd_overdue(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentOccurrence)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(PaymentOccurrence.is_paid == False)  # noqa: E712
            .order_by(PaymentOccurrence.due_date)
        )
        items = [o for o in result.scalars().all() if o.is_overdue]

    if not items:
        await message.answer("✅ Просроченных нет.")
        return

    kb_rows = []
    lines = ["⚠️ <b>Просроченные</b>\n"]
    for occ in items:
        rp = occ.recurring_payment
        if not rp:
            continue
        lines.append(f"• <b>{rp.name}</b> — {rp.amount} {rp.currency} (до {occ.due_date})")
        kb_rows.append(
            [
                InlineKeyboardButton(
                    text=f"✅ {rp.name}",
                    callback_data=f"pay:{occ.id}",
                )
            ]
        )

    kb = InlineKeyboardMarkup(inline_keyboard=kb_rows) if kb_rows else None
    await message.answer("\n".join(lines), parse_mode="HTML", reply_markup=kb)


@dp.callback_query(F.data.startswith("pay:"))
async def cb_pay(callback: CallbackQuery):
    occ_id = int(callback.data.split(":")[1])
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentOccurrence)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(PaymentOccurrence.id == occ_id)
        )
        occ = result.scalar_one_or_none()
        if not occ:
            await callback.answer("Не найден", show_alert=True)
            return
        if occ.is_paid:
            await callback.answer("Уже оплачен")
            return

        occ.is_paid = True
        occ.paid_at = date.today()
        await db.commit()
        await create_next_period_after_payment(db, occ)

        name = occ.recurring_payment.name if occ.recurring_payment else "#"
        await callback.answer(f"Оплачено: {name}")
        await callback.message.edit_text(
            callback.message.text + f"\n\n✅ Отмечено оплаченным ({date.today()})",
            parse_mode="HTML",
        )


@dp.message(Command("summary"))
async def cmd_summary(message: Message):
    from collections import defaultdict
    from decimal import Decimal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentOccurrence).options(
                selectinload(PaymentOccurrence.recurring_payment)
            )
        )
        items = result.scalars().all()

    stats = defaultdict(lambda: {"paid": Decimal(0), "unpaid": Decimal(0), "n_paid": 0, "n_unpaid": 0})
    for occ in items:
        if not occ.recurring_payment:
            continue
        c = occ.recurring_payment.currency
        a = occ.recurring_payment.amount
        if occ.is_paid:
            stats[c]["paid"] += a
            stats[c]["n_paid"] += 1
        else:
            stats[c]["unpaid"] += a
            stats[c]["n_unpaid"] += 1

    if not stats:
        await message.answer("Нет данных.")
        return

    lines = ["📊 <b>Итоги</b>\n"]
    for cur, s in sorted(stats.items()):
        lines.append(
            f"<b>{cur}</b>\n"
            f"  оплачено: {s['paid']} ({s['n_paid']})\n"
            f"  ждёт: {s['unpaid']} ({s['n_unpaid']})"
        )
    await message.answer("\n".join(lines), parse_mode="HTML")


async def main():
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("123456"):
        logger.error("Укажите TELEGRAM_BOT_TOKEN в .env")
        return
    logger.info("Bot starting...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
