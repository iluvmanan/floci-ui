from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/tagging", tags=["tagging"])


# ─── Request Models ───────────────────────────────────────────────────────────

class TagResourcesRequest(BaseModel):
    resource_arns: List[str]
    tags: Dict[str, str]


class UntagResourcesRequest(BaseModel):
    resource_arns: List[str]
    tag_keys: List[str]


# ─── Resources ────────────────────────────────────────────────────────────────

@router.get("/resources", dependencies=[RequireViewer])
async def get_resources(
    instance_id,
    tag_key: Optional[str] = Query(default=None),
    tag_value: Optional[str] = Query(default=None),
    resource_type: Optional[str] = Query(default=None, description="Comma-separated resource type filters"),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "resourcegroupstaggingapi")
    kwargs: dict = {}
    if tag_key:
        tag_filter: dict = {"Key": tag_key}
        if tag_value:
            tag_filter["Values"] = [tag_value]
        kwargs["TagFilters"] = [tag_filter]
    if resource_type:
        kwargs["ResourceTypeFilters"] = [r.strip() for r in resource_type.split(",") if r.strip()]
    resp = client.get_resources(**kwargs)
    return [
        {
            "resource_arn": r["ResourceARN"],
            "tags": [{"Key": t["Key"], "Value": t["Value"]} for t in r.get("Tags", [])],
        }
        for r in resp.get("ResourceTagMappingList", [])
    ]


@router.get("/tag-keys", dependencies=[RequireViewer])
async def get_tag_keys(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "resourcegroupstaggingapi")
    resp = client.get_tag_keys()
    return [t["Key"] for t in resp.get("TagKeys", [])]


@router.get("/tag-values/{key}", dependencies=[RequireViewer])
async def get_tag_values(instance_id, key: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "resourcegroupstaggingapi")
    resp = client.get_tag_values(Key=key)
    return resp.get("TagValues", [])


@router.post("/resources/tag", dependencies=[RequireOperator])
async def tag_resources(
    instance_id, body: TagResourcesRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "resourcegroupstaggingapi")
    resp = client.tag_resources(ResourceARNList=body.resource_arns, Tags=body.tags)
    return {"failed_resources_map": resp.get("FailedResourcesMap", {})}


@router.post("/resources/untag", dependencies=[RequireOperator])
async def untag_resources(
    instance_id, body: UntagResourcesRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "resourcegroupstaggingapi")
    resp = client.untag_resources(ResourceARNList=body.resource_arns, TagKeys=body.tag_keys)
    return {"failed_resources_map": resp.get("FailedResourcesMap", {})}
