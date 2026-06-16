from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/rds", tags=["rds"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateDBInstanceRequest(BaseModel):
    db_instance_identifier: str
    db_instance_class: str  # db.t3.micro etc
    engine: str  # postgres|mysql|mariadb
    engine_version: Optional[str] = None
    allocated_storage: int = 20
    master_username: str
    master_password: str
    db_name: Optional[str] = None
    multi_az: bool = False
    publicly_accessible: bool = False


class CreateSnapshotRequest(BaseModel):
    snapshot_identifier: str


# ─── DB Instances ─────────────────────────────────────────────────────────────

@router.get("/instances")
async def list_rds_instances(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    resp = client.describe_db_instances()
    result = []
    for i in resp.get("DBInstances", []):
        endpoint = i.get("Endpoint", {})
        result.append({
            "db_instance_identifier": i["DBInstanceIdentifier"],
            "db_instance_class": i.get("DBInstanceClass", ""),
            "engine": i.get("Engine", ""),
            "engine_version": i.get("EngineVersion", ""),
            "db_instance_status": i.get("DBInstanceStatus", ""),
            "endpoint_address": endpoint.get("Address", ""),
            "endpoint_port": endpoint.get("Port"),
            "allocated_storage": i.get("AllocatedStorage", 0),
            "multi_az": i.get("MultiAZ", False),
            "publicly_accessible": i.get("PubliclyAccessible", False),
            "instance_create_time": str(i.get("InstanceCreateTime", "")),
            "master_username": i.get("MasterUsername", ""),
        })
    return result


@router.post("/instances", status_code=status.HTTP_201_CREATED)
async def create_rds_instance(
    instance_id: str,
    body: CreateDBInstanceRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    kwargs: dict = {
        "DBInstanceIdentifier": body.db_instance_identifier,
        "DBInstanceClass": body.db_instance_class,
        "Engine": body.engine,
        "AllocatedStorage": body.allocated_storage,
        "MasterUsername": body.master_username,
        "MasterUserPassword": body.master_password,
        "MultiAZ": body.multi_az,
        "PubliclyAccessible": body.publicly_accessible,
    }
    if body.engine_version:
        kwargs["EngineVersion"] = body.engine_version
    if body.db_name:
        kwargs["DBName"] = body.db_name
    resp = client.create_db_instance(**kwargs)
    i = resp["DBInstance"]
    return {
        "db_instance_identifier": i["DBInstanceIdentifier"],
        "db_instance_status": i.get("DBInstanceStatus", ""),
    }


@router.post("/instances/{db_id}/start")
async def start_rds_instance(
    instance_id: str,
    db_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    client.start_db_instance(DBInstanceIdentifier=db_id)
    return {"success": True}


@router.post("/instances/{db_id}/stop")
async def stop_rds_instance(
    instance_id: str,
    db_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    client.stop_db_instance(DBInstanceIdentifier=db_id)
    return {"success": True}


@router.delete("/instances/{db_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rds_instance(
    instance_id: str,
    db_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    client.delete_db_instance(
        DBInstanceIdentifier=db_id,
        SkipFinalSnapshot=True,
        DeleteAutomatedBackups=True,
    )


# ─── Snapshots ────────────────────────────────────────────────────────────────

@router.get("/snapshots")
async def list_rds_snapshots(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    resp = client.describe_db_snapshots()
    return [
        {
            "db_snapshot_identifier": s["DBSnapshotIdentifier"],
            "db_instance_identifier": s.get("DBInstanceIdentifier", ""),
            "status": s.get("Status", ""),
            "engine": s.get("Engine", ""),
            "allocated_storage": s.get("AllocatedStorage", 0),
            "snapshot_create_time": str(s.get("SnapshotCreateTime", "")),
            "percent_progress": s.get("PercentProgress", 0),
        }
        for s in resp.get("DBSnapshots", [])
    ]


@router.post("/instances/{db_id}/snapshots", status_code=status.HTTP_201_CREATED)
async def create_rds_snapshot(
    instance_id: str,
    db_id: str,
    body: CreateSnapshotRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    resp = client.create_db_snapshot(
        DBSnapshotIdentifier=body.snapshot_identifier,
        DBInstanceIdentifier=db_id,
    )
    s = resp["DBSnapshot"]
    return {
        "snapshot_identifier": s["DBSnapshotIdentifier"],
        "status": s.get("Status", ""),
    }


# ─── Clusters ─────────────────────────────────────────────────────────────────

@router.get("/clusters")
async def list_rds_clusters(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "rds")
    resp = client.describe_db_clusters()
    return [
        {
            "db_cluster_identifier": c["DBClusterIdentifier"],
            "engine": c.get("Engine", ""),
            "status": c.get("Status", ""),
            "endpoint": c.get("Endpoint", ""),
            "reader_endpoint": c.get("ReaderEndpoint", ""),
            "allocated_storage": c.get("AllocatedStorage", 0),
            "db_cluster_members": [m["DBInstanceIdentifier"] for m in c.get("DBClusterMembers", [])],
        }
        for c in resp.get("DBClusters", [])
    ]
