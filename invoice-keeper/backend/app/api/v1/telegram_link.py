"""Привязка Telegram: выдача одноразового кода в БД пользователя."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.telegram_message_log import TelegramMessageLog
from app.models.user import User

router = APIRouter(prefix="/profile", tags=["telegram"])

LINK_TTL_MINUTES = 10


class TelegramLinkCodeOut(BaseModel):
    code: str
    expires_in_seconds: int
    expires_at: str
    instruction: str
    user_id: int
    username: str


class TelegramStatusOut(BaseModel):
    linked: bool
    telegram_id: Optional[int] = None
    has_pending_code: bool = False
    code_expires_at: Optional[str] = None


def _new_link_code() -> str:
    """Одноразовый код без неоднозначных символов, до 10 символов."""
    raw = secrets.token_urlsafe(8).upper()
    for a, b in (("-", "X"), ("_", "Y")):
        raw = raw.replace(a, b)
    return raw[:10]


@router.post("/telegram-link-code", response_model=TelegramLinkCodeOut)
async def create_telegram_link_code(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
):
    """Генерирует код и **сохраняет** его в строке пользователя (users.telegram_link_code).

    Бот ищет пользователя по этому полю: /link КОД.
    """
    # Всегда перечитываем пользователя в текущей сессии — гарантия UPDATE в БД
    result = await db.execute(select(User).where(User.id == current.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт отключён")

    code = _new_link_code()
    # Уникальность: при редком конфликте — ещё одна попытка
    for _ in range(5):
        clash = await db.execute(
            select(User.id).where(
                User.telegram_link_code == code,
                User.id != user.id,
            )
        )
        if clash.scalar_one_or_none() is None:
            break
        code = _new_link_code()
    else:
        raise HTTPException(status_code=500, detail="Не удалось сгенерировать уникальный код")

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=LINK_TTL_MINUTES)
    user.telegram_link_code = code
    user.telegram_link_expires_at = expires_at

    db.add(
        TelegramMessageLog(
            user_id=user.id,
            message_type="link_code",
            status="sent",
            message_text=f"Link code issued for user_id={user.id}, expires={expires_at.isoformat()}",
        )
    )

    await db.commit()
    await db.refresh(user)

    # Проверка, что код реально лежит в БД
    if user.telegram_link_code != code:
        raise HTTPException(
            status_code=500,
            detail="Код не сохранился в БД — проверьте колонки users.telegram_link_code",
        )

    return TelegramLinkCodeOut(
        code=code,
        expires_in_seconds=LINK_TTL_MINUTES * 60,
        expires_at=expires_at.isoformat(),
        instruction="Отправьте боту команду: /link " + code,
        user_id=user.id,
        username=user.username,
    )


@router.get("/telegram-status", response_model=TelegramStatusOut)
async def telegram_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
):
    """Статус привязки Telegram и наличие активного кода в БД."""
    result = await db.execute(select(User).where(User.id == current.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    pending = False
    exp_iso = None
    if user.telegram_link_code and user.telegram_link_expires_at:
        exp = user.telegram_link_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > datetime.now(timezone.utc):
            pending = True
            exp_iso = exp.isoformat()

    return TelegramStatusOut(
        linked=user.telegram_id is not None,
        telegram_id=user.telegram_id,
        has_pending_code=pending,
        code_expires_at=exp_iso,
    )


@router.delete("/telegram-link")
async def unlink_telegram(
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(get_current_user)],
):
    """Отвязать Telegram и сбросить код привязки в БД."""
    result = await db.execute(select(User).where(User.id == current.id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.telegram_id = None
    user.telegram_link_code = None
    user.telegram_link_expires_at = None
    await db.commit()
    return {"ok": True, "detail": "Telegram отвязан, код сброшен"}
