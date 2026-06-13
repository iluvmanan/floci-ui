from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireAdmin, RequireSuperadmin
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UsersListResponse

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UsersListResponse, dependencies=[RequireAdmin])
async def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    total = (await db.execute(select(func.count()).select_from(User))).scalar()
    result = await db.execute(select(User).offset(offset).limit(limit).order_by(User.created_at))
    users = result.scalars().all()
    return UsersListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=total,
        page=page,
        pages=ceil(total / limit),
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[RequireAdmin])
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        full_name=body.full_name,
        role=body.role,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse, dependencies=[RequireAdmin])
async def update_user(user_id: UUID, body: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireSuperadmin])
async def delete_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
