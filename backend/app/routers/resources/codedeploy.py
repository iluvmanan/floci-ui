"""CodeDeploy resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/codedeploy", tags=["codedeploy"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateAppRequest(BaseModel):
    application_name: str
    compute_platform: Optional[str] = "Server"  # Server|Lambda|ECS


class CreateGroupRequest(BaseModel):
    deployment_group_name: str
    service_role_arn: str
    deployment_config_name: Optional[str] = None
    ec2_tag_filters: Optional[List[dict]] = None


class S3Location(BaseModel):
    bucket: str
    key: str
    bundle_type: Optional[str] = "zip"


class CreateDeploymentRequest(BaseModel):
    application_name: str
    deployment_group_name: str
    s3_location: S3Location
    description: Optional[str] = None


def _stringify(obj):
    if isinstance(obj, dict):
        return {k: _stringify(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_stringify(v) for v in obj]
    if hasattr(obj, "isoformat"):
        return str(obj)
    return obj


# ─── Applications ─────────────────────────────────────────────────────────────

@router.get("/applications", dependencies=[RequireViewer])
async def list_applications(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    names = client.list_applications().get("applications", [])
    if not names:
        return []
    resp = client.batch_get_applications(applicationNames=names)
    result = []
    for info in resp.get("applicationsInfo", []):
        result.append({
            "application_id": info.get("applicationId", ""),
            "application_name": info.get("applicationName", ""),
            "compute_platform": info.get("computePlatform", ""),
            "linked_to_github": info.get("linkedToGitHub", False),
            "create_time": str(info.get("createTime", "")),
        })
    return result


@router.post("/applications", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_application(
    instance_id, body: CreateAppRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    resp = client.create_application(
        applicationName=body.application_name, computePlatform=body.compute_platform
    )
    return {"application_id": resp.get("applicationId", "")}


@router.delete("/applications/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_application(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    client.delete_application(applicationName=name)


# ─── Deployment Groups ─────────────────────────────────────────────────────────

@router.get("/applications/{name}/groups", dependencies=[RequireViewer])
async def list_deployment_groups(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    group_names = client.list_deployment_groups(applicationName=name).get(
        "deploymentGroups", []
    )
    if not group_names:
        return []
    resp = client.batch_get_deployment_groups(
        applicationName=name, deploymentGroupNames=group_names
    )
    result = []
    for g in resp.get("deploymentGroupsInfo", []):
        result.append({
            "deployment_group_id": g.get("deploymentGroupId", ""),
            "deployment_group_name": g.get("deploymentGroupName", ""),
            "deployment_config_name": g.get("deploymentConfigName", ""),
            "target_revision": g.get("targetRevision", {}),
        })
    return result


@router.post(
    "/applications/{name}/groups",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def create_deployment_group(
    instance_id, name: str, body: CreateGroupRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    kwargs: dict = {
        "applicationName": name,
        "deploymentGroupName": body.deployment_group_name,
        "serviceRoleArn": body.service_role_arn,
    }
    if body.deployment_config_name:
        kwargs["deploymentConfigName"] = body.deployment_config_name
    if body.ec2_tag_filters:
        kwargs["ec2TagFilters"] = body.ec2_tag_filters
    resp = client.create_deployment_group(**kwargs)
    return {"deployment_group_id": resp.get("deploymentGroupId", "")}


# ─── Deployments ───────────────────────────────────────────────────────────────

@router.post("/deployments", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_deployment(
    instance_id, body: CreateDeploymentRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    kwargs: dict = {
        "applicationName": body.application_name,
        "deploymentGroupName": body.deployment_group_name,
        "revision": {
            "revisionType": "S3",
            "s3Location": {
                "bucket": body.s3_location.bucket,
                "key": body.s3_location.key,
                "bundleType": body.s3_location.bundle_type,
            },
        },
    }
    if body.description:
        kwargs["description"] = body.description
    resp = client.create_deployment(**kwargs)
    return {"deployment_id": resp.get("deploymentId", "")}


@router.get("/applications/{name}/deployments", dependencies=[RequireViewer])
async def list_deployments(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    ids = client.list_deployments(applicationName=name).get("deployments", [])
    if not ids:
        return []
    resp = client.batch_get_deployments(deploymentIds=ids)
    result = []
    for d in resp.get("deploymentsInfo", []):
        result.append({
            "deployment_id": d.get("deploymentId", ""),
            "status": d.get("status", ""),
            "deployment_group_name": d.get("deploymentGroupName", ""),
            "deployment_config_name": d.get("deploymentConfigName", ""),
            "created_at": str(d.get("createTime", "")),
            "complete_at": str(d.get("completeTime", "")),
            "description": d.get("description", ""),
        })
    return result


@router.get("/deployments/{deployment_id}", dependencies=[RequireViewer])
async def get_deployment(instance_id, deployment_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "codedeploy")
    resp = client.get_deployment(deploymentId=deployment_id)
    info = resp.get("deploymentInfo", {})
    return _stringify(info)
