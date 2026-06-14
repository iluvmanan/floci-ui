import base64
import json
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/lambda", tags=["lambda"])


class FunctionCreate(BaseModel):
    function_name: str
    runtime: str
    handler: str
    role: str = "arn:aws:iam::000000000000:role/lambda-role"
    code_zip_base64: str


class InvokeRequest(BaseModel):
    payload: dict = {}


@router.get("/functions", dependencies=[RequireViewer])
async def list_functions(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    resp = client.list_functions()
    return [
        {
            "name": f["FunctionName"],
            "runtime": f.get("Runtime", ""),
            "memory": f.get("MemorySize", 128),
            "timeout": f.get("Timeout", 3),
            "handler": f.get("Handler", ""),
            "last_modified": f.get("LastModified", ""),
        }
        for f in resp.get("Functions", [])
    ]


@router.post("/functions", status_code=201, dependencies=[RequireOperator])
async def create_function(
    instance_id: UUID, body: FunctionCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    code_bytes = base64.b64decode(body.code_zip_base64)
    resp = client.create_function(
        FunctionName=body.function_name,
        Runtime=body.runtime,
        Handler=body.handler,
        Role=body.role,
        Code={"ZipFile": code_bytes},
    )
    return {"name": resp["FunctionName"], "runtime": resp.get("Runtime", ""), "arn": resp.get("FunctionArn", "")}


@router.delete("/functions/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_function(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    client.delete_function(FunctionName=name)


@router.post("/functions/{name}/invoke", dependencies=[RequireOperator])
async def invoke_function(
    instance_id: UUID, name: str, body: InvokeRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    resp = client.invoke(
        FunctionName=name,
        Payload=json.dumps(body.payload).encode(),
        LogType="Tail",
    )
    payload_bytes = resp["Payload"].read()
    log_b64 = resp.get("LogResult", "")
    log_tail = base64.b64decode(log_b64).decode("utf-8", errors="replace") if log_b64 else ""
    try:
        result = json.loads(payload_bytes)
    except Exception:
        result = payload_bytes.decode("utf-8", errors="replace")
    return {
        "status_code": resp.get("StatusCode", 0),
        "result": result,
        "log_tail": log_tail,
        "function_error": resp.get("FunctionError"),
    }


@router.get("/functions/{name}/logs", dependencies=[RequireViewer])
async def get_function_logs(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    cw = _rb.get_client(inst, "logs")
    log_group = f"/aws/lambda/{name}"
    try:
        streams_resp = cw.describe_log_streams(
            logGroupName=log_group, orderBy="LastEventTime", descending=True, limit=1
        )
        streams = streams_resp.get("logStreams", [])
        if not streams:
            return {"lines": []}
        stream_name = streams[0]["logStreamName"]
        events_resp = cw.get_log_events(
            logGroupName=log_group, logStreamName=stream_name, limit=100, startFromHead=False
        )
        return {"lines": [e["message"] for e in events_resp.get("events", [])]}
    except Exception:
        return {"lines": []}
