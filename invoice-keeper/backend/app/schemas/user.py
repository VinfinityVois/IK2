from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=64)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}