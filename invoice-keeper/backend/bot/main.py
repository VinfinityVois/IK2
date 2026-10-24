"""Персональный Telegram-бот Invoice Keeper. Запуск из backend: python -m bot.main"""
import asyncio
import logging
import sys
from datetime import date, datetime, timezone
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandObject
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.telegram_message_log import TelegramMessageLog
from app.models.user import User
from app.services.periods import create_next_period_after_payment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
bot = Bot(token=settings.TELEGRAM_BOT_TOKEN or "0:0")
dp = Dispatcher()

async def get_linked_user(telegram_id: int) -> User | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.telegram_id == telegram_id, User.is_active.is_(True)))
        return result.scalar_one_or_none()

async def require_link(message: Message) -> User | None:
    user = await get_linked_user(message.from_user.id)
    if not user:
        await message.answer("Чтобы пользоваться ботом, сначала привяжите аккаунт IK2.\n\nВойдите в веб-приложение, получите код в профиле (POST /api/v1/profile/telegram-link-code), затем отправьте:\n<code>/link ВАШ_КОД</code>", parse_mode="HTML")
    return user

@dp.message(Command("start"))
async def cmd_start(message: Message):
    user = await get_linked_user(message.from_user.id)
    if not user:
        await message.answer("<b>Invoice Keeper</b>\n\nПерсональные напоминания об оплате.\n\nДля начала привяжите аккаунт IK2 командой /link КОД. Код можно получить в авторизованном профиле IK2.", parse_mode="HTML")
        return
    await message.answer(f"<b>Invoice Keeper</b>\nАккаунт: {escape(user.username)}\n\nКоманды:\n/payments — мои платежи\n/upcoming — ближайшие сроки\n/overdue — просроченные\n/summary — сводка\n/journal — последние сообщения\n/unlink — отвязать Telegram", parse_mode="HTML")

@dp.message(Command("link"))
async def cmd_link(message: Message, command: CommandObject):
    code = (command.args or "").strip().upper()
    if not code:
        await message.answer("Формат: <code>/link КОД</code>", parse_mode="HTML")
        return
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.telegram_link_code == code, User.is_active.is_(True)))
        user = result.scalar_one_or_none()
        if not user or not user.telegram_link_expires_at:
            await message.answer("Код не найден или уже использован. Получите новый код в профиле IK2.")
            return
        expires = user.telegram_link_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < now:
            user.telegram_link_code = None
            user.telegram_link_expires_at = None
            await db.commit()
            await message.answer("Срок действия кода истёк. Получите новый код в IK2.")
            return
        existing = await db.execute(select(User).where(User.telegram_id == message.from_user.id, User.id != user.id))
        if existing.scalar_one_or_none():
            await message.answer("Этот Telegram уже привязан к другому аккаунту IK2. Сначала выполните /unlink в том аккаунте.")
            return
        user.telegram_id = message.from_user.id
        user.telegram_link_code = None
        user.telegram_link_expires_at = None
        await db.commit()
        await db.refresh(user)
    await message.answer(f"Аккаунт <b>{escape(user.username)}</b> успешно привязан. Напоминания будут приходить сюда.", parse_mode="HTML")

@dp.message(Command("unlink"))
async def cmd_unlink(message: Message):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.telegram_id == message.from_user.id))
        user = result.scalar_one_or_none()
        if not user:
            await message.answer("Telegram не привязан к аккаунту IK2.")
            return
        user.telegram_id = None
        await db.commit()
    await message.answer("Telegram отвязан. Напоминания больше не будут отправляться в этот чат.")

async def list_occurrences(user: User, overdue_only: bool = False, limit: int = 10):
    async with AsyncSessionLocal() as db:
        query = (select(PaymentOccurrence).join(RecurringPayment)
                 .options(selectinload(PaymentOccurrence.recurring_payment))
                 .where(RecurringPayment.owner_id == user.id, RecurringPayment.is_active.is_(True), PaymentOccurrence.is_paid.is_(False))
                 .order_by(PaymentOccurrence.due_date))
        result = await db.execute(query)
        items = result.scalars().all()
        if overdue_only:
            items = [item for item in items if item.is_overdue]
        return items[:limit]

async def send_occurrences(message: Message, user: User, overdue_only: bool = False):
    items = await list_occurrences(user, overdue_only=overdue_only)
    title = "⚠️ <b>Просроченные платежи</b>" if overdue_only else "📋 <b>Мои неоплаченные платежи</b>"
    if not items:
        await message.answer("✅ Просроченных платежей нет." if overdue_only else "Нет неоплаченных платежей.")
        return
    for occ in items:
        rp = occ.recurring_payment
        if not rp:
            continue
        mark = "🔴" if occ.is_overdue else "⚪"
        text = f"{title}\n\n{mark} <b>{escape(rp.name)}</b>\nСумма: <code>{rp.amount} {escape(rp.currency)}</code>\nСрок: <b>{occ.due_date.isoformat()}</b>"
        kb = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text="✅ Оплачено", callback_data=f"pay:{occ.id}")]])
        await message.answer(text, parse_mode="HTML", reply_markup=kb)

@dp.message(Command("payments"))
async def cmd_payments(message: Message):
    user = await require_link(message)
    if user: await send_occurrences(message, user)

@dp.message(Command("upcoming"))
async def cmd_upcoming(message: Message):
    user = await require_link(message)
    if user: await send_occurrences(message, user)

@dp.message(Command("overdue"))
async def cmd_overdue(message: Message):
    user = await require_link(message)
    if user: await send_occurrences(message, user, overdue_only=True)

@dp.message(Command("summary"))
async def cmd_summary(message: Message):
    user = await require_link(message)
    if not user: return
    from collections import defaultdict
    from decimal import Decimal
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(PaymentOccurrence).join(RecurringPayment).options(selectinload(PaymentOccurrence.recurring_payment)).where(RecurringPayment.owner_id == user.id))
        items = result.scalars().all()
    stats = defaultdict(lambda: {"paid": Decimal(0), "unpaid": Decimal(0), "n_paid": 0, "n_unpaid": 0})
    for occ in items:
        rp = occ.recurring_payment
        if not rp: continue
        bucket = "paid" if occ.is_paid else "unpaid"
        stats[rp.currency][bucket] += rp.amount
        stats[rp.currency]["n_paid" if occ.is_paid else "n_unpaid"] += 1
    if not stats:
        await message.answer("По вашему аккаунту пока нет платежей.")
        return
    lines = ["📊 <b>Моя сводка</b>"]
    for currency, values in sorted(stats.items()):
        lines.append(f"\n<b>{escape(currency)}</b>\nОплачено: {values['paid']} ({values['n_paid']})\nОжидает: {values['unpaid']} ({values['n_unpaid']})")
    await message.answer("\n".join(lines), parse_mode="HTML")

@dp.message(Command("journal"))
async def cmd_journal(message: Message):
    user = await require_link(message)
    if not user: return
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(TelegramMessageLog).where(TelegramMessageLog.user_id == user.id).order_by(desc(TelegramMessageLog.created_at)).limit(10))
        logs = result.scalars().all()
    if not logs:
        await message.answer("Журнал пока пуст.")
        return
    lines = ["🧾 <b>Последние события</b>"]
    for item in logs:
        status = "Отправлено" if item.status == "sent" else "Ошибка"
        lines.append(f"\n• {item.created_at.strftime('%d.%m.%Y %H:%M') if item.created_at else '—'} — {escape(item.message_type)}: {status}")
        if item.error: lines.append(f"  <i>{escape(item.error[:120])}</i>")
    await message.answer("\n".join(lines), parse_mode="HTML")

@dp.callback_query(F.data.startswith("pay:"))
async def cb_pay(callback: CallbackQuery):
    try:
        occurrence_id = int(callback.data.split(":", 1)[1])
    except (ValueError, AttributeError):
        await callback.answer("Некорректная команда", show_alert=True)
        return
    telegram_id = callback.from_user.id
    async with AsyncSessionLocal() as db:
        user_result = await db.execute(select(User).where(User.telegram_id == telegram_id, User.is_active.is_(True)))
        user = user_result.scalar_one_or_none()
        if not user:
            await callback.answer("Сначала привяжите аккаунт IK2", show_alert=True)
            return
        result = await db.execute(select(PaymentOccurrence).options(selectinload(PaymentOccurrence.recurring_payment)).where(PaymentOccurrence.id == occurrence_id))
        occ = result.scalar_one_or_none()
        if not occ or not occ.recurring_payment or occ.recurring_payment.owner_id != user.id:
            await callback.answer("Этот платёж не принадлежит вашему аккаунту", show_alert=True)
            return
        if occ.is_paid:
            await callback.answer("Уже отмечен оплаченным")
            return
        occ.is_paid = True
        occ.paid_at = date.today()
        await db.commit()
        await create_next_period_after_payment(db, occ)
        db.add(TelegramMessageLog(user_id=user.id, payment_occurrence_id=occ.id, message_type="payment_marked", status="sent", message_text=f"Оплата отмечена: {occ.recurring_payment.name}"))
        await db.commit()
        name = escape(occ.recurring_payment.name)
    await callback.answer("Платёж отмечен оплаченным")
    if callback.message:
        await callback.message.edit_text(f"✅ <b>{name}</b> отмечен оплаченным ({date.today().isoformat()})", parse_mode="HTML")

async def main():
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("123456"):
        logger.error("Укажите TELEGRAM_BOT_TOKEN в .env")
        return
    logger.info("Telegram bot starting")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
