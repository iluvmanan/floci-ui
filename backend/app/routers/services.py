from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
from app.models.instance import FlociInstance
from app.services.service_catalog import SERVICE_CATALOG, get_service

router = APIRouter(prefix="/instances/{instance_id}/services", tags=["services"])


class ServiceToggle(BaseModel):
    enabled: bool


class BatchToggleItem(BaseModel):
    name: str
    enabled: bool


class BatchToggle(BaseModel):
    services: list[BatchToggleItem]


async def _get_instance(instance_id: UUID, db: AsyncSession) -> FlociInstance:
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


def _build_service_response(svc_def, enabled: bool) -> dict:
    return {
        "name": svc_def.name,
        "display_name": svc_def.display_name,
        "category": svc_def.category,
        "description": svc_def.description,
        "operation_count": svc_def.operation_count,
        "env_key": svc_def.env_key,
        "enabled": enabled,
        "status": "unknown",
        "status_checked_at": None,
    }


def _get_service_enabled(inst: FlociInstance, env_key: str) -> bool:
    """Read enabled flag from instance config, defaulting to True."""
    services_config = (inst.config or {}).get("services", {})
    return bool(services_config.get(env_key, True))


def _set_service_enabled(inst: FlociInstance, env_key: str, enabled: bool) -> None:
    """Write enabled flag into instance config."""
    # Deep-copy the nested 'services' dict so SQLAlchemy detects the change
    # (shallow copy causes the nested dict to be mutated before reassignment,
    #  making the old and new values appear equal to SQLAlchemy's comparator)
    outer = dict(inst.config or {})
    inner = dict(outer.get("services", {}))
    inner[env_key] = enabled
    outer["services"] = inner
    inst.config = outer


@router.get("", dependencies=[RequireViewer])
async def list_services(
    instance_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    services = [
        _build_service_response(svc, _get_service_enabled(inst, svc.env_key))
        for svc in SERVICE_CATALOG
    ]
    return {"services": services}


@router.put("/batch", dependencies=[RequireOperator])
async def batch_toggle_services(
    instance_id: UUID,
    body: BatchToggle,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    for item in body.services:
        svc_def = get_service(item.name)
        if svc_def:
            _set_service_enabled(inst, svc_def.env_key, item.enabled)
    await db.commit()
    await db.refresh(inst)
    services = [
        _build_service_response(svc, _get_service_enabled(inst, svc.env_key))
        for svc in SERVICE_CATALOG
    ]
    return {"services": services}


@router.put("/{service_name}", dependencies=[RequireOperator])
async def toggle_service(
    instance_id: UUID,
    service_name: str,
    body: ServiceToggle,
    db: AsyncSession = Depends(get_db),
):
    inst = await _get_instance(instance_id, db)
    svc_def = get_service(service_name)
    if not svc_def:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    _set_service_enabled(inst, svc_def.env_key, body.enabled)
    await db.commit()
    return _build_service_response(svc_def, body.enabled)
