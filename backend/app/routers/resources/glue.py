from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/glue", tags=["glue"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateDatabaseRequest(BaseModel):
    name: str
    description: Optional[str] = None
    location_uri: Optional[str] = None


class CrawlerTargets(BaseModel):
    s3_paths: Optional[List[str]] = None


class CreateCrawlerRequest(BaseModel):
    name: str
    role: str
    database_name: str
    targets: CrawlerTargets
    schedule: Optional[str] = None


class JobCommand(BaseModel):
    name: str = "glueetl"
    script_location: str


class CreateJobRequest(BaseModel):
    name: str
    role: str
    command: JobCommand
    glue_version: Optional[str] = "4.0"
    number_of_workers: Optional[int] = 2
    worker_type: Optional[str] = "G.1X"


class StartJobRunRequest(BaseModel):
    arguments: Optional[dict] = None


# ─── Databases ────────────────────────────────────────────────────────────────

@router.get("/databases", dependencies=[RequireViewer])
async def list_databases(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    resp = client.get_databases()
    return [
        {
            "name": d["Name"],
            "description": d.get("Description", ""),
            "location_uri": d.get("LocationUri", ""),
            "create_time": str(d.get("CreateTime", "")),
            "parameters": d.get("Parameters", {}),
        }
        for d in resp.get("DatabaseList", [])
    ]


@router.post("/databases", status_code=201, dependencies=[RequireOperator])
async def create_database(
    instance_id, body: CreateDatabaseRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    database_input: dict = {"Name": body.name}
    if body.description:
        database_input["Description"] = body.description
    if body.location_uri:
        database_input["LocationUri"] = body.location_uri
    client.create_database(DatabaseInput=database_input)
    return {"name": body.name}


@router.delete("/databases/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_database(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.delete_database(Name=name)


@router.get("/databases/{name}/tables", dependencies=[RequireViewer])
async def list_tables(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    resp = client.get_tables(DatabaseName=name)
    tables = []
    for t in resp.get("TableList", []):
        sd = t.get("StorageDescriptor", {})
        tables.append({
            "name": t["Name"],
            "description": t.get("Description", ""),
            "table_type": t.get("TableType", ""),
            "create_time": str(t.get("CreateTime", "")),
            "update_time": str(t.get("UpdateTime", "")),
            "storage_descriptor": {
                "location": sd.get("Location", ""),
                "columns": [
                    {"name": c.get("Name", ""), "type": c.get("Type", "")}
                    for c in sd.get("Columns", [])
                ],
            },
        })
    return tables


# ─── Crawlers ─────────────────────────────────────────────────────────────────

@router.get("/crawlers", dependencies=[RequireViewer])
async def list_crawlers(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    names_resp = client.list_crawlers()
    names = names_resp.get("CrawlerNames", [])
    if not names:
        return []
    resp = client.get_crawlers(CrawlerNameList=names)
    return [
        {
            "name": c["Name"],
            "role": c.get("Role", ""),
            "targets": c.get("Targets", {}),
            "database_name": c.get("DatabaseName", ""),
            "schedule": c.get("Schedule", {}).get("ScheduleExpression", "") if c.get("Schedule") else "",
            "state": c.get("State", ""),
            "last_run": c.get("LastCrawl"),
        }
        for c in resp.get("Crawlers", [])
    ]


@router.post("/crawlers", status_code=201, dependencies=[RequireOperator])
async def create_crawler(
    instance_id, body: CreateCrawlerRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    kwargs: dict = {
        "Name": body.name,
        "Role": body.role,
        "DatabaseName": body.database_name,
        "Targets": (
            {"S3Targets": [{"Path": p} for p in body.targets.s3_paths]}
            if body.targets.s3_paths
            else {}
        ),
    }
    if body.schedule:
        kwargs["Schedule"] = body.schedule
    client.create_crawler(**kwargs)
    return {"name": body.name}


@router.delete("/crawlers/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_crawler(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.delete_crawler(Name=name)


@router.post("/crawlers/{name}/start", dependencies=[RequireOperator])
async def start_crawler(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.start_crawler(Name=name)
    return {"success": True}


@router.post("/crawlers/{name}/stop", dependencies=[RequireOperator])
async def stop_crawler(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.stop_crawler(Name=name)
    return {"success": True}


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.get("/jobs", dependencies=[RequireViewer])
async def list_jobs(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    names_resp = client.list_jobs()
    names = names_resp.get("JobNames", [])
    if not names:
        return []
    try:
        resp = client.batch_get_jobs(JobNames=names)
        jobs_raw = resp.get("Jobs", [])
    except Exception:
        jobs_raw = []
        for n in names:
            try:
                jobs_raw.append(client.get_job(JobName=n)["Job"])
            except Exception:
                pass
    return [
        {
            "name": j["Name"],
            "description": j.get("Description", ""),
            "role": j.get("Role", ""),
            "command": {
                "name": j.get("Command", {}).get("Name", ""),
                "script_location": j.get("Command", {}).get("ScriptLocation", ""),
            },
            "default_arguments": j.get("DefaultArguments", {}),
            "created_on": str(j.get("CreatedOn", "")),
            "last_modified_on": str(j.get("LastModifiedOn", "")),
        }
        for j in jobs_raw
    ]


@router.post("/jobs", status_code=201, dependencies=[RequireOperator])
async def create_job(instance_id, body: CreateJobRequest, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.create_job(
        Name=body.name,
        Role=body.role,
        Command={"Name": body.command.name, "ScriptLocation": body.command.script_location},
        GlueVersion=body.glue_version,
        NumberOfWorkers=body.number_of_workers,
        WorkerType=body.worker_type,
    )
    return {"name": body.name}


@router.delete("/jobs/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_job(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    client.delete_job(JobName=name)


@router.post("/jobs/{name}/start", dependencies=[RequireOperator])
async def start_job(
    instance_id, name: str, body: StartJobRunRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    kwargs: dict = {"JobName": name}
    if body.arguments:
        kwargs["Arguments"] = body.arguments
    resp = client.start_job_run(**kwargs)
    return {"job_run_id": resp["JobRunId"]}


@router.get("/jobs/{name}/runs", dependencies=[RequireViewer])
async def get_job_runs(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "glue")
    resp = client.get_job_runs(JobName=name)
    runs = []
    for jr in resp.get("JobRuns", []):
        runs.append({
            "id": jr["Id"],
            "job_name": jr.get("JobName", name),
            "run_id": jr["Id"],
            "attempt": jr.get("Attempt", 0),
            "triggered_by": jr.get("TriggeredBy", ""),
            "started_on": str(jr.get("StartedOn", "")),
            "last_modified_on": str(jr.get("LastModifiedOn", "")),
            "completed_on": str(jr.get("CompletedOn", "")),
            "job_run_state": jr.get("JobRunState", ""),
            "error_message": jr.get("ErrorMessage", ""),
            "execution_time": jr.get("ExecutionTime", 0),
        })
    return runs
