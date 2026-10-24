"""Простые ALTER для SQLite, когда create_all не добавляет колонки."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


async def ensure_sqlite_columns(engine: AsyncEngine) -> None:
    if engine.dialect.name != "sqlite":
        return

    async with engine.begin() as conn:
        # users.email
        cols = await conn.execute(text("PRAGMA table_info(users)"))
        user_cols = {row[1] for row in cols.fetchall()}
        if "email" not in user_cols:
            await conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255)"))
            print("[migrate] users.email added")

        # profile fields
        for col, typ in [
            ("full_name", "VARCHAR(255)"),
            ("phone", "VARCHAR(32)"),
            ("locale", "VARCHAR(8) DEFAULT 'ru'"),
        ]:
            if col not in user_cols:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {typ}"))
                print(f"[migrate] users.{col} added")
                user_cols.add(col)

        # recurring_payments.owner_id
        cols2 = await conn.execute(text("PRAGMA table_info(recurring_payments)"))
        rp_cols = {row[1] for row in cols2.fetchall()}
        if "owner_id" not in rp_cols:
            await conn.execute(
                text("ALTER TABLE recurring_payments ADD COLUMN owner_id INTEGER REFERENCES users(id)")
            )
            print("[migrate] recurring_payments.owner_id added")
