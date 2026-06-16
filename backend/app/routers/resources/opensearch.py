from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/opensearch", tags=["opensearch"])


# ─── Request Models ───────────────────────────────────────────────────────────

class ClusterConfig(BaseModel):
    instance_type: Optional[str] = "t3.small.search"
    instance_count: Optional[int] = 1


class CreateDomainRequest(BaseModel):
    domain_name: str
    engine_version: Optional[str] = "OpenSearch_2.11"
    cluster_config: Optional[ClusterConfig] = None
    volume_size_gb: Optional[int] = 10


def _domain_summary(d: dict) -> dict:
    return {
        "domain_name": d.get("DomainName", ""),
        "arn": d.get("ARN", ""),
        "created": d.get("Created", False),
        "deleted": d.get("Deleted", False),
        "endpoint": d.get("Endpoint", ""),
        "processing": d.get("Processing", False),
        "engine_version": d.get("EngineVersion", ""),
        "cluster_config": d.get("ClusterConfig", {}),
        "ebs_options": d.get("EBSOptions", {}),
    }


# ─── Domains ──────────────────────────────────────────────────────────────────

@router.get("/domains", dependencies=[RequireViewer])
async def list_domains(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "opensearch")
    names_resp = client.list_domain_names()
    names = [d["DomainName"] for d in names_resp.get("DomainNames", [])]
    if not names:
        return []
    resp = client.describe_domains(DomainNames=names)
    return [_domain_summary(d) for d in resp.get("DomainStatusList", [])]


@router.post("/domains", status_code=201, dependencies=[RequireOperator])
async def create_domain(
    instance_id, body: CreateDomainRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "opensearch")
    cc = body.cluster_config or ClusterConfig()
    resp = client.create_domain(
        DomainName=body.domain_name,
        EngineVersion=body.engine_version,
        ClusterConfig={
            "InstanceType": cc.instance_type,
            "InstanceCount": cc.instance_count,
        },
        EBSOptions={
            "EBSEnabled": True,
            "VolumeType": "gp3",
            "VolumeSize": body.volume_size_gb,
        },
    )
    domain_status = resp.get("DomainStatus", {})
    return {
        "domain_status": {
            "arn": domain_status.get("ARN", ""),
            "created": domain_status.get("Created", False),
        }
    }


@router.delete("/domains/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_domain(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "opensearch")
    client.delete_domain(DomainName=name)


@router.get("/domains/{name}", dependencies=[RequireViewer])
async def describe_domain(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "opensearch")
    resp = client.describe_domain(DomainName=name)
    d = resp["DomainStatus"]
    return {
        "domain_name": d.get("DomainName", ""),
        "arn": d.get("ARN", ""),
        "created": d.get("Created", False),
        "deleted": d.get("Deleted", False),
        "endpoint": d.get("Endpoint", ""),
        "processing": d.get("Processing", False),
        "engine_version": d.get("EngineVersion", ""),
        "cluster_config": d.get("ClusterConfig", {}),
        "ebs_options": d.get("EBSOptions", {}),
        "access_policies": d.get("AccessPolicies", ""),
    }
