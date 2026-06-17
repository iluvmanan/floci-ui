from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/eks", tags=["eks"])


# ─── Request Models ───────────────────────────────────────────────────────────

class VpcConfig(BaseModel):
    subnet_ids: List[str]
    security_group_ids: Optional[List[str]] = None
    endpoint_public_access: Optional[bool] = True
    endpoint_private_access: Optional[bool] = False


class CreateClusterRequest(BaseModel):
    name: str
    version: Optional[str] = None
    role_arn: str
    resources_vpc_config: VpcConfig


class ScalingConfig(BaseModel):
    min_size: int
    max_size: int
    desired_size: int


class CreateNodegroupRequest(BaseModel):
    nodegroup_name: str
    node_role: str
    subnets: List[str]
    instance_types: Optional[List[str]] = None
    scaling_config: ScalingConfig
    ami_type: Optional[str] = "AL2_x86_64"
    disk_size: Optional[int] = 20
    capacity_type: Optional[str] = "ON_DEMAND"


class UpdateNodegroupScalingRequest(BaseModel):
    scaling_config: ScalingConfig


# ─── Clusters ─────────────────────────────────────────────────────────────────

@router.get("/clusters", dependencies=[RequireViewer])
async def list_clusters(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    names = client.list_clusters().get("clusters", [])
    result = []
    for name in names:
        resp = client.describe_cluster(name=name)
        c = resp["cluster"]
        result.append({
            "name": c["name"],
            "arn": c.get("arn", ""),
            "status": c.get("status", ""),
            "kubernetes_version": c.get("version", ""),
            "endpoint": c.get("endpoint", ""),
            "role_arn": c.get("roleArn", ""),
            "resources_vpc_config": c.get("resourcesVpcConfig", {}),
            "created_at": str(c.get("createdAt", "")),
            "tags": c.get("tags", {}),
        })
    return result


@router.post("/clusters", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_cluster(
    instance_id, body: CreateClusterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    vpc_config: dict = {"subnetIds": body.resources_vpc_config.subnet_ids}
    if body.resources_vpc_config.security_group_ids:
        vpc_config["securityGroupIds"] = body.resources_vpc_config.security_group_ids
    if body.resources_vpc_config.endpoint_public_access is not None:
        vpc_config["endpointPublicAccess"] = body.resources_vpc_config.endpoint_public_access
    if body.resources_vpc_config.endpoint_private_access is not None:
        vpc_config["endpointPrivateAccess"] = body.resources_vpc_config.endpoint_private_access

    kwargs: dict = {
        "name": body.name,
        "roleArn": body.role_arn,
        "resourcesVpcConfig": vpc_config,
    }
    if body.version:
        kwargs["version"] = body.version
    resp = client.create_cluster(**kwargs)
    c = resp["cluster"]
    return {"name": c["name"], "status": c.get("status", "")}


@router.delete("/clusters/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_cluster(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    client.delete_cluster(name=name)


@router.get("/clusters/{name}", dependencies=[RequireViewer])
async def describe_cluster(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    resp = client.describe_cluster(name=name)
    return resp["cluster"]


# ─── Node Groups ──────────────────────────────────────────────────────────────

@router.get("/clusters/{name}/nodegroups", dependencies=[RequireViewer])
async def list_nodegroups(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    names = client.list_nodegroups(clusterName=name).get("nodegroups", [])
    result = []
    for ng_name in names:
        resp = client.describe_nodegroup(clusterName=name, nodegroupName=ng_name)
        ng = resp["nodegroup"]
        result.append({
            "nodegroup_name": ng["nodegroupName"],
            "status": ng.get("status", ""),
            "capacity_type": ng.get("capacityType", ""),
            "instance_types": ng.get("instanceTypes", []),
            "scaling_config": ng.get("scalingConfig", {}),
            "ami_type": ng.get("amiType", ""),
            "disk_size": ng.get("diskSize", 0),
            "created_at": str(ng.get("createdAt", "")),
        })
    return result


@router.post("/clusters/{name}/nodegroups", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_nodegroup(
    instance_id, name: str, body: CreateNodegroupRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    kwargs: dict = {
        "clusterName": name,
        "nodegroupName": body.nodegroup_name,
        "nodeRole": body.node_role,
        "subnets": body.subnets,
        "scalingConfig": {
            "minSize": body.scaling_config.min_size,
            "maxSize": body.scaling_config.max_size,
            "desiredSize": body.scaling_config.desired_size,
        },
    }
    if body.instance_types:
        kwargs["instanceTypes"] = body.instance_types
    if body.ami_type:
        kwargs["amiType"] = body.ami_type
    if body.disk_size:
        kwargs["diskSize"] = body.disk_size
    if body.capacity_type:
        kwargs["capacityType"] = body.capacity_type
    resp = client.create_nodegroup(**kwargs)
    ng = resp["nodegroup"]
    return {"nodegroup_name": ng["nodegroupName"], "status": ng.get("status", "")}


@router.delete(
    "/clusters/{name}/nodegroups/{ng}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_nodegroup(instance_id, name: str, ng: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    client.delete_nodegroup(clusterName=name, nodegroupName=ng)


@router.put("/clusters/{name}/nodegroups/{ng}", dependencies=[RequireOperator])
async def update_nodegroup_scaling(
    instance_id, name: str, ng: str, body: UpdateNodegroupScalingRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "eks")
    resp = client.update_nodegroup_config(
        clusterName=name,
        nodegroupName=ng,
        scalingConfig={
            "minSize": body.scaling_config.min_size,
            "maxSize": body.scaling_config.max_size,
            "desiredSize": body.scaling_config.desired_size,
        },
    )
    update = resp.get("update", {})
    return {"update": {"id": update.get("id", ""), "status": update.get("status", "")}}
