"""Shared helpers for resource routers."""
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instance import FlociInstance
from app.services.floci_client import get_client as _get_client


async def get_instance(instance_id: UUID, db: AsyncSession) -> FlociInstance:
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(status_code=404, detail="Instance not found")
    return inst


def get_client(inst: FlociInstance, service: str):
    return _get_client(
        instance_id=inst.id,
        service_name=service,
        endpoint=inst.endpoint,
        region=inst.region,
        access_key=inst.access_key,
        secret_key_encrypted=inst.secret_key_encrypted,
        tls_verify=inst.tls_verify,
    )
