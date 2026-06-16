from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/cloudmap", tags=["cloudmap"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateHTTPNamespaceRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CreatePrivateDNSNamespaceRequest(BaseModel):
    name: str
    vpc: str
    description: Optional[str] = None


class DnsRecordRequest(BaseModel):
    type: str
    ttl: int = 60


class DnsConfigRequest(BaseModel):
    dns_records: List[DnsRecordRequest]


class HealthCheckConfigRequest(BaseModel):
    type: Optional[str] = "HTTP"
    resource_path: Optional[str] = None
    failure_threshold: Optional[int] = 1


class CreateServiceRequest(BaseModel):
    name: str
    namespace_id: str
    description: Optional[str] = None
    routing_policy: Optional[str] = None
    dns_config: Optional[DnsConfigRequest] = None
    health_check_config: Optional[HealthCheckConfigRequest] = None


class RegisterInstanceRequest(BaseModel):
    attributes: dict


# ─── Namespaces ───────────────────────────────────────────────────────────────

@router.get("/namespaces", dependencies=[RequireViewer])
async def list_namespaces(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    resp = client.list_namespaces()
    return [
        {
            "id": n["Id"],
            "name": n["Name"],
            "type": n.get("Type", ""),
            "description": n.get("Description", ""),
            "create_date": str(n.get("CreateDate", "")),
            "properties": n.get("Properties", {}),
        }
        for n in resp.get("Namespaces", [])
    ]


@router.post("/namespaces/http", status_code=201, dependencies=[RequireOperator])
async def create_http_namespace(
    instance_id, body: CreateHTTPNamespaceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    kwargs: dict = {"Name": body.name}
    if body.description:
        kwargs["Description"] = body.description
    resp = client.create_http_namespace(**kwargs)
    return {"operation_id": resp["OperationId"]}


@router.post("/namespaces/dns-private", status_code=201, dependencies=[RequireOperator])
async def create_private_dns_namespace(
    instance_id, body: CreatePrivateDNSNamespaceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    kwargs: dict = {"Name": body.name, "Vpc": body.vpc}
    if body.description:
        kwargs["Description"] = body.description
    resp = client.create_private_dns_namespace(**kwargs)
    return {"operation_id": resp["OperationId"]}


@router.delete("/namespaces/{id}", dependencies=[RequireOperator])
async def delete_namespace(instance_id, id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    resp = client.delete_namespace(Id=id)
    return {"operation_id": resp["OperationId"]}


# ─── Services ─────────────────────────────────────────────────────────────────

@router.get("/services", dependencies=[RequireViewer])
async def list_services(
    instance_id,
    namespace_id: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    kwargs: dict = {}
    if namespace_id:
        kwargs["Filters"] = [{"Name": "NAMESPACE_ID", "Values": [namespace_id]}]
    resp = client.list_services(**kwargs)
    return [
        {
            "id": s["Id"],
            "name": s["Name"],
            "namespace_id": s.get("NamespaceId", ""),
            "description": s.get("Description", ""),
            "instance_count": s.get("InstanceCount", 0),
            "create_date": str(s.get("CreateDate", "")),
            "routing_policy": s.get("DnsConfig", {}).get("RoutingPolicy", ""),
        }
        for s in resp.get("Services", [])
    ]


@router.post("/services", status_code=201, dependencies=[RequireOperator])
async def create_service(
    instance_id, body: CreateServiceRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    kwargs: dict = {"Name": body.name, "NamespaceId": body.namespace_id}
    if body.description:
        kwargs["Description"] = body.description
    if body.dns_config:
        dns_config: dict = {
            "DnsRecords": [
                {"Type": r.type, "TTL": r.ttl} for r in body.dns_config.dns_records
            ]
        }
        if body.routing_policy:
            dns_config["RoutingPolicy"] = body.routing_policy
        kwargs["DnsConfig"] = dns_config
    if body.health_check_config:
        hc: dict = {"Type": body.health_check_config.type or "HTTP"}
        if body.health_check_config.resource_path:
            hc["ResourcePath"] = body.health_check_config.resource_path
        if body.health_check_config.failure_threshold:
            hc["FailureThreshold"] = body.health_check_config.failure_threshold
        kwargs["HealthCheckConfig"] = hc
    resp = client.create_service(**kwargs)
    s = resp["Service"]
    return {
        "id": s["Id"],
        "name": s["Name"],
        "namespace_id": s.get("NamespaceId", ""),
        "description": s.get("Description", ""),
        "instance_count": s.get("InstanceCount", 0),
        "create_date": str(s.get("CreateDate", "")),
        "routing_policy": s.get("DnsConfig", {}).get("RoutingPolicy", ""),
    }


@router.delete("/services/{id}", status_code=204, dependencies=[RequireOperator])
async def delete_service(instance_id, id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    client.delete_service(Id=id)


# ─── Service Instances ────────────────────────────────────────────────────────

@router.get("/services/{id}/instances", dependencies=[RequireViewer])
async def list_instances(instance_id, id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    resp = client.list_instances(ServiceId=id)
    return [
        {"id": i["Id"], "attributes": i.get("Attributes", {})}
        for i in resp.get("Instances", [])
    ]


@router.post("/services/{id}/instances/{instance_id_param}", status_code=201, dependencies=[RequireOperator])
async def register_instance(
    instance_id,
    id: str,
    instance_id_param: str,
    body: RegisterInstanceRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    resp = client.register_instance(
        ServiceId=id, InstanceId=instance_id_param, Attributes=body.attributes
    )
    return {"operation_id": resp["OperationId"]}


@router.delete("/services/{id}/instances/{instance_id_param}", dependencies=[RequireOperator])
async def deregister_instance(
    instance_id, id: str, instance_id_param: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "servicediscovery")
    resp = client.deregister_instance(ServiceId=id, InstanceId=instance_id_param)
    return {"operation_id": resp["OperationId"]}
