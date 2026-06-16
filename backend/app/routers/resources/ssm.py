from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/ssm", tags=["ssm"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateParameterRequest(BaseModel):
    name: str
    value: str
    type: str = "String"  # String|StringList|SecureString
    description: Optional[str] = None
    overwrite: bool = False


class UpdateParameterRequest(BaseModel):
    value: str
    description: Optional[str] = None


# ─── Parameters ───────────────────────────────────────────────────────────────

@router.get("/parameters", dependencies=[RequireViewer])
async def list_parameters(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    resp = client.describe_parameters(MaxResults=50)
    return [
        {
            "name": p["Name"],
            "type": p.get("Type", ""),
            "last_modified_date": str(p.get("LastModifiedDate", "")),
            "description": p.get("Description", ""),
            "version": p.get("Version", 0),
            "tier": p.get("Tier", ""),
        }
        for p in resp.get("Parameters", [])
    ]


@router.get("/parameters/by-path", dependencies=[RequireViewer])
async def get_parameters_by_path(
    instance_id: str, path: str = "/", db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    resp = client.get_parameters_by_path(Path=path, Recursive=True, WithDecryption=True)
    return [
        {
            "name": p["Name"],
            "type": p.get("Type", ""),
            "value": p.get("Value", ""),
            "version": p.get("Version", 0),
            "last_modified_date": str(p.get("LastModifiedDate", "")),
        }
        for p in resp.get("Parameters", [])
    ]


@router.post("/parameters", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_parameter(
    instance_id: str, body: CreateParameterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    kwargs: dict = {
        "Name": body.name,
        "Value": body.value,
        "Type": body.type,
        "Overwrite": body.overwrite,
    }
    if body.description:
        kwargs["Description"] = body.description
    resp = client.put_parameter(**kwargs)
    return {"version": resp.get("Version", 0), "tier": resp.get("Tier", "")}


@router.get("/parameters/{name:path}/value", dependencies=[RequireViewer])
async def get_parameter_value(instance_id: str, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    resp = client.get_parameter(Name=name, WithDecryption=True)
    p = resp["Parameter"]
    return {
        "name": p["Name"],
        "type": p.get("Type", ""),
        "value": p.get("Value", ""),
        "version": p.get("Version", 0),
        "last_modified_date": str(p.get("LastModifiedDate", "")),
    }


@router.put("/parameters/{name:path}", dependencies=[RequireOperator])
async def update_parameter(
    instance_id: str, name: str, body: UpdateParameterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    try:
        current = client.get_parameter(Name=name)
        param_type = current["Parameter"].get("Type", "String")
    except Exception:
        param_type = "String"
    kwargs: dict = {
        "Name": name,
        "Value": body.value,
        "Overwrite": True,
        "Type": param_type,
    }
    if body.description:
        kwargs["Description"] = body.description
    resp = client.put_parameter(**kwargs)
    return {"version": resp.get("Version", 0)}


@router.delete("/parameters/{name:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_parameter(instance_id: str, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ssm")
    client.delete_parameter(Name=name)
