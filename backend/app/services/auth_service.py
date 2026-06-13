from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole


async def authenticate_user(email: str, password: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.email == email, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


async def seed_superadmin(email: str, password: str, db: AsyncSession) -> None:
    count_result = await db.execute(select(func.count()).select_from(User))
    count = count_result.scalar()
    if count == 0:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name="Super Admin",
            role=UserRole.SUPERADMIN,
        )
        db.add(user)
        await db.commit()
