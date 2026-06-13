from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, RequireAdmin, RequireOperator, RequireViewer
from app.core.security import decrypt_secret, encrypt_secret
from app.models.instance import FlociInstance, InstanceStatus
from app.schemas.instance import HealthCheckResponse, InstanceCreate, InstanceResponse, InstanceUpdate
from app.services.floci_client import get_client, invalidate_session
from app.services.instance_service import check_health
import asyncio

router = APIRouter(prefix="/instances", tags=["instances"])


@router.get("", response_model=list[InstanceResponse], dependencies=[RequireViewer])
async def list_instances(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FlociInstance).order_by(FlociInstance.created_at))
    return result.scalars().all()


@router.post("", response_model=InstanceResponse, status_code=status.HTTP_201_CREATED, dependencies=[RequireAdmin])
async def create_instance(
    body: InstanceCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    instance = FlociInstance(
        name=body.name,
        description=body.description,
        endpoint=body.endpoint,
        region=body.region,
        access_key=body.access_key,
        secret_key_encrypted=encrypt_secret(body.secret_key),
        account_id=body.account_id,
        tls_verify=body.tls_verify,
        created_by=current_user.id,
    )
    db.add(instance)
    await db.commit()
    await db.refresh(instance)

    # Trigger initial health check asynchronously
    asyncio.create_task(check_health(instance, db))

    return instance


@router.get("/{instance_id}", response_model=InstanceResponse, dependencies=[RequireViewer])
async def get_instance(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    return instance


@router.put("/{instance_id}", response_model=InstanceResponse, dependencies=[RequireAdmin])
async def update_instance(instance_id: UUID, body: InstanceUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    update_data = body.model_dump(exclude_none=True)
    if "secret_key" in update_data:
        instance.secret_key_encrypted = encrypt_secret(update_data.pop("secret_key"))
    for field, value in update_data.items():
        setattr(instance, field, value)

    invalidate_session(instance_id)
    await db.commit()
    await db.refresh(instance)
    return instance


@router.delete("/{instance_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireAdmin])
async def delete_instance(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")
    invalidate_session(instance_id)
    await db.delete(instance)
    await db.commit()


@router.post("/{instance_id}/health-check", response_model=HealthCheckResponse, dependencies=[RequireOperator])
async def health_check(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    instance = result.scalar_one_or_none()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    start = datetime.now(UTC)
    error = None
    try:
        client = get_client(
            instance_id, "sts",
            instance.endpoint, instance.region,
            instance.access_key, instance.secret_key_encrypted,
            instance.tls_verify,
        )
        await asyncio.to_thread(client.get_caller_identity)
        instance.status = InstanceStatus.HEALTHY
    except Exception as e:
        instance.status = InstanceStatus.UNREACHABLE
        error = str(e)

    latency_ms = (datetime.now(UTC) - start).total_seconds() * 1000
    instance.last_checked_at = datetime.now(UTC)
    await db.commit()

    return HealthCheckResponse(
        status=instance.status.value,
        checked_at=instance.last_checked_at,
        latency_ms=latency_ms,
        error=error,
    )
