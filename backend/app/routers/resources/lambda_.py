import base64
import json
from typing import Optional
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
    description: Optional[str] = None
    memory_size: Optional[int] = None
    timeout: Optional[int] = None
    env_vars: Optional[dict] = None
    vpc_config: Optional[dict] = None


class InvokeRequest(BaseModel):
    payload: dict = {}


class UpdateCodeRequest(BaseModel):
    zip_base64: str


class UpdateConfigRequest(BaseModel):
    handler: Optional[str] = None
    memory_size: Optional[int] = None
    timeout: Optional[int] = None
    description: Optional[str] = None
    environment: Optional[dict] = None


class AliasCreate(BaseModel):
    name: str
    function_version: str
    description: Optional[str] = None


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
    kwargs = dict(
        FunctionName=body.function_name,
        Runtime=body.runtime,
        Handler=body.handler,
        Role=body.role,
        Code={"ZipFile": code_bytes},
    )
    if body.description is not None:
        kwargs["Description"] = body.description
    if body.memory_size is not None:
        kwargs["MemorySize"] = body.memory_size
    if body.timeout is not None:
        kwargs["Timeout"] = body.timeout
    if body.env_vars is not None:
        kwargs["Environment"] = {"Variables": body.env_vars}
    if body.vpc_config is not None:
        kwargs["VpcConfig"] = body.vpc_config
    resp = client.create_function(**kwargs)
    return {"name": resp["FunctionName"], "runtime": resp.get("Runtime", ""), "arn": resp.get("FunctionArn", "")}


@router.get("/functions/{name}", dependencies=[RequireViewer])
async def get_function(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    resp = client.get_function(FunctionName=name)
    c = resp["Configuration"]
    return {
        "name": c["FunctionName"],
        "arn": c["FunctionArn"],
        "runtime": c["Runtime"],
        "handler": c["Handler"],
        "role": c["Role"],
        "description": c.get("Description", ""),
        "memory_size": c["MemorySize"],
        "timeout": c["Timeout"],
        "environment": c.get("Environment", {}).get("Variables", {}),
        "layers": [l["Arn"] for l in c.get("Layers", [])],
        "vpc_config": c.get("VpcConfig", {}),
        "dead_letter_config": c.get("DeadLetterConfig", {}),
        "last_modified": c.get("LastModified", ""),
        "code_size": c.get("CodeSize", 0),
        "state": c.get("State", ""),
        "state_reason": c.get("StateReason", ""),
    }


@router.delete("/functions/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_function(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    client.delete_function(FunctionName=name)


@router.put("/functions/{name}/code", dependencies=[RequireOperator])
async def update_function_code(
    instance_id: UUID, name: str, body: UpdateCodeRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    code_bytes = base64.b64decode(body.zip_base64)
    client.update_function_code(FunctionName=name, ZipFile=code_bytes)
    return {"success": True}


@router.put("/functions/{name}/config", dependencies=[RequireOperator])
async def update_function_config(
    instance_id: UUID, name: str, body: UpdateConfigRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    kwargs: dict = {"FunctionName": name}
    if body.handler:
        kwargs["Handler"] = body.handler
    if body.memory_size:
        kwargs["MemorySize"] = body.memory_size
    if body.timeout:
        kwargs["Timeout"] = body.timeout
    if body.description is not None:
        kwargs["Description"] = body.description
    if body.environment is not None:
        kwargs["Environment"] = {"Variables": body.environment}
    client.update_function_configuration(**kwargs)
    return {"success": True}


@router.get("/functions/{name}/aliases", dependencies=[RequireViewer])
async def list_aliases(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    resp = client.list_aliases(FunctionName=name)
    return [
        {
            "name": a["Name"],
            "function_version": a["FunctionVersion"],
            "description": a.get("Description", ""),
        }
        for a in resp.get("Aliases", [])
    ]


@router.post("/functions/{name}/aliases", status_code=201, dependencies=[RequireOperator])
async def create_alias(
    instance_id: UUID, name: str, body: AliasCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "lambda")
    client.create_alias(
        FunctionName=name,
        Name=body.name,
        FunctionVersion=body.function_version,
        Description=body.description or "",
    )
    return {"success": True}


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
