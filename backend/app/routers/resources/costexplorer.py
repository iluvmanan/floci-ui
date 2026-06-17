from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/costexplorer", tags=["costexplorer"])


# ─── Request Models ───────────────────────────────────────────────────────────

class TimePeriodRequest(BaseModel):
    start: str
    end: str


class GroupByRequest(BaseModel):
    type: str
    key: str


class GetCostAndUsageRequest(BaseModel):
    time_period: TimePeriodRequest
    granularity: str = "DAILY"
    group_by: Optional[List[GroupByRequest]] = None
    filter: Optional[dict] = None
    metrics: List[str] = ["UnblendedCost"]


class GetCostForecastRequest(BaseModel):
    time_period: TimePeriodRequest
    granularity: str = "MONTHLY"
    metric: str = "UNBLENDED_COST"


# ─── Cost & Usage ──────────────────────────────────────────────────────────────

@router.post("/cost-and-usage", dependencies=[RequireViewer])
async def get_cost_and_usage(
    instance_id, body: GetCostAndUsageRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ce")
    kwargs: dict = {
        "TimePeriod": {"Start": body.time_period.start, "End": body.time_period.end},
        "Granularity": body.granularity,
        "Metrics": body.metrics,
    }
    if body.group_by:
        kwargs["GroupBy"] = [{"Type": g.type, "Key": g.key} for g in body.group_by]
    if body.filter:
        kwargs["Filter"] = body.filter
    resp = client.get_cost_and_usage(**kwargs)
    results_by_time = []
    for r in resp.get("ResultsByTime", []):
        results_by_time.append({
            "time_period": r.get("TimePeriod", {}),
            "total": r.get("Total", {}),
            "groups": r.get("Groups", []),
        })
    return {"results_by_time": results_by_time}


@router.post("/cost-forecast", dependencies=[RequireViewer])
async def get_cost_forecast(
    instance_id, body: GetCostForecastRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ce")
    resp = client.get_cost_forecast(
        TimePeriod={"Start": body.time_period.start, "End": body.time_period.end},
        Granularity=body.granularity,
        Metric=body.metric,
    )
    return {
        "total": resp.get("Total", {}),
        "forecast_results_by_time": resp.get("ForecastResultsByTime", []),
    }


# ─── Cost Allocation Tags ───────────────────────────────────────────────────────

@router.get("/tags", dependencies=[RequireViewer])
async def list_cost_allocation_tags(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ce")
    resp = client.list_cost_allocation_tags(Status="Active")
    return [
        {"tag_key": t["TagKey"], "status": t.get("Status", "")}
        for t in resp.get("CostAllocationTags", [])
    ]
