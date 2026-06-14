import hashlib
import secrets
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.api_key import ApiKey

router = APIRouter(prefix="/api-keys", tags=["api-keys"])

PREFIX = "floci_"


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class ApiKeyCreate(BaseModel):
    name: str
    scopes: list[str] = []
    expires_at: datetime | None = None


@router.post("", status_code=201)
async def create_api_key(
    body: ApiKeyCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    raw = PREFIX + secrets.token_urlsafe(32)
    key = ApiKey(
        user_id=current_user.id,
        name=body.name,
        key_hash=_hash_key(raw),
        scopes=body.scopes,
        expires_at=body.expires_at,
    )
    db.add(key)
    await db.commit()
    await db.refresh(key)

    return {
        "id": str(key.id),
        "name": key.name,
        "scopes": key.scopes,
        "expires_at": key.expires_at.isoformat() if key.expires_at else None,
        "created_at": key.created_at.isoformat(),
        "key": raw,  # shown once only
    }


@router.get("")
async def list_api_keys(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(ApiKey).where(ApiKey.user_id == current_user.id).order_by(ApiKey.created_at.desc())
    )).scalars().all()

    return [
        {
            "id": str(k.id),
            "name": k.name,
            "scopes": k.scopes,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "expires_at": k.expires_at.isoformat() if k.expires_at else None,
            "created_at": k.created_at.isoformat(),
        }
        for k in rows
    ]


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(key_id: UUID, current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    key = (await db.execute(
        select(ApiKey).where(ApiKey.id == key_id)
    )).scalar_one_or_none()

    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    if key.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your key")

    await db.delete(key)
    await db.commit()
