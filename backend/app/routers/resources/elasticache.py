from typing import List, Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/elasticache", tags=["elasticache"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateCacheClusterRequest(BaseModel):
    cache_cluster_id: str
    engine: str  # redis|memcached
    cache_node_type: str  # cache.t3.micro etc
    num_cache_nodes: int = 1
    engine_version: Optional[str] = None


class CreateReplicationGroupRequest(BaseModel):
    replication_group_id: str
    description: str
    cache_node_type: str
    num_node_groups: int = 1
    replicas_per_node_group: int = 1


class RebootClusterRequest(BaseModel):
    node_ids: List[str]


# ─── Cache Clusters ───────────────────────────────────────────────────────────

@router.get("/clusters", dependencies=[RequireViewer])
async def list_cache_clusters(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    resp = client.describe_cache_clusters(ShowCacheNodeInfo=True)
    result = []
    for c in resp.get("CacheClusters", []):
        config_ep = c.get("ConfigurationEndpoint", {})
        result.append({
            "cache_cluster_id": c["CacheClusterId"],
            "engine": c.get("Engine", ""),
            "cache_node_type": c.get("CacheNodeType", ""),
            "cache_cluster_status": c.get("CacheClusterStatus", ""),
            "num_cache_nodes": c.get("NumCacheNodes", 0),
            "engine_version": c.get("EngineVersion", ""),
            "cache_cluster_create_time": str(c.get("CacheClusterCreateTime", "")),
            "configuration_endpoint": f"{config_ep.get('Address', '')}:{config_ep.get('Port', '')}" if config_ep else "",
            "replication_group_id": c.get("ReplicationGroupId", ""),
        })
    return result


@router.post("/clusters", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_cache_cluster(
    instance_id: str,
    body: CreateCacheClusterRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    kwargs: dict = {
        "CacheClusterId": body.cache_cluster_id,
        "Engine": body.engine,
        "CacheNodeType": body.cache_node_type,
        "NumCacheNodes": body.num_cache_nodes,
    }
    if body.engine_version:
        kwargs["EngineVersion"] = body.engine_version
    resp = client.create_cache_cluster(**kwargs)
    c = resp["CacheCluster"]
    return {
        "cache_cluster_id": c["CacheClusterId"],
        "cache_cluster_status": c.get("CacheClusterStatus", ""),
    }


@router.delete("/clusters/{cluster_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_cache_cluster(
    instance_id: str,
    cluster_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    client.delete_cache_cluster(CacheClusterId=cluster_id)


@router.post("/clusters/{cluster_id}/reboot", dependencies=[RequireOperator])
async def reboot_cache_cluster(
    instance_id: str,
    cluster_id: str,
    body: RebootClusterRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    client.reboot_cache_cluster(
        CacheClusterId=cluster_id,
        CacheNodeIdsToReboot=body.node_ids,
    )
    return {"success": True}


# ─── Replication Groups ───────────────────────────────────────────────────────

@router.get("/replication-groups", dependencies=[RequireViewer])
async def list_replication_groups(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    resp = client.describe_replication_groups()
    result = []
    for g in resp.get("ReplicationGroups", []):
        node_groups = g.get("NodeGroups", [])
        primary_ep = {}
        if node_groups:
            primary_ep = node_groups[0].get("PrimaryEndpoint", {})
        endpoint_str = f"{primary_ep.get('Address', '')}:{primary_ep.get('Port', '')}" if primary_ep else ""
        result.append({
            "replication_group_id": g["ReplicationGroupId"],
            "description": g.get("Description", ""),
            "status": g.get("Status", ""),
            "member_clusters": g.get("MemberClusters", []),
            "node_groups": endpoint_str,
            "automatic_failover": g.get("AutomaticFailover", ""),
        })
    return result


@router.post("/replication-groups", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_replication_group(
    instance_id: str,
    body: CreateReplicationGroupRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    resp = client.create_replication_group(
        ReplicationGroupId=body.replication_group_id,
        ReplicationGroupDescription=body.description,
        CacheNodeType=body.cache_node_type,
        NumNodeGroups=body.num_node_groups,
        ReplicasPerNodeGroup=body.replicas_per_node_group,
    )
    g = resp["ReplicationGroup"]
    return {
        "replication_group_id": g["ReplicationGroupId"],
        "status": g.get("Status", ""),
    }


@router.delete("/replication-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_replication_group(
    instance_id: str,
    group_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elasticache")
    client.delete_replication_group(ReplicationGroupId=group_id)
