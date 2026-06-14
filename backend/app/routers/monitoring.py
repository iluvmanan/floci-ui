import asyncio
import json
from datetime import UTC, datetime, timedelta
from urllib.parse import unquote
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.core.database import get_db
from app.core.dependencies import RequireViewer
import app.routers.resources.base as _rb

router = APIRouter(prefix="/instances/{instance_id}/monitoring", tags=["monitoring"])


# ── CloudWatch Logs ───────────────────────────────────────────────────────────


@router.get("/log-groups", dependencies=[RequireViewer])
async def list_log_groups(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "logs")
    resp = client.describe_log_groups(limit=50)
    return [
        {
            "name": g["logGroupName"],
            "retention_days": g.get("retentionInDays"),
            "stored_bytes": g.get("storedBytes", 0),
        }
        for g in resp.get("logGroups", [])
    ]


@router.get("/log-groups/{group:path}/streams", dependencies=[RequireViewer])
async def list_streams(instance_id: UUID, group: str, db: AsyncSession = Depends(get_db)):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "logs")
    group = unquote(group)
    resp = client.describe_log_streams(
        logGroupName=group, orderBy="LastEventTime", descending=True, limit=50
    )
    return [
        {
            "name": s["logStreamName"],
            "first_event_time": s.get("firstEventTimestamp"),
            "last_event_time": s.get("lastEventTimestamp"),
            "stored_bytes": s.get("storedBytes", 0),
        }
        for s in resp.get("logStreams", [])
    ]


@router.get("/log-groups/{group:path}/events", dependencies=[RequireViewer])
async def get_log_events(
    instance_id: UUID,
    group: str,
    stream: str | None = None,
    start: int | None = None,
    end: int | None = None,
    filter: str = "",
    limit: int = Query(500, le=10000),
    next_token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "logs")
    group = unquote(group)

    now_ms = int(datetime.now(UTC).timestamp() * 1000)
    kwargs: dict = {
        "logGroupName": group,
        "filterPattern": filter,
        "limit": limit,
        "startTime": start or (now_ms - 3_600_000),
        "endTime": end or now_ms,
    }
    if stream:
        kwargs["logStreamNames"] = [stream]
    if next_token:
        kwargs["nextToken"] = next_token

    resp = client.filter_log_events(**kwargs)
    return {
        "events": [
            {
                "timestamp": e["timestamp"],
                "message": e["message"],
                "stream": e.get("logStreamName", ""),
            }
            for e in resp.get("events", [])
        ],
        "next_token": resp.get("nextToken"),
    }


@router.get("/log-groups/{group:path}/tail", dependencies=[RequireViewer])
async def tail_logs(
    instance_id: UUID,
    group: str,
    stream: str | None = None,
    filter: str = "",
    last_token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "logs")
    group = unquote(group)

    async def event_generator():
        next_token = last_token
        start_time = int((datetime.now(UTC) - timedelta(minutes=5)).timestamp() * 1000)
        yield {"data": "", "event": "connected"}
        while True:
            kwargs: dict = {
                "logGroupName": group,
                "filterPattern": filter,
                "startTime": start_time,
            }
            if stream:
                kwargs["logStreamNames"] = [stream]
            if next_token:
                kwargs["nextToken"] = next_token

            try:
                resp = client.filter_log_events(**kwargs)
                events = resp.get("events", [])
                for e in events:
                    yield {
                        "id": resp.get("nextToken", ""),
                        "data": json.dumps({
                            "timestamp": e["timestamp"],
                            "message": e["message"],
                            "stream": e.get("logStreamName", ""),
                        }),
                    }
                    start_time = e["timestamp"] + 1
                if resp.get("nextToken"):
                    next_token = resp["nextToken"]
            except Exception:
                pass
            await asyncio.sleep(2)

    return EventSourceResponse(event_generator())


# ── CloudWatch Metrics ────────────────────────────────────────────────────────


@router.get("/metrics/namespaces", dependencies=[RequireViewer])
async def list_namespaces(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "cloudwatch")
    resp = client.list_metrics()
    namespaces = sorted({m["Namespace"] for m in resp.get("Metrics", [])})
    return namespaces


@router.get("/metrics", dependencies=[RequireViewer])
async def list_metrics(
    instance_id: UUID,
    namespace: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "cloudwatch")
    kwargs: dict = {}
    if namespace:
        kwargs["Namespace"] = namespace
    resp = client.list_metrics(**kwargs)
    return [
        {
            "name": m["MetricName"],
            "namespace": m["Namespace"],
            "dimensions": m.get("Dimensions", []),
        }
        for m in resp.get("Metrics", [])
    ]


@router.get("/metrics/data", dependencies=[RequireViewer])
async def get_metric_data(
    instance_id: UUID,
    namespace: str,
    metric_name: str,
    statistic: str = "Average",
    period: int = Query(60, ge=1),
    start: int | None = None,
    end: int | None = None,
    dimension_name: str | None = None,
    dimension_value: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await _rb.get_instance(instance_id, db)
    client = _rb.get_client(inst, "cloudwatch")

    now = datetime.now(UTC)
    start_dt = datetime.fromtimestamp(start / 1000, tz=UTC) if start else now - timedelta(hours=1)
    end_dt = datetime.fromtimestamp(end / 1000, tz=UTC) if end else now

    dimensions = []
    if dimension_name and dimension_value:
        dimensions = [{"Name": dimension_name, "Value": dimension_value}]

    resp = client.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric_name,
        Dimensions=dimensions,
        StartTime=start_dt,
        EndTime=end_dt,
        Period=period,
        Statistics=[statistic],
    )

    datapoints = sorted(resp.get("Datapoints", []), key=lambda d: d["Timestamp"])
    unit = datapoints[0]["Unit"] if datapoints else "None"
    return {
        "datapoints": [
            {"timestamp": str(d["Timestamp"]), "value": d.get(statistic, 0.0)}
            for d in datapoints
        ],
        "unit": unit,
    }
