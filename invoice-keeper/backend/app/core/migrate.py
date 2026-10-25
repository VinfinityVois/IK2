
"""Добавляет поля Telegram и совместимость старых SQLite/PostgreSQL баз."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def ensure_sqlite_columns(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        dialect = conn.dialect.name

        if dialect == "sqlite":
            result = await conn.execute(text("PRAGMA table_info(users)"))
            columns = {row[1] for row in result.fetchall()}
        elif dialect == "postgresql":
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() AND table_name = 'users'"
            ))
            columns = {row[0] for row in result.fetchall()}
        else:
            return

        definitions = {
            "email": "VARCHAR(255)",
            "full_name": "VARCHAR(255)",
            "phone": "VARCHAR(32)",
            "locale": "VARCHAR(8) DEFAULT 'ru'",
            "telegram_id": "BIGINT",
            "telegram_link_code": "VARCHAR(16)",
            "telegram_link_expires_at": "TIMESTAMP WITH TIME ZONE",
        }

        for column, definition in definitions.items():
            if column not in columns:
                await conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN {column} {definition}"
                ))
                print(f"[migrate] users.{column} added")

        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_id "
            "ON users (telegram_id)"
        ))
        await conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_link_code "
            "ON users (telegram_link_code)"
        ))

        if dialect == "sqlite":
            result = await conn.execute(
                text("PRAGMA table_info(recurring_payments)")
            )
            rp_columns = {row[1] for row in result.fetchall()}
        else:
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema() "
                "AND table_name = 'recurring_payments'"
            ))
            rp_columns = {row[0] for row in result.fetchall()}

        if "owner_id" not in rp_columns:
            await conn.execute(text(
                "ALTER TABLE recurring_payments "
                "ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL"
            ))
            print("[migrate] recurring_payments.owner_id added")

        if "original_day" not in rp_columns:
            await conn.execute(text(
                "ALTER TABLE recurring_payments ADD COLUMN original_day INTEGER"
            ))
            print("[migrate] recurring_payments.original_day added")

        # Старые записи: берём день из текущей даты следующего платежа.
        # Значения, которые уже заполнены, не меняем.
        if dialect == "sqlite":
            await conn.execute(text("""
                UPDATE recurring_payments
                SET original_day = CAST(
                    strftime('%d', next_due_date) AS INTEGER
                )
                WHERE original_day IS NULL
                  AND next_due_date IS NOT NULL
            """))
        else:
            await conn.execute(text("""
                UPDATE recurring_payments
                SET original_day = EXTRACT(DAY FROM next_due_date)::INTEGER
                WHERE original_day IS NULL
                  AND next_due_date IS NOT NULL
            """))

        print("[migrate] recurring_payments.original_day checked")
