from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.user import UserRole


class UserCreate(BaseModel):
    email: str
    full_name: str | None = None
    role: UserRole = UserRole.VIEWER
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UsersListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    pages: int
