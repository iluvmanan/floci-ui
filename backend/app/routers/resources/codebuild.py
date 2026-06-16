"""CodeBuild resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/codebuild", tags=["codebuild"])


# ─── Request Models ───────────────────────────────────────────────────────────

class SourceConfig(BaseModel):
    type: str  # GITHUB|S3|CODECOMMIT|BITBUCKET|NO_SOURCE
    location: Optional[str] = None


class EnvironmentConfig(BaseModel):
    type: str = "LINUX_CONTAINER"
    image: str
    compute_type: str = "BUILD_GENERAL1_SMALL"


class CreateProjectRequest(BaseModel):
    name: str
    source: SourceConfig
    environment: EnvironmentConfig
    service_role: str
    artifacts_type: Optional[str] = "NO_ARTIFACTS"


class EnvVarOverride(BaseModel):
    name: str
    value: str
    type: Optional[str] = "PLAINTEXT"


class StartBuildRequest(BaseModel):
    environment_variables_override: Optional[List[EnvVarOverride]] = None
    source_version: Optional[str] = None


# ─── Projects ─────────────────────────────────────────────────────────────────

@router.get("/projects", dependencies=[RequireViewer])
async def list_projects(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    names = client.list_projects().get("projects", [])
    if not names:
        return []
    resp = client.batch_get_projects(names=names)
    result = []
    for p in resp.get("projects", []):
        source = p.get("source", {})
        environment = p.get("environment", {})
        result.append({
            "name": p.get("name", ""),
            "arn": p.get("arn", ""),
            "description": p.get("description", ""),
            "source_type": source.get("type", ""),
            "source_location": source.get("location", ""),
            "environment_type": environment.get("type", ""),
            "environment_image": environment.get("image", ""),
            "compute_type": environment.get("computeType", ""),
            "service_role": p.get("serviceRole", ""),
            "created": str(p.get("created", "")),
            "last_modified": str(p.get("lastModified", "")),
        })
    return result


@router.post("/projects", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_project(
    instance_id, body: CreateProjectRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    source: dict = {"type": body.source.type}
    if body.source.location:
        source["location"] = body.source.location
    resp = client.create_project(
        name=body.name,
        source=source,
        environment={
            "type": body.environment.type,
            "image": body.environment.image,
            "computeType": body.environment.compute_type,
        },
        artifacts={"type": body.artifacts_type},
        serviceRole=body.service_role,
    )
    project = resp["project"]
    return {"name": project.get("name", ""), "arn": project.get("arn", "")}


@router.delete("/projects/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_project(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    client.delete_project(name=name)


@router.post("/projects/{name}/build", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def start_build(
    instance_id, name: str, body: StartBuildRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    kwargs: dict = {"projectName": name}
    if body.environment_variables_override:
        kwargs["environmentVariablesOverride"] = [
            {"name": v.name, "value": v.value, "type": v.type}
            for v in body.environment_variables_override
        ]
    if body.source_version:
        kwargs["sourceVersion"] = body.source_version
    resp = client.start_build(**kwargs)
    build = resp["build"]
    return {
        "build_id": build["id"],
        "build_status": build.get("buildStatus", ""),
        "start_time": str(build.get("startTime", "")),
    }


@router.get("/projects/{name}/builds", dependencies=[RequireViewer])
async def list_builds(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    ids = client.list_builds_for_project(projectName=name).get("ids", [])
    if not ids:
        return []
    resp = client.batch_get_builds(ids=ids)
    result = []
    for b in resp.get("builds", []):
        start_time = b.get("startTime")
        end_time = b.get("endTime")
        duration = None
        if start_time and end_time:
            try:
                duration = (end_time - start_time).total_seconds()
            except TypeError:
                duration = None
        result.append({
            "id": b.get("id", ""),
            "build_status": b.get("buildStatus", ""),
            "start_time": str(start_time) if start_time else "",
            "end_time": str(end_time) if end_time else "",
            "current_phase": b.get("currentPhase", ""),
            "duration_in_seconds": duration,
            "initiator": b.get("initiator", ""),
        })
    return result


@router.get("/builds/{build_id}", dependencies=[RequireViewer])
async def get_build(instance_id, build_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codebuild")
    resp = client.batch_get_builds(ids=[build_id])
    builds = resp.get("builds", [])
    if not builds:
        return {}
    b = builds[0]

    def _stringify(obj):
        if isinstance(obj, dict):
            return {k: _stringify(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_stringify(v) for v in obj]
        # datetime-like objects
        if hasattr(obj, "isoformat"):
            return str(obj)
        return obj

    return _stringify(b)
