"""Безопасное пересоздание демонстрационных данных Invoice Keeper.

Запускать из папки backend:
    python scripts/reset_demo_data.py --dry-run
    python scripts/reset_demo_data.py --confirm-reset

Скрипт сохраняет пользователей, автоматически делает резервную копию SQLite,
удаляет старые платежи/периоды/логи уведомлений и создаёт большой набор демо-данных.
Он не удаляет пользовательские аккаунты и не меняет пароли существующих пользователей.
"""
from __future__ import annotations
import sys
import argparse
import asyncio
import random
import shutil
import sqlite3
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from urllib.parse import unquote, urlparse

from sqlalchemy import delete, select

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.payment_occurrence import PaymentOccurrence
from app.models.recurring_payment import RecurringPayment
from app.models.telegram_message_log import TelegramMessageLog
from app.models.user import User




RNG = random.Random(20261024)
DEMO_USER_COUNT = 24
PAYMENTS_PER_USER = 12
HISTORY_MONTHS = 12

VENDORS = [
    ("Аренда офиса", "RUB", Decimal("85000.00"), "Аренда рабочего пространства, договор аренды"),
    ("Интернет и связь", "RUB", Decimal("3490.00"), "Корпоративный интернет и телефония"),
    ("Электроэнергия", "RUB", Decimal("12450.00"), "Коммунальные услуги, электричество"),
    ("Облачный сервер", "USD", Decimal("48.00"), "Облачная инфраструктура и резервные копии"),
    ("Домен и DNS", "EUR", Decimal("18.00"), "Продление домена и управление DNS"),
    ("CRM для команды", "USD", Decimal("79.00"), "Подписка CRM для отдела продаж"),
    ("Дизайн-платформа", "EUR", Decimal("32.00"), "Командная подписка на дизайн-инструменты"),
    ("Бухгалтерское сопровождение", "RUB", Decimal("22000.00"), "Ежемесячное бухгалтерское обслуживание"),
    ("Юридические услуги", "RUB", Decimal("18000.00"), "Абонентское юридическое сопровождение"),
    ("Корпоративная почта", "USD", Decimal("24.00"), "Почта и рабочие аккаунты сотрудников"),
    ("Резервное копирование", "EUR", Decimal("15.00"), "Хранение резервных копий"),
    ("Складская система", "RUB", Decimal("9900.00"), "Подписка на учёт запасов"),
    ("Охрана офиса", "RUB", Decimal("7400.00"), "Обслуживание системы безопасности"),
    ("Уборка помещения", "RUB", Decimal("12500.00"), "Клининг по договору обслуживания"),
    ("Обучение сотрудников", "RUB", Decimal("6500.00"), "Профессиональное обучение и курсы"),
    ("Видеоконференции", "USD", Decimal("21.00"), "Лицензии на видеосвязь"),
    ("Мониторинг сервисов", "EUR", Decimal("29.00"), "Мониторинг доступности приложений"),
    ("Платёжный шлюз", "RUB", Decimal("3150.00"), "Абонентская плата за платёжный сервис"),
    ("Страхование имущества", "RUB", Decimal("15800.00"), "Плановый страховой платёж"),
    ("Транспортное обслуживание", "RUB", Decimal("23000.00"), "Ежемесячное обслуживание транспорта"),
    ("Аналитика продукта", "USD", Decimal("59.00"), "Подписка на аналитическую платформу"),
    ("Хостинг сайта", "EUR", Decimal("12.00"), "Хостинг публичного сайта"),
    ("Сервис электронных подписей", "RUB", Decimal("2800.00"), "Электронный документооборот"),
    ("Реклама и продвижение", "RUB", Decimal("45000.00"), "Плановый рекламный бюджет"),
]

FIRST_NAMES = ["Александр", "Мария", "Дмитрий", "Анна", "Михаил", "Елена", "Иван", "Ольга", "Артём", "Наталья", "Сергей", "Дарья", "Павел", "Ирина", "Кирилл", "Виктория", "Андрей", "Полина", "Роман", "София", "Максим", "Алиса", "Егор", "Ксения"]
LAST_NAMES = ["Смирнов", "Иванова", "Кузнецов", "Попова", "Соколов", "Лебедева", "Новиков", "Морозова", "Волков", "Петрова", "Орлов", "Фёдорова", "Зайцев", "Николаева", "Белов", "Алексеева", "Комаров", "Васильева", "Захаров", "Павлова", "Михайлов", "Семёнова", "Егоров", "Степанова"]


def sqlite_path_from_url(url: str) -> Path | None:
    if not url.startswith("sqlite"):
        return None
    parsed = urlparse(url.replace("sqlite+aiosqlite:", "sqlite:", 1))
    raw_path = unquote(parsed.path or "")
    if raw_path in ("", "/:memory:", ":memory:"):
        return None
    # sqlite:///./relative.db is parsed as /./relative.db; keep it relative.
    if raw_path.startswith("/./"):
        path = Path(raw_path[1:])
    elif raw_path.startswith("/") and not raw_path.startswith("//"):
        path = Path(raw_path)
    else:
        path = Path(raw_path.lstrip("/"))
    return path.resolve()


def make_backup() -> Path | None:
    source = sqlite_path_from_url(settings.DATABASE_URL)
    if source is None or not source.exists():
        return None
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target = source.with_name(f"{source.stem}.backup_{stamp}{source.suffix}")
    # SQLite backup API produces a consistent copy even if WAL is in use.
    with sqlite3.connect(source) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
    return target


def month_shift(day: date, months: int) -> date:
    # Keep the day valid when shifting from month-end.
    month_index = day.year * 12 + (day.month - 1) + months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    import calendar
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


async def ensure_demo_users(db) -> list[User]:
    admin = (await db.execute(select(User).where(User.username == settings.ADMIN_USERNAME))).scalar_one_or_none()
    if admin is None:
        admin = (await db.execute(select(User).where(User.role == "admin").order_by(User.id).limit(1))).scalar_one_or_none()
    if admin is None:
        admin = User(
            username=settings.ADMIN_USERNAME,
            email="admin.demo@invoice-keeper.local",
            full_name="Администратор демонстрационной системы",
            locale="ru",
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            role="admin",
            is_active=True,
        )
        db.add(admin)
        await db.flush()

    users = [admin]
    for i in range(1, DEMO_USER_COUNT + 1):
        username = f"demo.user{i:02d}"
        user = (await db.execute(select(User).where(User.username == username))).scalar_one_or_none()
        if user is None:
            first = FIRST_NAMES[(i - 1) % len(FIRST_NAMES)]
            last = LAST_NAMES[(i - 1) % len(LAST_NAMES)]
            user = User(
                username=username,
                email=f"demo.user{i:02d}@example.test",
                full_name=f"{first} {last}",
                phone=f"+7-900-{i:03d}-{(i * 37) % 10000:04d}",
                locale="ru" if i % 5 else "en",
                hashed_password=get_password_hash("Demo-2026!ChangeMe"),
                role="user",
                is_active=(i % 11 != 0),
            )
            db.add(user)
            await db.flush()
        users.append(user)
    return users


async def populate() -> dict[str, int]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        users = await ensure_demo_users(db)
        # Clear demo/business data, but preserve user accounts and their credentials.
        await db.execute(delete(TelegramMessageLog))
        await db.execute(delete(PaymentOccurrence))
        await db.execute(delete(RecurringPayment))
        await db.flush()

        today = date.today()
        payments: list[RecurringPayment] = []
        occurrences: list[PaymentOccurrence] = []
        occurrence_owner_ids: dict[int, int] = {}
        for user_index, user in enumerate(users):
            for payment_index in range(PAYMENTS_PER_USER):
                base_name, currency, base_amount, description = VENDORS[(user_index * 7 + payment_index * 3) % len(VENDORS)]
                # Unique name per owner while keeping realistic recurring payment categories.
                name = f"{base_name} — {user.username}"
                amount = (base_amount * Decimal(str(RNG.uniform(0.75, 1.35)))).quantize(Decimal("0.01"))
                next_due = today + timedelta(days=RNG.randint(-8, 60))
                payment = RecurringPayment(
                    owner_id=user.id,
                    name=name,
                    amount=amount,
                    currency=currency,
                    next_due_date=next_due,
                    periodicity="monthly",
                    is_active=(RNG.random() > 0.12),
                    description=f"{description}. Демо-запись для проверки фильтров, сортировки и карточки платежа. Ответственный: {user.full_name or user.username}.",
                )
                db.add(payment)
                await db.flush()
                payments.append(payment)

                # One year of history plus upcoming periods.
                for offset in range(-9, 3):
                    due = month_shift(next_due, offset)
                    paid_probability = 0.82 if due < today else (0.08 if due == today else 0.02)
                    is_paid = RNG.random() < paid_probability
                    paid_at = None
                    if is_paid:
                        paid_at = due + timedelta(days=RNG.randint(-2, 3))
                    occurrence = PaymentOccurrence(
                        recurring_payment_id=payment.id,
                        due_date=due,
                        is_paid=is_paid,
                        paid_at=paid_at,
                        reminder_sent=(due <= today and RNG.random() < 0.7),
                    )
                    db.add(occurrence)
                    occurrences.append(occurrence)

        await db.flush()
        for occurrence in occurrences:
            occurrence_owner_ids[occurrence.id] = next(
                payment.owner_id for payment in payments
                if payment.id == occurrence.recurring_payment_id
            )
        # Notification history is synthetic; no messages are sent to Telegram.
        log_statuses = [("sent", "Напоминание отправлено"), ("skipped", "Уведомление пропущено"), ("error", "Демо-ошибка доставки")]
        for i in range(min(600, len(occurrences))):
            occurrence = occurrences[RNG.randrange(len(occurrences))]
            status_value, note = log_statuses[RNG.choices([0, 1, 2], weights=[78, 17, 5])[0]]
            db.add(TelegramMessageLog(
                user_id=occurrence_owner_ids.get(occurrence.id),
                payment_occurrence_id=occurrence.id,
                message_type="payment_reminder" if i % 3 else "payment_status",
                status=status_value,
                message_text=f"[DEMO] {note}: тестовое уведомление для периода #{occurrence.id}. Сообщение не отправлялось в Telegram.",
                telegram_message_id=f"demo-{i + 1}" if status_value == "sent" else None,
                error="Синтетическая ошибка для проверки журнала" if status_value == "error" else None,
            ))

        await db.commit()
        return {
            "users_preserved_or_created": len(users),
            "recurring_payments": len(payments),
            "payment_occurrences": len(occurrences),
            "telegram_demo_logs": min(600, len(occurrences)),
        }


async def main() -> None:
    parser = argparse.ArgumentParser(description="Пересоздать демонстрационные данные Invoice Keeper")
    parser.add_argument("--confirm-reset", action="store_true", help="Подтвердить удаление старых платежей и логов")
    parser.add_argument("--dry-run", action="store_true", help="Только показать план без изменения БД")
    args = parser.parse_args()

    if args.dry_run:
        print("DRY RUN: будут сохранены аккаунты, удалены все платежи/периоды/логи уведомлений.")
        print(f"Будет создано примерно {len([1]) * (DEMO_USER_COUNT + 1) * PAYMENTS_PER_USER} регулярных платежей и около {(DEMO_USER_COUNT + 1) * PAYMENTS_PER_USER * HISTORY_MONTHS} периодов.")
        print("Для выполнения повторите команду с --confirm-reset.")
        return
    if not args.confirm_reset:
        parser.error("Операция изменяет данные. Сначала выполните --dry-run, затем добавьте --confirm-reset.")

    backup = make_backup()
    if backup:
        print(f"Резервная копия создана: {backup}")
    else:
        print("Внимание: файл SQLite не найден/не используется; автоматическая файловая копия не создана.")
    result = await populate()
    print("Демонстрационные данные обновлены:")
    for key, value in result.items():
        print(f"  {key}: {value}")
    print("Существующие пользователи и пароли сохранены. Демо-пользователи: demo.user01 … demo.user24.")
    print("Пароль новых демо-пользователей: Demo-2026!ChangeMe (смените его перед реальным использованием).")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
