from datetime import datetime, timedelta, timezone
import secrets
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/profile", tags=["telegram"])

@router.post("/telegram-link-code")
async def create_telegram_link_code(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """Создаёт одноразовый код для привязки Telegram на 10 минут."""
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт отключён")
    code = secrets.token_urlsafe(6).replace("-", "A").replace("_", "B")[:10].upper()
    user.telegram_link_code = code
    user.telegram_link_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    await db.commit()
    return {"code": code, "expires_in_seconds": 600, "instruction": "Отправьте боту /link КОД"}
