from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer
from app.models.instance import FlociInstance
from app.models.user import User

router = APIRouter(prefix="/system", tags=["system"])

_started_at = datetime.now(UTC)


@router.get("/health")
async def health(db: AsyncSession = Depends(get_db)):
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "version": "0.1.0",
        "uptime_s": int((datetime.now(UTC) - _started_at).total_seconds()),
    }


@router.get("/info", dependencies=[RequireViewer])
async def info(db: AsyncSession = Depends(get_db)):
    user_count = (await db.execute(select(func.count()).select_from(User))).scalar()
    instance_count = (await db.execute(select(func.count()).select_from(FlociInstance))).scalar()
    return {
        "version": "0.1.0",
        "started_at": _started_at.isoformat(),
        "uptime_s": int((datetime.now(UTC) - _started_at).total_seconds()),
        "user_count": user_count,
        "instance_count": instance_count,
    }
