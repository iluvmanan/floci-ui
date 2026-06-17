from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/neptune", tags=["neptune"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateClusterRequest(BaseModel):
    cluster_identifier: str
    engine_version: Optional[str] = None
    availability_zones: Optional[List[str]] = None


class CreateInstanceRequest(BaseModel):
    db_instance_identifier: str
    db_instance_class: str
    cluster_identifier: str


# ─── Clusters ─────────────────────────────────────────────────────────────────

@router.get("/clusters", dependencies=[RequireViewer])
async def list_neptune_clusters(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    resp = client.describe_db_clusters()
    clusters = [c for c in resp.get("DBClusters", []) if c.get("Engine") == "neptune"]
    if not clusters:
        clusters = resp.get("DBClusters", [])
    return [
        {
            "cluster_identifier": c["DBClusterIdentifier"],
            "status": c.get("Status", ""),
            "engine": c.get("Engine", ""),
            "engine_version": c.get("EngineVersion", ""),
            "endpoint": c.get("Endpoint", ""),
            "reader_endpoint": c.get("ReaderEndpoint", ""),
            "port": c.get("Port"),
            "create_time": str(c.get("ClusterCreateTime", "")),
        }
        for c in clusters
    ]


@router.post("/clusters", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_neptune_cluster(
    instance_id: str, body: CreateClusterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    kwargs: dict = {
        "DBClusterIdentifier": body.cluster_identifier,
        "Engine": "neptune",
    }
    if body.engine_version:
        kwargs["EngineVersion"] = body.engine_version
    if body.availability_zones:
        kwargs["AvailabilityZones"] = body.availability_zones
    resp = client.create_db_cluster(**kwargs)
    c = resp["DBCluster"]
    return {
        "cluster_identifier": c["DBClusterIdentifier"],
        "status": c.get("Status", ""),
    }


@router.delete("/clusters/{cluster_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_neptune_cluster(
    instance_id: str, cluster_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    client.delete_db_cluster(DBClusterIdentifier=cluster_id, SkipFinalSnapshot=True)


# ─── Instances ────────────────────────────────────────────────────────────────

@router.get("/instances", dependencies=[RequireViewer])
async def list_neptune_instances(instance_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    resp = client.describe_db_instances()
    instances = [i for i in resp.get("DBInstances", []) if i.get("Engine") == "neptune"]
    if not instances:
        instances = resp.get("DBInstances", [])
    result = []
    for i in instances:
        endpoint = i.get("Endpoint", {})
        result.append({
            "db_instance_identifier": i["DBInstanceIdentifier"],
            "db_instance_class": i.get("DBInstanceClass", ""),
            "status": i.get("DBInstanceStatus", ""),
            "cluster_identifier": i.get("DBClusterIdentifier", ""),
            "endpoint_address": endpoint.get("Address", ""),
            "endpoint_port": endpoint.get("Port"),
            "create_time": str(i.get("InstanceCreateTime", "")),
        })
    return result


@router.post("/instances", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_neptune_instance(
    instance_id: str, body: CreateInstanceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    resp = client.create_db_instance(
        DBInstanceIdentifier=body.db_instance_identifier,
        DBInstanceClass=body.db_instance_class,
        Engine="neptune",
        DBClusterIdentifier=body.cluster_identifier,
    )
    i = resp["DBInstance"]
    return {
        "db_instance_identifier": i["DBInstanceIdentifier"],
        "status": i.get("DBInstanceStatus", ""),
    }


@router.delete("/instances/{instance_id_param}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_neptune_instance(
    instance_id: str, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "neptune")
    client.delete_db_instance(DBInstanceIdentifier=instance_id_param, SkipFinalSnapshot=True)
