import json
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/cfn", tags=["cfn"])


# ─── Request Models ───────────────────────────────────────────────────────────

class StackParameter(BaseModel):
    key: str
    value: str


class CreateStackRequest(BaseModel):
    stack_name: str
    template_body: Optional[str] = None
    template_url: Optional[str] = None
    parameters: Optional[List[StackParameter]] = None
    capabilities: Optional[List[str]] = None
    tags: Optional[dict] = None


class UpdateStackRequest(BaseModel):
    template_body: Optional[str] = None
    template_url: Optional[str] = None
    parameters: Optional[List[StackParameter]] = None
    capabilities: Optional[List[str]] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _stack_summary(stack: dict) -> dict:
    return {
        "stack_name": stack.get("StackName"),
        "stack_id": stack.get("StackId"),
        "stack_status": stack.get("StackStatus"),
        "creation_time": str(stack.get("CreationTime", "")),
        "last_updated_time": str(stack.get("LastUpdatedTime", "")),
        "description": stack.get("Description"),
        "outputs": stack.get("Outputs", []),
        "parameters": stack.get("Parameters", []),
        "tags": stack.get("Tags", []),
    }


def _build_kwargs(
    parameters: Optional[List[StackParameter]],
    capabilities: Optional[List[str]],
    template_body: Optional[str],
    template_url: Optional[str],
) -> dict:
    kwargs: dict = {}
    if template_body:
        kwargs["TemplateBody"] = template_body
    if template_url:
        kwargs["TemplateURL"] = template_url
    if parameters:
        kwargs["Parameters"] = [
            {"ParameterKey": p.key, "ParameterValue": p.value} for p in parameters
        ]
    if capabilities:
        kwargs["Capabilities"] = capabilities
    return kwargs


# ─── Stacks ───────────────────────────────────────────────────────────────────

@router.get("/stacks", dependencies=[RequireViewer])
async def list_stacks(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    resp = client.describe_stacks()
    stacks = [
        s for s in resp.get("Stacks", []) if s.get("StackStatus") != "DELETE_COMPLETE"
    ]
    return [_stack_summary(s) for s in stacks]


@router.post("/stacks", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_stack(
    instance_id, body: CreateStackRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    kwargs = _build_kwargs(body.parameters, body.capabilities, body.template_body, body.template_url)
    kwargs["StackName"] = body.stack_name
    if body.tags:
        kwargs["Tags"] = [{"Key": k, "Value": v} for k, v in body.tags.items()]
    resp = client.create_stack(**kwargs)
    return {"stack_id": resp["StackId"]}


@router.put("/stacks/{name}", dependencies=[RequireOperator])
async def update_stack(
    instance_id, name: str, body: UpdateStackRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    kwargs = _build_kwargs(body.parameters, body.capabilities, body.template_body, body.template_url)
    resp = client.update_stack(StackName=name, **kwargs)
    return {"stack_id": resp["StackId"]}


@router.delete("/stacks/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_stack(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    client.delete_stack(StackName=name)


@router.get("/stacks/{name}", dependencies=[RequireViewer])
async def describe_stack(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    resp = client.describe_stacks(StackName=name)
    stack = resp["Stacks"][0]
    summary = _stack_summary(stack)
    summary["stack_status_reason"] = stack.get("StackStatusReason")
    return summary


@router.get("/stacks/{name}/events", dependencies=[RequireViewer])
async def get_stack_events(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    resp = client.describe_stack_events(StackName=name)
    return [
        {
            "event_id": e.get("EventId"),
            "resource_type": e.get("ResourceType"),
            "logical_resource_id": e.get("LogicalResourceId"),
            "physical_resource_id": e.get("PhysicalResourceId"),
            "resource_status": e.get("ResourceStatus"),
            "resource_status_reason": e.get("ResourceStatusReason"),
            "timestamp": str(e.get("Timestamp", "")),
        }
        for e in resp.get("StackEvents", [])
    ]


@router.get("/stacks/{name}/resources", dependencies=[RequireViewer])
async def get_stack_resources(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    resp = client.list_stack_resources(StackName=name)
    return [
        {
            "logical_resource_id": r.get("LogicalResourceId"),
            "physical_resource_id": r.get("PhysicalResourceId"),
            "resource_type": r.get("ResourceType"),
            "resource_status": r.get("ResourceStatus"),
            "last_updated_timestamp": str(r.get("LastUpdatedTimestamp", "")),
        }
        for r in resp.get("StackResourceSummaries", [])
    ]


@router.get("/stacks/{name}/template", dependencies=[RequireViewer])
async def get_stack_template(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudformation")
    resp = client.get_template(StackName=name)
    template_body = resp.get("TemplateBody", "")
    if isinstance(template_body, dict):
        template_body = json.dumps(template_body, indent=2)
    return {"template_body": template_body}
