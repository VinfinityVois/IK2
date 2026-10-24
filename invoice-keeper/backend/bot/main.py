"""Персональный Telegram-бот Invoice Keeper. Запуск: python -m bot.main из backend."""
import asyncio
import logging
import sys
from datetime import date, datetime, timezone
from html import escape
from pathlib import Path

# Позволяет запускать модуль командой python -m bot.main из backend.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from aiogram import Bot, Dispatcher, F  # noqa: E402
from aiogram.filters import Command, CommandObject  # noqa: E402
from aiogram.types import (  # noqa: E402
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
)
from sqlalchemy import desc, select  # noqa: E402
from sqlalchemy.orm import selectinload  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.models.payment_occurrence import PaymentOccurrence  # noqa: E402
from app.models.recurring_payment import RecurringPayment  # noqa: E402
from app.models.telegram_message_log import TelegramMessageLog  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.periods import create_next_period_after_payment  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
dp = Dispatcher()


async def get_linked_user(telegram_id: int) -> User | None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.telegram_id == telegram_id,
                User.is_active.is_(True),
            )
        )
        return result.scalar_one_or_none()


async def require_link(message: Message) -> User | None:
    if message.from_user is None:
        return None
    user = await get_linked_user(message.from_user.id)
    if user is None:
        await message.answer(
            "Чтобы пользоваться ботом, сначала привяжите аккаунт IK2.\n\n"
            "Войдите в веб-приложение, получите код в профиле и отправьте:\n"
            "<code>/link ВАШ_КОД</code>",
            parse_mode="HTML",
        )
    return user


@dp.message(Command("start"))
async def cmd_start(message: Message):
    if message.from_user is None:
        return
    user = await get_linked_user(message.from_user.id)
    if user is None:
        await message.answer(
            "<b>Invoice Keeper</b>\n\n"
            "Персональные напоминания об оплате.\n\n"
            "Для начала привяжите аккаунт IK2 командой /link КОД. "
            "Код можно получить в авторизованном профиле IK2.",
            parse_mode="HTML",
        )
        return
    username = escape(user.username)
    await message.answer(
        f"<b>Invoice Keeper</b>\nАккаунт: {username}\n\n"
        "Команды:\n/payments — мои платежи\n/upcoming — ближайшие сроки\n"
        "/overdue — просроченные\n/summary — сводка\n"
        "/journal — последние сообщения\n/unlink — отвязать Telegram",
        parse_mode="HTML",
    )


@dp.message(Command("link"))
async def cmd_link(message: Message, command: CommandObject):
    if message.from_user is None:
        return
    code = (command.args or "").strip().upper()
    if not code:
        await message.answer("Формат: <code>/link КОД</code>", parse_mode="HTML")
        return

    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.telegram_link_code == code,
                User.is_active.is_(True),
            )
        )
        user = result.scalar_one_or_none()
        if user is None or user.telegram_link_expires_at is None:
            await message.answer(
                "Код не найден или уже использован. Получите новый код в профиле IK2."
            )
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

        existing = await db.execute(
            select(User).where(
                User.telegram_id == message.from_user.id,
                User.id != user.id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            await message.answer(
                "Этот Telegram уже привязан к другому аккаунту IK2. "
                "Сначала выполните /unlink в том аккаунте."
            )
            return

        # Не перезаписываем Telegram ID, уже связанный с другим пользователем.
        if user.telegram_id is not None and user.telegram_id != message.from_user.id:
            await message.answer(
                "Этот аккаунт IK2 уже связан с другим Telegram. "
                "Сначала отвяжите его в профиле IK2."
            )
            return

        user.telegram_id = message.from_user.id
        user.telegram_link_code = None
        user.telegram_link_expires_at = None
        await db.commit()
        await db.refresh(user)

    await message.answer(
        f"Аккаунт <b>{escape(user.username)}</b> успешно привязан. "
        "Напоминания будут приходить сюда.",
        parse_mode="HTML",
    )


@dp.message(Command("unlink"))
async def cmd_unlink(message: Message):
    if message.from_user is None:
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.telegram_id == message.from_user.id)
        )
        user = result.scalar_one_or_none()
        if user is None:
            await message.answer("Telegram не привязан к аккаунту IK2.")
            return
        user.telegram_id = None
        await db.commit()
    await message.answer(
        "Telegram отвязан. Напоминания больше не будут отправляться в этот чат."
    )


async def list_occurrences(
    user: User, overdue_only: bool = False, limit: int = 10
) -> list[PaymentOccurrence]:
    async with AsyncSessionLocal() as db:
        query = (
            select(PaymentOccurrence)
            .join(RecurringPayment)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(
                RecurringPayment.owner_id == user.id,
                RecurringPayment.is_active.is_(True),
                PaymentOccurrence.is_paid.is_(False),
            )
            .order_by(PaymentOccurrence.due_date)
        )
        result = await db.execute(query)
        items = list(result.scalars().all())
        if overdue_only:
            items = [item for item in items if item.is_overdue]
        return items[:limit]


async def send_occurrences(
    message: Message, user: User, overdue_only: bool = False
):
    items = await list_occurrences(user, overdue_only=overdue_only)
    title = (
        "⚠️ <b>Просроченные платежи</b>"
        if overdue_only
        else "📋 <b>Мои неоплаченные платежи</b>"
    )
    if not items:
        await message.answer(
            "Просроченных платежей нет."
            if overdue_only
            else "Нет неоплаченных платежей."
        )
        return

    for occurrence in items:
        payment = occurrence.recurring_payment
        if payment is None:
            continue
        mark = "🔴" if occurrence.is_overdue else "⚪"
        text = (
            f"{title}\n\n{mark} <b>{escape(payment.name)}</b>\n"
            f"Сумма: <code>{payment.amount} {escape(payment.currency)}</code>\n"
            f"Срок: <b>{occurrence.due_date.isoformat()}</b>"
        )
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[[
                InlineKeyboardButton(
                    text="✅ Оплачено",
                    callback_data=f"pay:{occurrence.id}",
                )
            ]]
        )
        await message.answer(text, parse_mode="HTML", reply_markup=keyboard)


@dp.message(Command("payments"))
async def cmd_payments(message: Message):
    user = await require_link(message)
    if user is not None:
        await send_occurrences(message, user)


@dp.message(Command("upcoming"))
async def cmd_upcoming(message: Message):
    user = await require_link(message)
    if user is not None:
        items = await list_occurrences(user)
        items = [item for item in items if not item.is_overdue]
        if not items:
            await message.answer("Ближайших неоплаченных платежей нет.")
            return
        for occurrence in items:
            payment = occurrence.recurring_payment
            if payment is None:
                continue
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[[
                    InlineKeyboardButton(
                        text="✅ Оплачено",
                        callback_data=f"pay:{occurrence.id}",
                    )
                ]]
            )
            await message.answer(
                f"📅 <b>{escape(payment.name)}</b>\n"
                f"Сумма: <code>{payment.amount} {escape(payment.currency)}</code>\n"
                f"Срок: <b>{occurrence.due_date.isoformat()}</b>",
                parse_mode="HTML",
                reply_markup=keyboard,
            )


@dp.message(Command("overdue"))
async def cmd_overdue(message: Message):
    user = await require_link(message)
    if user is not None:
        await send_occurrences(message, user, overdue_only=True)


@dp.message(Command("summary"))
async def cmd_summary(message: Message):
    user = await require_link(message)
    if user is None:
        return

    from collections import defaultdict
    from decimal import Decimal

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PaymentOccurrence)
            .join(RecurringPayment)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(RecurringPayment.owner_id == user.id)
        )
        items = result.scalars().all()

    stats = defaultdict(
        lambda: {
            "paid": Decimal("0"),
            "unpaid": Decimal("0"),
            "n_paid": 0,
            "n_unpaid": 0,
        }
    )
    for occurrence in items:
        payment = occurrence.recurring_payment
        if payment is None:
            continue
        bucket = "paid" if occurrence.is_paid else "unpaid"
        stats[payment.currency][bucket] += payment.amount
        stats[payment.currency]["n_paid" if occurrence.is_paid else "n_unpaid"] += 1

    if not stats:
        await message.answer("По вашему аккаунту пока нет платежей.")
        return

    lines = ["📊 <b>Моя сводка</b>"]
    for currency, values in sorted(stats.items()):
        lines.append(
            f"\n<b>{escape(currency)}</b>\n"
            f"Оплачено: {values['paid']} ({values['n_paid']})\n"
            f"Ожидает: {values['unpaid']} ({values['n_unpaid']})"
        )
    await message.answer("\n".join(lines), parse_mode="HTML")


@dp.message(Command("journal"))
async def cmd_journal(message: Message):
    user = await require_link(message)
    if user is None:
        return
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(TelegramMessageLog)
            .where(TelegramMessageLog.user_id == user.id)
            .order_by(desc(TelegramMessageLog.created_at))
            .limit(10)
        )
        logs = result.scalars().all()

    if not logs:
        await message.answer("Журнал пока пуст.")
        return
    lines = ["🧾 <b>Последние события</b>"]
    for item in logs:
        status_text = "Отправлено" if item.status == "sent" else "Ошибка"
        created = item.created_at.strftime("%d.%m.%Y %H:%M") if item.created_at else "—"
        lines.append(
            f"\n• {created} — {escape(item.message_type)}: {status_text}"
        )
        if item.error:
            lines.append(f"  <i>{escape(item.error[:120])}</i>")
    await message.answer("\n".join(lines), parse_mode="HTML")


@dp.callback_query(F.data.startswith("pay:"))
async def cb_pay(callback: CallbackQuery):
    try:
        occurrence_id = int((callback.data or "").split(":", 1)[1])
    except (ValueError, AttributeError, IndexError):
        await callback.answer("Некорректная команда", show_alert=True)
        return

    telegram_id = callback.from_user.id
    async with AsyncSessionLocal() as db:
        user_result = await db.execute(
            select(User).where(
                User.telegram_id == telegram_id,
                User.is_active.is_(True),
            )
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            await callback.answer("Сначала привяжите аккаунт IK2", show_alert=True)
            return

        result = await db.execute(
            select(PaymentOccurrence)
            .options(selectinload(PaymentOccurrence.recurring_payment))
            .where(PaymentOccurrence.id == occurrence_id)
        )
        occurrence = result.scalar_one_or_none()
        if (
            occurrence is None
            or occurrence.recurring_payment is None
            or occurrence.recurring_payment.owner_id != user.id
        ):
            await callback.answer(
                "Этот платёж не принадлежит вашему аккаунту", show_alert=True
            )
            return
        if occurrence.is_paid:
            await callback.answer("Уже отмечен оплаченным")
            return

        occurrence.is_paid = True
        occurrence.paid_at = date.today()
        await db.commit()
        await create_next_period_after_payment(db, occurrence)
        db.add(
            TelegramMessageLog(
                user_id=user.id,
                payment_occurrence_id=occurrence.id,
                message_type="payment_marked",
                status="sent",
                message_text=f"Оплата отмечена: {occurrence.recurring_payment.name}",
            )
        )
        await db.commit()
        name = escape(occurrence.recurring_payment.name)

    await callback.answer("Платёж отмечен оплаченным")
    if callback.message:
        await callback.message.edit_text(
            f"✅ <b>{name}</b> отмечен оплаченным ({date.today().isoformat()})",
            parse_mode="HTML",
        )


async def main():
    token = settings.TELEGRAM_BOT_TOKEN
    if not token or token.startswith("123456"):
        logger.error("Укажите действительный TELEGRAM_BOT_TOKEN в backend/.env")
        return

    logger.info("Telegram bot starting")
    async with Bot(token=token) as bot:
        await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
