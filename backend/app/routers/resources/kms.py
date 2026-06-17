import base64
from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/kms", tags=["kms"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateKeyRequest(BaseModel):
    description: Optional[str] = None
    key_usage: str = "ENCRYPT_DECRYPT"
    key_spec: str = "SYMMETRIC_DEFAULT"


class CreateAliasRequest(BaseModel):
    alias_name: str
    target_key_id: str


class ScheduleDeletionRequest(BaseModel):
    pending_window_in_days: int = 30


class CryptoRequest(BaseModel):
    data_base64: str


# ─── Keys ─────────────────────────────────────────────────────────────────────

@router.get("/keys", dependencies=[RequireViewer])
async def list_keys(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    resp = client.list_keys()
    result = []
    for k in resp.get("Keys", []):
        d = client.describe_key(KeyId=k["KeyId"])["KeyMetadata"]
        result.append({
            "key_id": d["KeyId"],
            "arn": d.get("Arn", ""),
            "description": d.get("Description", ""),
            "key_usage": d.get("KeyUsage", ""),
            "key_state": d.get("KeyState", ""),
            "creation_date": str(d.get("CreationDate", "")),
            "enabled": d.get("Enabled", False),
        })
    return result


@router.post("/keys", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_key(instance_id: str, body: CreateKeyRequest, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    resp = client.create_key(
        Description=body.description or "",
        KeyUsage=body.key_usage,
        KeySpec=body.key_spec,
    )
    d = resp["KeyMetadata"]
    return {
        "key_id": d["KeyId"],
        "arn": d.get("Arn", ""),
        "key_state": d.get("KeyState", ""),
    }


@router.post("/keys/{key_id}/enable", dependencies=[RequireOperator])
async def enable_key(instance_id: str, key_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    client.enable_key(KeyId=key_id)
    return {"success": True}


@router.post("/keys/{key_id}/disable", dependencies=[RequireOperator])
async def disable_key(instance_id: str, key_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    client.disable_key(KeyId=key_id)
    return {"success": True}


@router.post("/keys/{key_id}/schedule-deletion", dependencies=[RequireOperator])
async def schedule_key_deletion(
    instance_id: str, key_id: str, body: ScheduleDeletionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    resp = client.schedule_key_deletion(
        KeyId=key_id, PendingWindowInDays=body.pending_window_in_days
    )
    return {
        "key_id": resp["KeyId"],
        "deletion_date": str(resp.get("DeletionDate", "")),
    }


@router.post("/keys/{key_id}/cancel-deletion", dependencies=[RequireOperator])
async def cancel_key_deletion(instance_id: str, key_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    client.cancel_key_deletion(KeyId=key_id)
    return {"success": True}


# ─── Aliases ──────────────────────────────────────────────────────────────────

@router.get("/aliases", dependencies=[RequireViewer])
async def list_aliases(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    resp = client.list_aliases()
    return [
        {
            "alias_name": a["AliasName"],
            "alias_arn": a.get("AliasArn", ""),
            "target_key_id": a.get("TargetKeyId", ""),
            "creation_date": str(a.get("CreationDate", "")),
        }
        for a in resp.get("Aliases", [])
    ]


@router.post("/aliases", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_alias(instance_id: str, body: CreateAliasRequest, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    client.create_alias(AliasName=body.alias_name, TargetKeyId=body.target_key_id)
    return {"success": True}


@router.delete("/aliases/{alias_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_alias(instance_id: str, alias_name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    client.delete_alias(AliasName=alias_name)


# ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

@router.post("/keys/{key_id}/encrypt", dependencies=[RequireOperator])
async def encrypt_data(
    instance_id: str, key_id: str, body: CryptoRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    plaintext = base64.b64decode(body.data_base64)
    resp = client.encrypt(KeyId=key_id, Plaintext=plaintext)
    ciphertext_b64 = base64.b64encode(resp["CiphertextBlob"]).decode()
    return {"ciphertext_base64": ciphertext_b64, "key_id": key_id}


@router.post("/keys/{key_id}/decrypt", dependencies=[RequireOperator])
async def decrypt_data(
    instance_id: str, key_id: str, body: CryptoRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "kms")
    ciphertext = base64.b64decode(body.data_base64)
    resp = client.decrypt(CiphertextBlob=ciphertext)
    plaintext_b64 = base64.b64encode(resp["Plaintext"]).decode()
    return {"plaintext_base64": plaintext_b64, "key_id": key_id}
