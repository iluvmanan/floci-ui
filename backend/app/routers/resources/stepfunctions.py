from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/stepfunctions", tags=["stepfunctions"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateStateMachineRequest(BaseModel):
    name: str
    definition: str  # JSON string (ASL)
    role_arn: str
    type: Optional[str] = "STANDARD"  # STANDARD|EXPRESS


class UpdateStateMachineRequest(BaseModel):
    definition: Optional[str] = None
    role_arn: Optional[str] = None


class StartExecutionRequest(BaseModel):
    input: Optional[str] = None  # JSON string
    name: Optional[str] = None


class StopExecutionRequest(BaseModel):
    cause: Optional[str] = None
    error: Optional[str] = None


# ─── State Machines ───────────────────────────────────────────────────────────

@router.get("/state-machines", dependencies=[RequireViewer])
async def list_state_machines(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    resp = client.list_state_machines()
    return [
        {
            "state_machine_arn": sm.get("stateMachineArn"),
            "name": sm.get("name"),
            "type": sm.get("type"),
            "creation_date": str(sm.get("creationDate", "")),
        }
        for sm in resp.get("stateMachines", [])
    ]


@router.post("/state-machines", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_state_machine(
    instance_id, body: CreateStateMachineRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    resp = client.create_state_machine(
        name=body.name,
        definition=body.definition,
        roleArn=body.role_arn,
        type=body.type,
    )
    return {
        "state_machine_arn": resp["stateMachineArn"],
        "creation_date": str(resp.get("creationDate", "")),
    }


@router.delete("/state-machines/{arn:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_state_machine(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    client.delete_state_machine(stateMachineArn=arn)


@router.get("/state-machines/{arn:path}", dependencies=[RequireViewer])
async def describe_state_machine(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    resp = client.describe_state_machine(stateMachineArn=arn)
    return {
        "definition": resp.get("definition"),
        "role_arn": resp.get("roleArn"),
        "status": resp.get("status"),
        "type": resp.get("type"),
        "creation_date": str(resp.get("creationDate", "")),
        "name": resp.get("name"),
    }


@router.put("/state-machines/{arn:path}", dependencies=[RequireOperator])
async def update_state_machine(
    instance_id, arn: str, body: UpdateStateMachineRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    kwargs: dict = {"stateMachineArn": arn}
    if body.definition is not None:
        kwargs["definition"] = body.definition
    if body.role_arn is not None:
        kwargs["roleArn"] = body.role_arn
    resp = client.update_state_machine(**kwargs)
    return {"update_date": str(resp.get("updateDate", ""))}


# ─── Executions ───────────────────────────────────────────────────────────────

@router.get("/state-machines/{arn:path}/executions", dependencies=[RequireViewer])
async def list_executions(instance_id, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    resp = client.list_executions(stateMachineArn=arn)
    return [
        {
            "execution_arn": e.get("executionArn"),
            "name": e.get("name"),
            "status": e.get("status"),
            "start_date": str(e.get("startDate", "")),
            "stop_date": str(e.get("stopDate", "")) if e.get("stopDate") else None,
        }
        for e in resp.get("executions", [])
    ]


@router.post("/state-machines/{arn:path}/executions", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def start_execution(
    instance_id, arn: str, body: StartExecutionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    kwargs: dict = {"stateMachineArn": arn}
    if body.input is not None:
        kwargs["input"] = body.input
    if body.name is not None:
        kwargs["name"] = body.name
    resp = client.start_execution(**kwargs)
    return {
        "execution_arn": resp["executionArn"],
        "start_date": str(resp.get("startDate", "")),
    }


@router.post("/executions/{exec_arn:path}/stop", dependencies=[RequireOperator])
async def stop_execution(
    instance_id, exec_arn: str, body: StopExecutionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    kwargs: dict = {"executionArn": exec_arn}
    if body.cause is not None:
        kwargs["cause"] = body.cause
    if body.error is not None:
        kwargs["error"] = body.error
    resp = client.stop_execution(**kwargs)
    return {"stop_date": str(resp.get("stopDate", ""))}


@router.get("/executions/{exec_arn:path}", dependencies=[RequireViewer])
async def describe_execution(instance_id, exec_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "stepfunctions")
    resp = client.describe_execution(executionArn=exec_arn)
    return {
        "status": resp.get("status"),
        "input": resp.get("input"),
        "output": resp.get("output"),
        "start_date": str(resp.get("startDate", "")),
        "stop_date": str(resp.get("stopDate", "")) if resp.get("stopDate") else None,
        "input_details": resp.get("inputDetails"),
        "output_details": resp.get("outputDetails"),
    }
