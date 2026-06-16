from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/secrets", tags=["secrets"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateSecretRequest(BaseModel):
    name: str
    secret_string: Optional[str] = None
    description: Optional[str] = None
    kms_key_id: Optional[str] = None


class UpdateSecretRequest(BaseModel):
    secret_string: Optional[str] = None
    description: Optional[str] = None


class RotateSecretRequest(BaseModel):
    rotation_lambda_arn: Optional[str] = None
    automatically_after_days: Optional[int] = None


# ─── Secrets ──────────────────────────────────────────────────────────────────

@router.get("/secrets", dependencies=[RequireViewer])
async def list_secrets(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    resp = client.list_secrets()
    return [
        {
            "arn": s["ARN"],
            "name": s["Name"],
            "description": s.get("Description", ""),
            "last_rotated_date": str(s["LastRotatedDate"]) if s.get("LastRotatedDate") else None,
            "rotation_enabled": s.get("RotationEnabled", False),
            "created_date": str(s.get("CreatedDate", "")),
            "last_changed_date": str(s.get("LastChangedDate", "")),
        }
        for s in resp.get("SecretList", [])
    ]


@router.post("/secrets", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_secret(
    instance_id: str, body: CreateSecretRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    kwargs: dict = {
        "Name": body.name,
        "SecretString": body.secret_string or "",
        "Description": body.description or "",
    }
    if body.kms_key_id:
        kwargs["KmsKeyId"] = body.kms_key_id
    resp = client.create_secret(**kwargs)
    return {"arn": resp["ARN"], "name": resp["Name"]}


@router.get("/secrets/{name}", dependencies=[RequireViewer])
async def describe_secret(instance_id: str, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    resp = client.describe_secret(SecretId=name)
    return {
        "arn": resp["ARN"],
        "name": resp["Name"],
        "description": resp.get("Description", ""),
        "rotation_enabled": resp.get("RotationEnabled", False),
        "last_rotated_date": str(resp["LastRotatedDate"]) if resp.get("LastRotatedDate") else None,
        "tags": resp.get("Tags", []),
        "created_date": str(resp.get("CreatedDate", "")),
    }


@router.get("/secrets/{name}/value", dependencies=[RequireViewer])
async def get_secret_value(instance_id: str, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    resp = client.get_secret_value(SecretId=name)
    return {
        "secret_string": resp.get("SecretString", ""),
        "version_id": resp.get("VersionId", ""),
        "created_date": str(resp.get("CreatedDate", "")),
    }


@router.put("/secrets/{name}", dependencies=[RequireOperator])
async def update_secret(
    instance_id: str, name: str, body: UpdateSecretRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    kwargs: dict = {"SecretId": name}
    if body.secret_string is not None:
        kwargs["SecretString"] = body.secret_string
    if body.description is not None:
        kwargs["Description"] = body.description
    resp = client.update_secret(**kwargs)
    return {
        "arn": resp["ARN"],
        "name": resp["Name"],
        "version_id": resp.get("VersionId", ""),
    }


@router.delete("/secrets/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_secret(instance_id: str, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    client.delete_secret(SecretId=name, ForceDeleteWithoutRecovery=True)


@router.post("/secrets/{name}/rotate", dependencies=[RequireOperator])
async def rotate_secret(
    instance_id: str, name: str, body: RotateSecretRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "secretsmanager")
    kwargs: dict = {"SecretId": name}
    if body.rotation_lambda_arn:
        kwargs["RotationLambdaARN"] = body.rotation_lambda_arn
    if body.automatically_after_days:
        kwargs["RotationRules"] = {"AutomaticallyAfterDays": body.automatically_after_days}
    resp = client.rotate_secret(**kwargs)
    return {"arn": resp["ARN"], "name": resp["Name"]}
