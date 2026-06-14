import csv
import io
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireAdmin
from app.models.audit import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", dependencies=[RequireAdmin])
async def list_audit(
    instance_id: UUID | None = None,
    user_email: str | None = None,
    action: str | None = None,
    limit: int = Query(50, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc())
    if instance_id:
        q = q.where(AuditLog.instance_id == instance_id)
    if user_email:
        q = q.where(AuditLog.user_email == user_email)
    if action:
        q = q.where(AuditLog.action == action)

    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar() or 0
    rows = (await db.execute(q.offset(offset).limit(limit))).scalars().all()

    return {
        "items": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "user_email": r.user_email,
                "instance_id": str(r.instance_id) if r.instance_id else None,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "ip_address": r.ip_address,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/export", dependencies=[RequireAdmin])
async def export_audit_csv(
    instance_id: UUID | None = None,
    action: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(10000)
    if instance_id:
        q = q.where(AuditLog.instance_id == instance_id)
    if action:
        q = q.where(AuditLog.action == action)

    rows = (await db.execute(q)).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "created_at", "user_email", "action", "instance_id", "resource_type", "ip_address"])
    for r in rows:
        writer.writerow([
            str(r.id), r.created_at.isoformat(), r.user_email or "",
            r.action, str(r.instance_id) if r.instance_id else "",
            r.resource_type or "", r.ip_address or "",
        ])

    buf.seek(0)
    filename = f"audit_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
