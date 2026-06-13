import asyncio
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.instance import FlociInstance, InstanceStatus
from app.services.floci_client import get_client, invalidate_session


async def check_health(instance: FlociInstance, db: AsyncSession) -> InstanceStatus:
    start = datetime.now(UTC)
    try:
        client = get_client(
            instance.id,
            "sts",
            instance.endpoint,
            instance.region,
            instance.access_key,
            instance.secret_key_encrypted,
            instance.tls_verify,
        )
        await asyncio.to_thread(client.get_caller_identity)
        status = InstanceStatus.HEALTHY
    except Exception:
        status = InstanceStatus.UNREACHABLE

    instance.status = status
    instance.last_checked_at = datetime.now(UTC)
    await db.commit()
    return status


async def run_periodic_health_checks(session_factory) -> None:
    while True:
        await asyncio.sleep(60)
        async with session_factory() as db:
            result = await db.execute(select(FlociInstance))
            instances = result.scalars().all()
            tasks = [check_health(inst, db) for inst in instances]
            await asyncio.gather(*tasks, return_exceptions=True)
