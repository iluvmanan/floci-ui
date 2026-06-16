from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/athena", tags=["athena"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateWorkgroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    output_location: str


class StartQueryRequest(BaseModel):
    query_string: str
    workgroup: Optional[str] = "primary"
    database: Optional[str] = None
    output_location: Optional[str] = None


# ─── Workgroups ───────────────────────────────────────────────────────────────

@router.get("/workgroups", dependencies=[RequireViewer])
async def list_workgroups(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    resp = client.list_work_groups()
    return [
        {
            "name": wg["Name"],
            "state": wg.get("State", ""),
            "description": wg.get("Description", ""),
            "creation_time": str(wg.get("CreationTime", "")),
        }
        for wg in resp.get("WorkGroups", [])
    ]


@router.post("/workgroups", status_code=201, dependencies=[RequireOperator])
async def create_workgroup(
    instance_id, body: CreateWorkgroupRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    kwargs: dict = {
        "Name": body.name,
        "Configuration": {"ResultConfiguration": {"OutputLocation": body.output_location}},
    }
    if body.description:
        kwargs["Description"] = body.description
    client.create_work_group(**kwargs)
    return {"name": body.name}


@router.delete("/workgroups/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_workgroup(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    client.delete_work_group(WorkGroup=name, RecursiveDeleteOption=True)


# ─── Databases ────────────────────────────────────────────────────────────────

@router.get("/databases", dependencies=[RequireViewer])
async def list_databases(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    resp = client.list_databases(CatalogName="AwsDataCatalog")
    return [
        {
            "name": d["Name"],
            "description": d.get("Description", ""),
            "parameters": d.get("Parameters", {}),
        }
        for d in resp.get("DatabaseList", [])
    ]


# ─── Queries ──────────────────────────────────────────────────────────────────

@router.post("/queries", status_code=201, dependencies=[RequireOperator])
async def start_query(
    instance_id, body: StartQueryRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    kwargs: dict = {
        "QueryString": body.query_string,
        "WorkGroup": body.workgroup,
    }
    if body.database:
        kwargs["QueryExecutionContext"] = {"Database": body.database}
    if body.output_location:
        kwargs["ResultConfiguration"] = {"OutputLocation": body.output_location}
    resp = client.start_query_execution(**kwargs)
    return {"query_execution_id": resp["QueryExecutionId"]}


@router.get("/queries/{query_id}", dependencies=[RequireViewer])
async def get_query_execution(instance_id, query_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    resp = client.get_query_execution(QueryExecutionId=query_id)
    qe = resp["QueryExecution"]
    status = qe.get("Status", {})
    stats = qe.get("Statistics", {})
    return {
        "status": {
            "state": status.get("State", ""),
            "state_change_reason": status.get("StateChangeReason", ""),
            "submission_date_time": str(status.get("SubmissionDateTime", "")),
            "completion_date_time": str(status.get("CompletionDateTime", "")),
        },
        "statistics": {
            "data_scanned_in_bytes": stats.get("DataScannedInBytes", 0),
            "engine_execution_time_in_millis": stats.get("EngineExecutionTimeInMillis", 0),
        },
        "query": qe.get("Query", ""),
    }


@router.get("/queries/{query_id}/results", dependencies=[RequireViewer])
async def get_query_results(instance_id, query_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    resp = client.get_query_results(QueryExecutionId=query_id)
    result_set = resp.get("ResultSet", {})
    column_info = result_set.get("ResultSetMetadata", {}).get("ColumnInfo", [])
    columns = [{"name": c.get("Name", ""), "type": c.get("Type", "")} for c in column_info]
    rows = []
    for row in result_set.get("Rows", []):
        rows.append([d.get("VarCharValue", "") for d in row.get("Data", [])])
    return {"columns": columns, "rows": rows}


@router.get("/query-history", dependencies=[RequireViewer])
async def query_history(
    instance_id, workgroup: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    kwargs = {"WorkGroup": workgroup} if workgroup else {}
    resp = client.list_query_executions(**kwargs)
    ids = resp.get("QueryExecutionIds", [])[:50]
    history = []
    for qid in ids:
        qresp = client.get_query_execution(QueryExecutionId=qid)
        qe = qresp["QueryExecution"]
        status = qe.get("Status", {})
        stats = qe.get("Statistics", {})
        query_text = qe.get("Query", "")
        history.append({
            "query_execution_id": qid,
            "query": query_text[:200],
            "status": status.get("State", ""),
            "data_scanned_in_bytes": stats.get("DataScannedInBytes", 0),
            "submission_date_time": str(status.get("SubmissionDateTime", "")),
        })
    return history


@router.post("/queries/{query_id}/cancel", dependencies=[RequireOperator])
async def cancel_query(instance_id, query_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "athena")
    client.stop_query_execution(QueryExecutionId=query_id)
    return {"success": True}
