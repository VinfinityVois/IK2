from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.password_policy import validate_password
from app.core.security import get_password_hash, verify_password
from app.models.user import User

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    locale: str = "ru"
    role: str

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=32)
    email: Optional[EmailStr] = None
    locale: Optional[str] = Field(None, pattern="^(ru|en)$")
    # подтверждение текущего пароля для чувствительных полей
    current_password: Optional[str] = None
    new_password: Optional[str] = Field(None, min_length=8, max_length=128)


@router.get("", response_model=ProfileOut)
async def get_profile(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.patch("", response_model=ProfileOut)
async def update_profile(
    data: ProfileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    sensitive = data.email is not None or data.new_password is not None
    if sensitive:
        if not data.current_password or not verify_password(
            data.current_password, user.hashed_password
        ):
            raise HTTPException(status_code=400, detail="Укажите верный текущий пароль")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    if data.locale is not None:
        user.locale = data.locale
    if data.email is not None:
        exists = await db.execute(
            select(User).where(User.email == data.email, User.id != user.id)
        )
        if exists.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email уже занят")
        user.email = data.email
    if data.new_password:
        err = validate_password(data.new_password)
        if err:
            raise HTTPException(status_code=400, detail=err)
        user.hashed_password = get_password_hash(data.new_password)

    await db.commit()
    await db.refresh(user)
    return user
