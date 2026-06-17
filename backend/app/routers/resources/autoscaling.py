from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/autoscaling", tags=["autoscaling"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateASGRequest(BaseModel):
    auto_scaling_group_name: str
    min_size: int
    max_size: int
    desired_capacity: int
    availability_zones: Optional[List[str]] = None
    launch_template_id: Optional[str] = None
    launch_template_version: Optional[str] = "$Latest"
    launch_configuration_name: Optional[str] = None


class UpdateASGRequest(BaseModel):
    min_size: Optional[int] = None
    max_size: Optional[int] = None
    desired_capacity: Optional[int] = None


class SetCapacityRequest(BaseModel):
    desired_capacity: int


class CreatePolicyRequest(BaseModel):
    policy_name: str
    auto_scaling_group_name: str
    policy_type: Optional[str] = "SimpleScaling"
    adjustment_type: Optional[str] = "ChangeInCapacity"
    scaling_adjustment: Optional[int] = None


# ─── Auto Scaling Groups ───────────────────────────────────────────────────────

@router.get("/groups", dependencies=[RequireViewer])
async def list_groups(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    resp = client.describe_auto_scaling_groups()
    return [
        {
            "auto_scaling_group_name": g["AutoScalingGroupName"],
            "min_size": g.get("MinSize", 0),
            "max_size": g.get("MaxSize", 0),
            "desired_capacity": g.get("DesiredCapacity", 0),
            "instances": g.get("Instances", []),
            "availability_zones": g.get("AvailabilityZones", []),
            "load_balancer_names": g.get("LoadBalancerNames", []),
            "launch_template": g.get("LaunchTemplate", {}),
            "launch_configuration_name": g.get("LaunchConfigurationName", ""),
            "health_check_type": g.get("HealthCheckType", ""),
            "created_time": str(g.get("CreatedTime", "")),
        }
        for g in resp.get("AutoScalingGroups", [])
    ]


@router.post("/groups", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_group(
    instance_id, body: CreateASGRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    kwargs: dict = {
        "AutoScalingGroupName": body.auto_scaling_group_name,
        "MinSize": body.min_size,
        "MaxSize": body.max_size,
        "DesiredCapacity": body.desired_capacity,
    }
    if body.availability_zones:
        kwargs["AvailabilityZones"] = body.availability_zones
    if body.launch_template_id:
        kwargs["LaunchTemplate"] = {
            "LaunchTemplateId": body.launch_template_id,
            "Version": body.launch_template_version or "$Latest",
        }
    elif body.launch_configuration_name:
        kwargs["LaunchConfigurationName"] = body.launch_configuration_name
    client.create_auto_scaling_group(**kwargs)
    return {"auto_scaling_group_name": body.auto_scaling_group_name}


@router.put("/groups/{name}", dependencies=[RequireOperator])
async def update_group(
    instance_id, name: str, body: UpdateASGRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    kwargs: dict = {"AutoScalingGroupName": name}
    if body.min_size is not None:
        kwargs["MinSize"] = body.min_size
    if body.max_size is not None:
        kwargs["MaxSize"] = body.max_size
    if body.desired_capacity is not None:
        kwargs["DesiredCapacity"] = body.desired_capacity
    client.update_auto_scaling_group(**kwargs)
    return {"success": True}


@router.delete("/groups/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_group(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    client.delete_auto_scaling_group(AutoScalingGroupName=name, ForceDelete=True)


@router.post("/groups/{name}/capacity", dependencies=[RequireOperator])
async def set_desired_capacity(
    instance_id, name: str, body: SetCapacityRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    client.set_desired_capacity(AutoScalingGroupName=name, DesiredCapacity=body.desired_capacity)
    return {"success": True}


@router.get("/groups/{name}/activities", dependencies=[RequireViewer])
async def get_scaling_activities(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    resp = client.describe_scaling_activities(AutoScalingGroupName=name)
    return [
        {
            "activity_id": a["ActivityId"],
            "description": a.get("Description", ""),
            "status_code": a.get("StatusCode", ""),
            "status_message": a.get("StatusMessage", ""),
            "start_time": str(a.get("StartTime", "")),
            "end_time": str(a.get("EndTime", "")),
            "progress": a.get("Progress", 0),
        }
        for a in resp.get("Activities", [])
    ]


# ─── Scaling Policies ──────────────────────────────────────────────────────────

@router.get("/policies", dependencies=[RequireViewer])
async def list_policies(
    instance_id,
    auto_scaling_group_name: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    kwargs: dict = {}
    if auto_scaling_group_name:
        kwargs["AutoScalingGroupName"] = auto_scaling_group_name
    resp = client.describe_policies(**kwargs)
    return [
        {
            "policy_name": p["PolicyName"],
            "policy_arn": p.get("PolicyARN", ""),
            "policy_type": p.get("PolicyType", ""),
            "scaling_adjustment": p.get("ScalingAdjustment"),
            "adjustment_type": p.get("AdjustmentType", ""),
            "cooldown": p.get("Cooldown"),
            "estimated_instance_warmup": p.get("EstimatedInstanceWarmup"),
        }
        for p in resp.get("ScalingPolicies", [])
    ]


@router.post("/policies", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_policy(
    instance_id, body: CreatePolicyRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    kwargs: dict = {
        "PolicyName": body.policy_name,
        "AutoScalingGroupName": body.auto_scaling_group_name,
        "PolicyType": body.policy_type,
        "AdjustmentType": body.adjustment_type,
    }
    if body.scaling_adjustment is not None:
        kwargs["ScalingAdjustment"] = body.scaling_adjustment
    resp = client.put_scaling_policy(**kwargs)
    return {"policy_arn": resp.get("PolicyARN", "")}


@router.delete("/policies/{policy_name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_policy(
    instance_id,
    policy_name: str,
    auto_scaling_group_name: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "autoscaling")
    client.delete_policy(AutoScalingGroupName=auto_scaling_group_name, PolicyName=policy_name)
