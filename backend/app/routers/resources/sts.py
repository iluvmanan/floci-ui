from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/sts", tags=["sts"])


# ─── Request Models ───────────────────────────────────────────────────────────

class AssumeRoleRequest(BaseModel):
    role_arn: str
    role_session_name: str
    duration_seconds: int = 3600
    external_id: Optional[str] = None


class FederationTokenRequest(BaseModel):
    name: str
    duration_seconds: int = 3600


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/caller-identity", dependencies=[RequireViewer])
async def get_caller_identity(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "sts")
    resp = client.get_caller_identity()
    return {
        "account": resp.get("Account", ""),
        "user_id": resp.get("UserId", ""),
        "arn": resp.get("Arn", ""),
    }


@router.post("/assume-role", dependencies=[RequireOperator])
async def assume_role(
    instance_id: str, body: AssumeRoleRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "sts")
    kwargs: dict = {
        "RoleArn": body.role_arn,
        "RoleSessionName": body.role_session_name,
        "DurationSeconds": body.duration_seconds,
    }
    if body.external_id:
        kwargs["ExternalId"] = body.external_id
    resp = client.assume_role(**kwargs)
    creds = resp["Credentials"]
    return {
        "access_key_id": creds["AccessKeyId"],
        "secret_access_key": creds["SecretAccessKey"],
        "session_token": creds["SessionToken"],
        "expiration": str(creds.get("Expiration", "")),
    }


@router.post("/federation-token", dependencies=[RequireOperator])
async def get_federation_token(
    instance_id: str, body: FederationTokenRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "sts")
    resp = client.get_federation_token(Name=body.name, DurationSeconds=body.duration_seconds)
    creds = resp["Credentials"]
    return {
        "access_key_id": creds["AccessKeyId"],
        "secret_access_key": creds["SecretAccessKey"],
        "session_token": creds["SessionToken"],
        "expiration": str(creds.get("Expiration", "")),
        "federated_user_arn": resp.get("FederatedUser", {}).get("Arn", ""),
    }
