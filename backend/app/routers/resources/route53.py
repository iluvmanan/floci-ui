from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/route53", tags=["route53"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateHostedZoneRequest(BaseModel):
    name: str
    private_zone: Optional[bool] = False
    vpc_id: Optional[str] = None
    comment: Optional[str] = None


class RecordSetRequest(BaseModel):
    name: str
    type: str
    ttl: int
    records: List[str]


# ─── Hosted Zones ──────────────────────────────────────────────────────────────

@router.get("/hosted-zones", dependencies=[RequireViewer])
async def list_hosted_zones(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    resp = client.list_hosted_zones()
    return [
        {
            "id": z["Id"],
            "name": z["Name"],
            "config": {
                "comment": z.get("Config", {}).get("Comment", ""),
                "private_zone": z.get("Config", {}).get("PrivateZone", False),
            },
            "resource_record_set_count": z.get("ResourceRecordSetCount", 0),
        }
        for z in resp.get("HostedZones", [])
    ]


@router.post("/hosted-zones", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_hosted_zone(
    instance_id, body: CreateHostedZoneRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    kwargs: dict = {
        "Name": body.name,
        "CallerReference": str(uuid4()),
        "HostedZoneConfig": {
            "Comment": body.comment or "",
            "PrivateZone": bool(body.private_zone),
        },
    }
    if body.private_zone and body.vpc_id:
        kwargs["VPC"] = {"VPCId": body.vpc_id, "VPCRegion": inst.region}
    resp = client.create_hosted_zone(**kwargs)
    zone = resp["HostedZone"]
    nameservers = resp.get("DelegationSet", {}).get("NameServers", [])
    return {"id": zone["Id"], "name": zone["Name"], "nameservers": nameservers}


@router.delete("/hosted-zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_hosted_zone(instance_id, zone_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    client.delete_hosted_zone(Id=zone_id)


# ─── Record Sets ───────────────────────────────────────────────────────────────

@router.get("/hosted-zones/{zone_id}/record-sets", dependencies=[RequireViewer])
async def list_record_sets(instance_id, zone_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    resp = client.list_resource_record_sets(HostedZoneId=zone_id)
    return [
        {
            "name": r["Name"],
            "type": r["Type"],
            "ttl": r.get("TTL"),
            "records": [rr["Value"] for rr in r.get("ResourceRecords", [])],
            "alias_target": r.get("AliasTarget"),
        }
        for r in resp.get("ResourceRecordSets", [])
    ]


def _build_change_batch(action: str, body: RecordSetRequest) -> dict:
    return {
        "Changes": [
            {
                "Action": action,
                "ResourceRecordSet": {
                    "Name": body.name,
                    "Type": body.type,
                    "TTL": body.ttl,
                    "ResourceRecords": [{"Value": v} for v in body.records],
                },
            }
        ]
    }


@router.post("/hosted-zones/{zone_id}/record-sets", dependencies=[RequireOperator])
async def create_record_set(
    instance_id, zone_id: str, body: RecordSetRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    resp = client.change_resource_record_sets(
        HostedZoneId=zone_id, ChangeBatch=_build_change_batch("CREATE", body)
    )
    info = resp["ChangeInfo"]
    return {"change_id": info["Id"], "status": info.get("Status", "")}


@router.put("/hosted-zones/{zone_id}/record-sets", dependencies=[RequireOperator])
async def upsert_record_set(
    instance_id, zone_id: str, body: RecordSetRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    resp = client.change_resource_record_sets(
        HostedZoneId=zone_id, ChangeBatch=_build_change_batch("UPSERT", body)
    )
    info = resp["ChangeInfo"]
    return {"change_id": info["Id"], "status": info.get("Status", "")}


@router.delete("/hosted-zones/{zone_id}/record-sets", dependencies=[RequireOperator])
async def delete_record_set(
    instance_id, zone_id: str, body: RecordSetRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "route53")
    resp = client.change_resource_record_sets(
        HostedZoneId=zone_id, ChangeBatch=_build_change_batch("DELETE", body)
    )
    info = resp["ChangeInfo"]
    return {"change_id": info["Id"], "status": info.get("Status", "")}
