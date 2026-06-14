import hashlib
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def get_current_user(
    access_token: Annotated[str | None, Cookie()] = None,
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> User:
    # --- Bearer API key ---
    if authorization and authorization.startswith("Bearer floci_"):
        from app.models.api_key import ApiKey

        raw = authorization.removeprefix("Bearer ")
        key_hash = _hash_key(raw)
        api_key = (await db.execute(
            select(ApiKey).where(ApiKey.key_hash == key_hash)
        )).scalar_one_or_none()

        if not api_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        if api_key.expires_at and api_key.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key expired")

        # Update last_used_at (fire and forget; don't await separately)
        api_key.last_used_at = datetime.now(UTC)
        await db.commit()

        user = (await db.execute(select(User).where(User.id == api_key.user_id))).scalar_one_or_none()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
        return user

    # --- JWT cookie ---
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    def checker(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(r.value for r in roles)}",
            )
        return current_user
    return Depends(checker)


# Convenience role checkers
RequireViewer = require_role(UserRole.VIEWER, UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPERADMIN)
RequireOperator = require_role(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPERADMIN)
RequireAdmin = require_role(UserRole.ADMIN, UserRole.SUPERADMIN)
RequireSuperadmin = require_role(UserRole.SUPERADMIN)
