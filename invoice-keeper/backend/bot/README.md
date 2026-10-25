# Telegram-бот Invoice Keeper

## Возможности

- `/link КОД` — привязка Telegram к аккаунту IK2 (код из API/веба)
- `/payments`, `/upcoming`, `/overdue` — список обязательств с кнопкой **Оплачено**
- `/summary` — сводка по валютам
- `/journal` — лог напоминаний
- `/unlink` — отвязка

Напоминания шлёт **API** (`process_reminders` + scheduler каждые 5 мин), если у пользователя заполнен `telegram_id`. Кнопка «Оплачено» обрабатывается **ботом** (callback `pay:ID`).

## Настройка

1. Создайте бота у [@BotFather](https://t.me/BotFather), получите token.
2. В `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=123456:ABC...
DATABASE_URL=sqlite+aiosqlite:///./invoice_keeper.db
```

**Важно:** бот и API должны смотреть в **одну и ту же БД**.

3. Установите зависимости:

```bash
cd invoice-keeper/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

4. Запустите API (миграции/таблицы) и бота:

```bash
# терминал 1
uvicorn app.main:app --reload --port 8000

# терминал 2
python -m bot.main
# или: bash run_bot.sh
```

5. В веб-приложении: Настройки → получить код → в Telegram: `/link КОД`.

## API привязки

`POST /api/v1/profile/telegram-link-code` (Bearer JWT) → `{ "code": "...", "expires_in_seconds": 600 }`.
