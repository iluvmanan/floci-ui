from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/elbv2", tags=["elbv2"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateLBRequest(BaseModel):
    name: str
    subnets: List[str]
    type: Optional[str] = "application"  # application|network|gateway
    scheme: Optional[str] = "internet-facing"
    security_groups: Optional[List[str]] = None


class CreateTargetGroupRequest(BaseModel):
    name: str
    protocol: str
    port: int
    vpc_id: Optional[str] = None
    target_type: Optional[str] = "instance"
    health_check_path: Optional[str] = None
    health_check_protocol: Optional[str] = None


class TargetRef(BaseModel):
    id: str
    port: Optional[int] = None


class RegisterTargetsRequest(BaseModel):
    targets: List[TargetRef]


class DeregisterTargetsRequest(BaseModel):
    targets: List[TargetRef]


class CreateListenerRequest(BaseModel):
    protocol: str
    port: int
    default_actions: List[dict]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _lb_summary(lb: dict) -> dict:
    return {
        "load_balancer_arn": lb.get("LoadBalancerArn"),
        "load_balancer_name": lb.get("LoadBalancerName"),
        "dns_name": lb.get("DNSName"),
        "scheme": lb.get("Scheme"),
        "type": lb.get("Type"),
        "state": lb.get("State", {}).get("Code"),
        "availability_zones": [
            az.get("ZoneName") for az in lb.get("AvailabilityZones", [])
        ],
        "created_time": str(lb.get("CreatedTime", "")),
    }


def _tg_summary(tg: dict) -> dict:
    return {
        "target_group_arn": tg.get("TargetGroupArn"),
        "target_group_name": tg.get("TargetGroupName"),
        "protocol": tg.get("Protocol"),
        "port": tg.get("Port"),
        "vpc_id": tg.get("VpcId"),
        "target_type": tg.get("TargetType"),
        "health_check_path": tg.get("HealthCheckPath"),
        "health_check_protocol": tg.get("HealthCheckProtocol"),
    }


def _listener_summary(listener: dict) -> dict:
    return {
        "listener_arn": listener.get("ListenerArn"),
        "port": listener.get("Port"),
        "protocol": listener.get("Protocol"),
        "ssl_policy": listener.get("SslPolicy"),
        "certificates": listener.get("Certificates", []),
        "default_actions": listener.get("DefaultActions", []),
    }


# ─── Load Balancers ───────────────────────────────────────────────────────────

@router.get("/load-balancers", dependencies=[RequireViewer])
async def list_load_balancers(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    resp = client.describe_load_balancers()
    return [_lb_summary(lb) for lb in resp.get("LoadBalancers", [])]


@router.post("/load-balancers", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_load_balancer(
    instance_id, body: CreateLBRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    kwargs: dict = {
        "Name": body.name,
        "Subnets": body.subnets,
        "Type": body.type,
        "Scheme": body.scheme,
    }
    if body.security_groups:
        kwargs["SecurityGroups"] = body.security_groups
    resp = client.create_load_balancer(**kwargs)
    lb = resp["LoadBalancers"][0]
    return {
        "load_balancer_arn": lb["LoadBalancerArn"],
        "dns_name": lb["DNSName"],
        "state": lb.get("State", {}).get("Code"),
    }


@router.delete("/load-balancers/{lb_arn:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_load_balancer(instance_id, lb_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    client.delete_load_balancer(LoadBalancerArn=lb_arn)


# ─── Target Groups ────────────────────────────────────────────────────────────

@router.get("/target-groups", dependencies=[RequireViewer])
async def list_target_groups(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    resp = client.describe_target_groups()
    return [_tg_summary(tg) for tg in resp.get("TargetGroups", [])]


@router.post("/target-groups", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_target_group(
    instance_id, body: CreateTargetGroupRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    kwargs: dict = {
        "Name": body.name,
        "Protocol": body.protocol,
        "Port": body.port,
        "TargetType": body.target_type,
    }
    if body.vpc_id:
        kwargs["VpcId"] = body.vpc_id
    if body.health_check_path:
        kwargs["HealthCheckPath"] = body.health_check_path
    if body.health_check_protocol:
        kwargs["HealthCheckProtocol"] = body.health_check_protocol
    resp = client.create_target_group(**kwargs)
    tg = resp["TargetGroups"][0]
    return _tg_summary(tg)


@router.delete("/target-groups/{tg_arn:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_target_group(instance_id, tg_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    client.delete_target_group(TargetGroupArn=tg_arn)


@router.post("/target-groups/{tg_arn:path}/register", dependencies=[RequireOperator])
async def register_targets(
    instance_id, tg_arn: str, body: RegisterTargetsRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    targets = [
        {"Id": t.id, **({"Port": t.port} if t.port else {})} for t in body.targets
    ]
    client.register_targets(TargetGroupArn=tg_arn, Targets=targets)
    return {"success": True}


@router.post("/target-groups/{tg_arn:path}/deregister", dependencies=[RequireOperator])
async def deregister_targets(
    instance_id, tg_arn: str, body: DeregisterTargetsRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    targets = [{"Id": t.id} for t in body.targets]
    client.deregister_targets(TargetGroupArn=tg_arn, Targets=targets)
    return {"success": True}


@router.get("/target-groups/{tg_arn:path}/health", dependencies=[RequireViewer])
async def get_target_health(instance_id, tg_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    resp = client.describe_target_health(TargetGroupArn=tg_arn)
    return [
        {
            "target_id": d.get("Target", {}).get("Id"),
            "target_port": d.get("Target", {}).get("Port"),
            "health_state": d.get("TargetHealth", {}).get("State"),
            "health_reason": d.get("TargetHealth", {}).get("Reason"),
        }
        for d in resp.get("TargetHealthDescriptions", [])
    ]


# ─── Listeners ─────────────────────────────────────────────────────────────────

@router.get("/load-balancers/{lb_arn:path}/listeners", dependencies=[RequireViewer])
async def list_listeners(instance_id, lb_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    resp = client.describe_listeners(LoadBalancerArn=lb_arn)
    return [_listener_summary(l) for l in resp.get("Listeners", [])]


@router.post("/load-balancers/{lb_arn:path}/listeners", dependencies=[RequireOperator])
async def create_listener(
    instance_id, lb_arn: str, body: CreateListenerRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    resp = client.create_listener(
        LoadBalancerArn=lb_arn,
        Protocol=body.protocol,
        Port=body.port,
        DefaultActions=body.default_actions,
    )
    listener = resp["Listeners"][0]
    return _listener_summary(listener)


@router.delete("/listeners/{listener_arn:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_listener(instance_id, listener_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "elbv2")
    client.delete_listener(ListenerArn=listener_arn)
