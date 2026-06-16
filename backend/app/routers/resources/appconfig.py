"""AppConfig resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/appconfig", tags=["appconfig"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateAppRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CreateEnvRequest(BaseModel):
    name: str
    description: Optional[str] = None


class CreateProfileRequest(BaseModel):
    name: str
    location_uri: str = "hosted"
    validator_types: Optional[List[str]] = None


class StartDeploymentRequest(BaseModel):
    environment_id: str
    configuration_profile_id: str
    deployment_strategy_id: Optional[str] = "AppConfig.AllAtOnce"
    configuration_version: str


# ─── Applications ─────────────────────────────────────────────────────────────

@router.get("/applications", dependencies=[RequireViewer])
async def list_applications(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    resp = client.list_applications()
    return [
        {
            "id": a["Id"],
            "name": a.get("Name", ""),
            "description": a.get("Description", ""),
        }
        for a in resp.get("Items", [])
    ]


@router.post("/applications", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_application(
    instance_id, body: CreateAppRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    kwargs: dict = {"Name": body.name}
    if body.description:
        kwargs["Description"] = body.description
    resp = client.create_application(**kwargs)
    return {"id": resp["Id"], "name": resp.get("Name", "")}


@router.delete("/applications/{app_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_application(instance_id, app_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    client.delete_application(ApplicationId=app_id)


# ─── Environments ─────────────────────────────────────────────────────────────

@router.get("/applications/{app_id}/environments", dependencies=[RequireViewer])
async def list_environments(instance_id, app_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    resp = client.list_environments(ApplicationId=app_id)
    return [
        {
            "id": e["Id"],
            "application_id": app_id,
            "name": e.get("Name", ""),
            "state": e.get("State", ""),
            "description": e.get("Description", ""),
        }
        for e in resp.get("Items", [])
    ]


@router.post(
    "/applications/{app_id}/environments",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def create_environment(
    instance_id, app_id: str, body: CreateEnvRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    kwargs: dict = {"ApplicationId": app_id, "Name": body.name}
    if body.description:
        kwargs["Description"] = body.description
    resp = client.create_environment(**kwargs)
    return {
        "id": resp["Id"],
        "application_id": app_id,
        "name": resp.get("Name", ""),
        "state": resp.get("State", ""),
        "description": resp.get("Description", ""),
    }


@router.delete(
    "/applications/{app_id}/environments/{env_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_environment(
    instance_id, app_id: str, env_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    client.delete_environment(ApplicationId=app_id, EnvironmentId=env_id)


# ─── Configuration Profiles ────────────────────────────────────────────────────

@router.get("/applications/{app_id}/configurationprofiles", dependencies=[RequireViewer])
async def list_configuration_profiles(
    instance_id, app_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    resp = client.list_configuration_profiles(ApplicationId=app_id)
    return [
        {
            "id": p["Id"],
            "application_id": app_id,
            "name": p.get("Name", ""),
            "location_uri": p.get("LocationUri", ""),
            "validator_types": [v.get("Type") for v in p.get("ValidatorTypes", [])] if p.get("ValidatorTypes") else [],
        }
        for p in resp.get("Items", [])
    ]


@router.post(
    "/applications/{app_id}/configurationprofiles",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def create_configuration_profile(
    instance_id,
    app_id: str,
    body: CreateProfileRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    kwargs: dict = {
        "ApplicationId": app_id,
        "Name": body.name,
        "LocationUri": body.location_uri,
    }
    if body.validator_types:
        kwargs["Validators"] = [{"Type": t} for t in body.validator_types]
    resp = client.create_configuration_profile(**kwargs)
    return {
        "id": resp["Id"],
        "application_id": app_id,
        "name": resp.get("Name", ""),
        "location_uri": resp.get("LocationUri", ""),
        "validator_types": [v.get("Type") for v in resp.get("Validators", [])] if resp.get("Validators") else [],
    }


# ─── Deployments ───────────────────────────────────────────────────────────────

@router.post(
    "/applications/{app_id}/deployments",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def start_deployment(
    instance_id,
    app_id: str,
    body: StartDeploymentRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    resp = client.start_deployment(
        ApplicationId=app_id,
        EnvironmentId=body.environment_id,
        ConfigurationProfileId=body.configuration_profile_id,
        DeploymentStrategyId=body.deployment_strategy_id,
        ConfigurationVersion=body.configuration_version,
    )
    return {
        "deployment_number": resp.get("DeploymentNumber"),
        "state": resp.get("State", ""),
    }


@router.get(
    "/applications/{app_id}/environments/{env_id}/deployments",
    dependencies=[RequireViewer],
)
async def list_deployments(
    instance_id, app_id: str, env_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appconfig")
    resp = client.list_deployments(ApplicationId=app_id, EnvironmentId=env_id)
    return [
        {
            "deployment_number": d.get("DeploymentNumber"),
            "state": d.get("State", ""),
            "configuration_profile_id": d.get("ConfigurationProfileId", ""),
            "deployment_strategy_id": d.get("DeploymentStrategyId", ""),
            "started_at": str(d.get("StartedAt", "")),
            "completed_at": str(d.get("CompletedAt", "")),
        }
        for d in resp.get("Items", [])
    ]
