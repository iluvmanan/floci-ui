import json
from uuid import UUID
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/eventbridge", tags=["eventbridge"])


class BusCreate(BaseModel):
    bus_name: str


class PutEvent(BaseModel):
    source: str
    detail_type: str
    detail: dict


class RuleCreate(BaseModel):
    name: str
    event_pattern: str | None = None
    schedule_expression: str | None = None
    state: str = "ENABLED"
    description: str | None = None


class PutTargetsBody(BaseModel):
    targets: list


@router.get("/buses", dependencies=[RequireViewer])
async def list_buses(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    resp = client.list_event_buses()
    return [{"name": b["Name"], "arn": b.get("Arn", "")} for b in resp.get("EventBuses", [])]


@router.post("/buses", status_code=201, dependencies=[RequireOperator])
async def create_bus(
    instance_id: UUID, body: BusCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    resp = client.create_event_bus(Name=body.bus_name)
    return {"name": body.bus_name, "arn": resp.get("EventBusArn", "")}


@router.delete("/buses/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_bus(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    client.delete_event_bus(Name=name)


@router.post("/buses/{name}/events", dependencies=[RequireOperator])
async def put_events(
    instance_id: UUID, name: str, body: PutEvent, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    resp = client.put_events(Entries=[{
        "EventBusName": name,
        "Source": body.source,
        "DetailType": body.detail_type,
        "Detail": json.dumps(body.detail),
        "Time": datetime.now(UTC),
    }])
    return {"failed": resp.get("FailedEntryCount", 0), "entries": resp.get("Entries", [])}


@router.get("/buses/{name}/rules", dependencies=[RequireViewer])
async def list_rules(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    resp = client.list_rules(EventBusName=name)
    return [
        {
            "name": r["Name"],
            "arn": r.get("Arn", ""),
            "state": r.get("State", ""),
            "event_pattern": r.get("EventPattern"),
            "schedule_expression": r.get("ScheduleExpression"),
            "description": r.get("Description"),
        }
        for r in resp.get("Rules", [])
    ]


@router.post("/buses/{name}/rules", dependencies=[RequireOperator])
async def create_rule(
    instance_id: UUID, name: str, body: RuleCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    kwargs: dict = {"Name": body.name, "State": body.state, "EventBusName": name}
    if body.event_pattern:
        kwargs["EventPattern"] = body.event_pattern
    if body.schedule_expression:
        kwargs["ScheduleExpression"] = body.schedule_expression
    if body.description:
        kwargs["Description"] = body.description
    resp = client.put_rule(**kwargs)
    return {"rule_arn": resp["RuleArn"]}


@router.delete("/buses/{name}/rules/{rule}", status_code=204, dependencies=[RequireOperator])
async def delete_rule(instance_id: UUID, name: str, rule: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    targets = client.list_targets_by_rule(Rule=rule, EventBusName=name).get("Targets", [])
    if targets:
        client.remove_targets(Rule=rule, EventBusName=name, Ids=[t["Id"] for t in targets])
    client.delete_rule(Name=rule, EventBusName=name)


@router.get("/buses/{name}/rules/{rule}/targets", dependencies=[RequireViewer])
async def list_rule_targets(instance_id: UUID, name: str, rule: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    resp = client.list_targets_by_rule(Rule=rule, EventBusName=name)
    return [
        {"id": t["Id"], "arn": t["Arn"], "input": t.get("Input"), "input_path": t.get("InputPath")}
        for t in resp.get("Targets", [])
    ]


@router.post("/buses/{name}/rules/{rule}/targets", dependencies=[RequireOperator])
async def put_rule_targets(
    instance_id: UUID, name: str, rule: str, body: PutTargetsBody, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "events")
    client.put_targets(Rule=rule, EventBusName=name, Targets=body.targets)
    return {"success": True}
