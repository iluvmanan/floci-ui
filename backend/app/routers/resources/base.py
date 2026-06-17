"""Shared helpers for resource routers."""
from uuid import UUID

import boto3
import botocore.config
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret
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


def get_client_with_region(inst: FlociInstance, service: str, region: str):
    """Build a boto3 client pinned to a specific region, bypassing the cached
    per-instance session (used for services like Pricing that only exist in
    a single AWS region regardless of the instance's configured region)."""
    secret_key = decrypt_secret(inst.secret_key_encrypted)
    session = boto3.Session(
        aws_access_key_id=inst.access_key,
        aws_secret_access_key=secret_key,
        region_name=region,
    )
    return session.client(
        service,
        endpoint_url=inst.endpoint,
        verify=inst.tls_verify,
        config=botocore.config.Config(
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 1},
        ),
    )
