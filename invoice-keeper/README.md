# Invoice Keeper — Личное дело

Система напоминаний о регулярных платежах с 3D-интерфейсом в стиле «личное дело».

## Стек

- **Frontend**: Next.js 15 + TypeScript + React Three Fiber + Drei + Tailwind + Framer Motion
- **Backend**: FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL / SQLite
- **Bot**: aiogram 3
- **Auth**: JWT
- **Background**: APScheduler

## Быстрый старт

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# отредактируй .env (особенно TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID)

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Документация API: http://localhost:8000/api/v1/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Откроется на http://localhost:3000

## Структура

```
invoice-keeper/
├── backend/          # FastAPI
│   ├── app/
│   │   ├── api/v1/   # эндпоинты
│   │   ├── core/     # config, security, database
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── workers/
│   ├── bot/          # Telegram bot
│   └── alembic/
├── frontend/         # Next.js + 3D
└── docker-compose.yml
```

## Роли

- **admin** — задаётся через `.env`, управляет платежами и пользователями
- **user** — видит платежи, отмечает оплату, меняет фактическую дату

## Обязательные эндпоинты

См. `/api/v1/docs` после запуска.
