from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/ecs", tags=["ecs"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateClusterRequest(BaseModel):
    cluster_name: str
    capacity_providers: Optional[List[str]] = None


class CreateServiceRequest(BaseModel):
    service_name: str
    task_definition: str
    desired_count: int
    launch_type: Optional[str] = "FARGATE"  # FARGATE|EC2
    network_configuration: Optional[dict] = None


class UpdateServiceRequest(BaseModel):
    desired_count: Optional[int] = None
    task_definition: Optional[str] = None


class RunTaskRequest(BaseModel):
    task_definition: str
    count: Optional[int] = 1
    launch_type: Optional[str] = "FARGATE"
    network_configuration: Optional[dict] = None


class StopTaskRequest(BaseModel):
    reason: Optional[str] = None


class RegisterTaskDefRequest(BaseModel):
    family: str
    container_definitions: List[dict]
    requires_compatibilities: Optional[List[str]] = None
    cpu: Optional[str] = None
    memory: Optional[str] = None
    network_mode: Optional[str] = None
    task_role_arn: Optional[str] = None
    execution_role_arn: Optional[str] = None


# ─── Clusters ─────────────────────────────────────────────────────────────────

@router.get("/clusters", dependencies=[RequireViewer])
async def list_clusters(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    arns = client.list_clusters().get("clusterArns", [])
    if not arns:
        return []
    resp = client.describe_clusters(clusters=arns, include=["STATISTICS", "SETTINGS", "TAGS"])
    return [
        {
            "cluster_arn": c["clusterArn"],
            "cluster_name": c["clusterName"],
            "status": c.get("status", ""),
            "running_tasks_count": c.get("runningTasksCount", 0),
            "pending_tasks_count": c.get("pendingTasksCount", 0),
            "active_services_count": c.get("activeServicesCount", 0),
            "registered_container_instances_count": c.get("registeredContainerInstancesCount", 0),
        }
        for c in resp.get("clusters", [])
    ]


@router.post("/clusters", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_cluster(
    instance_id, body: CreateClusterRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    kwargs: dict = {"clusterName": body.cluster_name}
    if body.capacity_providers:
        kwargs["capacityProviders"] = body.capacity_providers
    resp = client.create_cluster(**kwargs)
    c = resp["cluster"]
    return {
        "cluster_arn": c["clusterArn"],
        "cluster_name": c["clusterName"],
        "status": c.get("status", ""),
    }


@router.delete("/clusters/{cluster_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_cluster(instance_id, cluster_name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    client.delete_cluster(cluster=cluster_name)


# ─── Services ─────────────────────────────────────────────────────────────────

@router.get("/clusters/{cluster_name}/services", dependencies=[RequireViewer])
async def list_services(instance_id, cluster_name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    arns = client.list_services(cluster=cluster_name).get("serviceArns", [])
    if not arns:
        return []
    resp = client.describe_services(cluster=cluster_name, services=arns)
    return [
        {
            "service_name": s["serviceName"],
            "service_arn": s["serviceArn"],
            "status": s.get("status", ""),
            "desired_count": s.get("desiredCount", 0),
            "running_count": s.get("runningCount", 0),
            "pending_count": s.get("pendingCount", 0),
            "task_definition": s.get("taskDefinition", ""),
            "launch_type": s.get("launchType", ""),
            "created_at": str(s.get("createdAt", "")),
        }
        for s in resp.get("services", [])
    ]


@router.post("/clusters/{cluster_name}/services", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_service(
    instance_id, cluster_name: str, body: CreateServiceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    kwargs: dict = {
        "cluster": cluster_name,
        "serviceName": body.service_name,
        "taskDefinition": body.task_definition,
        "desiredCount": body.desired_count,
        "launchType": body.launch_type,
    }
    if body.network_configuration:
        kwargs["networkConfiguration"] = body.network_configuration
    resp = client.create_service(**kwargs)
    s = resp["service"]
    return {
        "service_name": s["serviceName"],
        "service_arn": s["serviceArn"],
        "status": s.get("status", ""),
        "desired_count": s.get("desiredCount", 0),
    }


@router.put("/clusters/{cluster_name}/services/{service_name}", dependencies=[RequireOperator])
async def update_service(
    instance_id,
    cluster_name: str,
    service_name: str,
    body: UpdateServiceRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    kwargs: dict = {"cluster": cluster_name, "service": service_name}
    if body.desired_count is not None:
        kwargs["desiredCount"] = body.desired_count
    if body.task_definition is not None:
        kwargs["taskDefinition"] = body.task_definition
    resp = client.update_service(**kwargs)
    s = resp["service"]
    return {
        "service_name": s["serviceName"],
        "service_arn": s["serviceArn"],
        "status": s.get("status", ""),
        "desired_count": s.get("desiredCount", 0),
        "task_definition": s.get("taskDefinition", ""),
    }


@router.delete(
    "/clusters/{cluster_name}/services/{service_name}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_service(
    instance_id, cluster_name: str, service_name: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    client.update_service(cluster=cluster_name, service=service_name, desiredCount=0)
    client.delete_service(cluster=cluster_name, service=service_name)


# ─── Tasks ────────────────────────────────────────────────────────────────────

@router.get("/clusters/{cluster_name}/tasks", dependencies=[RequireViewer])
async def list_tasks(instance_id, cluster_name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    arns = client.list_tasks(cluster=cluster_name).get("taskArns", [])
    if not arns:
        return []
    resp = client.describe_tasks(cluster=cluster_name, tasks=arns)
    return [
        {
            "task_arn": t["taskArn"],
            "task_definition_arn": t.get("taskDefinitionArn", ""),
            "last_status": t.get("lastStatus", ""),
            "desired_status": t.get("desiredStatus", ""),
            "started_at": str(t.get("startedAt", "")),
            "stopped_at": str(t.get("stoppedAt", "")),
            "stop_code": t.get("stopCode", ""),
            "stopped_reason": t.get("stoppedReason", ""),
            "containers": t.get("containers", []),
        }
        for t in resp.get("tasks", [])
    ]


@router.post("/clusters/{cluster_name}/tasks/run", dependencies=[RequireOperator])
async def run_task(
    instance_id, cluster_name: str, body: RunTaskRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    kwargs: dict = {
        "cluster": cluster_name,
        "taskDefinition": body.task_definition,
        "count": body.count,
        "launchType": body.launch_type,
    }
    if body.network_configuration:
        kwargs["networkConfiguration"] = body.network_configuration
    resp = client.run_task(**kwargs)
    return [
        {"task_arn": t["taskArn"], "last_status": t.get("lastStatus", "")}
        for t in resp.get("tasks", [])
    ]


@router.post("/clusters/{cluster_name}/tasks/{task_arn:path}/stop", dependencies=[RequireOperator])
async def stop_task(
    instance_id,
    cluster_name: str,
    task_arn: str,
    body: StopTaskRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    resp = client.stop_task(cluster=cluster_name, task=task_arn, reason=body.reason or "")
    t = resp["task"]
    return {
        "task_arn": t["taskArn"],
        "last_status": t.get("lastStatus", ""),
        "desired_status": t.get("desiredStatus", ""),
    }


# ─── Task Definitions ─────────────────────────────────────────────────────────

@router.get("/task-definitions", dependencies=[RequireViewer])
async def list_task_definitions(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    arns = client.list_task_definitions(status="ACTIVE").get("taskDefinitionArns", [])
    families: dict[str, dict] = {}
    for arn in arns:
        # arn format: arn:aws:ecs:region:account:task-definition/family:revision
        tail = arn.split("/")[-1]
        family, _, revision = tail.rpartition(":")
        try:
            rev_num = int(revision)
        except ValueError:
            rev_num = 0
        entry = families.setdefault(family, {"family": family, "revisions": [], "latest_arn": arn})
        entry["revisions"].append(rev_num)
        # Track the highest revision as "latest"
        if rev_num >= max(entry["revisions"]):
            entry["latest_arn"] = arn
    return list(families.values())


@router.get("/task-definitions/{family}", dependencies=[RequireViewer])
async def describe_task_definition(instance_id, family: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    resp = client.describe_task_definition(taskDefinition=family)
    td = resp["taskDefinition"]
    return {
        "family": td.get("family", ""),
        "revision": td.get("revision", 0),
        "task_definition_arn": td.get("taskDefinitionArn", ""),
        "containers": td.get("containerDefinitions", []),
        "volumes": td.get("volumes", []),
        "cpu": td.get("cpu", ""),
        "memory": td.get("memory", ""),
        "network_mode": td.get("networkMode", ""),
        "status": td.get("status", ""),
        "requires_compatibilities": td.get("requiresCompatibilities", []),
        "task_role_arn": td.get("taskRoleArn", ""),
        "execution_role_arn": td.get("executionRoleArn", ""),
    }


@router.post("/task-definitions", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def register_task_definition(
    instance_id, body: RegisterTaskDefRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    kwargs: dict = {
        "family": body.family,
        "containerDefinitions": body.container_definitions,
    }
    if body.requires_compatibilities is not None:
        kwargs["requiresCompatibilities"] = body.requires_compatibilities
    if body.cpu is not None:
        kwargs["cpu"] = body.cpu
    if body.memory is not None:
        kwargs["memory"] = body.memory
    if body.network_mode is not None:
        kwargs["networkMode"] = body.network_mode
    if body.task_role_arn is not None:
        kwargs["taskRoleArn"] = body.task_role_arn
    if body.execution_role_arn is not None:
        kwargs["executionRoleArn"] = body.execution_role_arn
    resp = client.register_task_definition(**kwargs)
    td = resp["taskDefinition"]
    return {
        "family": td["family"],
        "revision": td["revision"],
        "task_definition_arn": td["taskDefinitionArn"],
    }


@router.delete(
    "/task-definitions/{family}/{revision}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def deregister_task_definition(
    instance_id, family: str, revision: int, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecs")
    client.deregister_task_definition(taskDefinition=f"{family}:{revision}")
