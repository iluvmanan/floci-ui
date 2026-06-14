from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireAdmin, RequireViewer
from app.models.instance import FlociInstance
from app.schemas.config import (
    flatten_config,
    merge_with_defaults,
    to_docker_compose_env,
    to_env_file,
)

router = APIRouter(prefix="/instances/{instance_id}/config", tags=["config"])


async def _get_instance(instance_id: UUID, db: AsyncSession) -> FlociInstance:
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


@router.get("", dependencies=[RequireViewer])
async def get_config(
    instance_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    return merge_with_defaults(inst.config or {})


@router.put("", dependencies=[RequireAdmin])
async def update_config(
    instance_id: UUID,
    updates: dict,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    stored = dict(inst.config or {})
    for group, values in updates.items():
        if group not in stored:
            stored[group] = {}
        stored[group].update(values)
    inst.config = stored
    await db.commit()
    await db.refresh(inst)
    return merge_with_defaults(inst.config)


@router.post("/reset", dependencies=[RequireAdmin])
async def reset_config(
    instance_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    inst.config = {}
    await db.commit()
    return merge_with_defaults({})


@router.get("/export", dependencies=[RequireViewer])
async def export_config(
    instance_id: UUID,
    format: str = Query(..., description="Export format: env, docker-compose, or json"),
    db: AsyncSession = Depends(get_db),
):
    if format not in ("env", "docker-compose", "json"):
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid export format", "code": "EXPORT_FORMAT_INVALID"},
        )
    inst = await _get_instance(instance_id, db)
    grouped = merge_with_defaults(inst.config or {})

    if format == "json":
        return JSONResponse(content=flatten_config(grouped))
    if format == "env":
        return PlainTextResponse(to_env_file(grouped), media_type="text/plain")
    return PlainTextResponse(to_docker_compose_env(grouped), media_type="text/plain")
