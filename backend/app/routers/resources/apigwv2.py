from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/apigwv2", tags=["apigwv2"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateAPIv2Request(BaseModel):
    name: str
    protocol_type: str  # HTTP|WEBSOCKET
    route_key: Optional[str] = None  # e.g. "GET /pets"


class CreateRouteRequest(BaseModel):
    route_key: str
    target: Optional[str] = None


class CreateIntegrationRequest(BaseModel):
    integration_type: str  # HTTP_PROXY|AWS_PROXY|MOCK
    integration_uri: Optional[str] = None
    integration_method: Optional[str] = None
    payload_format_version: str = "2.0"


class CreateDeploymentV2Request(BaseModel):
    stage_name: str


# ─── APIs ─────────────────────────────────────────────────────────────────────

@router.get("/apis", dependencies=[RequireViewer])
async def list_apis_v2(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.get_apis()
    return [
        {
            "api_id": a["ApiId"],
            "name": a.get("Name", ""),
            "protocol_type": a.get("ProtocolType", ""),
            "api_endpoint": a.get("ApiEndpoint", ""),
            "created_date": str(a.get("CreatedDate", "")),
            "tags": a.get("Tags", {}),
        }
        for a in resp.get("Items", [])
    ]


@router.post("/apis", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_api_v2(
    instance_id: str,
    body: CreateAPIv2Request,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    kwargs: dict = {"Name": body.name, "ProtocolType": body.protocol_type}
    if body.protocol_type == "HTTP":
        kwargs["RouteKey"] = body.route_key or "$default"
    resp = client.create_api(**kwargs)
    return {"api_id": resp["ApiId"], "api_endpoint": resp.get("ApiEndpoint", "")}


@router.delete("/apis/{api_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_api_v2(
    instance_id: str,
    api_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    client.delete_api(ApiId=api_id)


@router.get("/apis/{api_id}/routes", dependencies=[RequireViewer])
async def list_routes_v2(
    instance_id: str,
    api_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.get_routes(ApiId=api_id)
    return [
        {
            "route_id": r["RouteId"],
            "route_key": r.get("RouteKey", ""),
            "target": r.get("Target", ""),
            "api_key_required": r.get("ApiKeyRequired", False),
        }
        for r in resp.get("Items", [])
    ]


@router.post("/apis/{api_id}/routes", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_route_v2(
    instance_id: str,
    api_id: str,
    body: CreateRouteRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.create_route(
        ApiId=api_id,
        RouteKey=body.route_key,
        Target=body.target or "",
    )
    return {"route_id": resp["RouteId"], "route_key": resp["RouteKey"]}


@router.get("/apis/{api_id}/integrations", dependencies=[RequireViewer])
async def list_integrations_v2(
    instance_id: str,
    api_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.get_integrations(ApiId=api_id)
    return [
        {
            "integration_id": i["IntegrationId"],
            "integration_type": i.get("IntegrationType", ""),
            "integration_uri": i.get("IntegrationUri", ""),
            "integration_method": i.get("IntegrationMethod", ""),
            "payload_format_version": i.get("PayloadFormatVersion", ""),
        }
        for i in resp.get("Items", [])
    ]


@router.post("/apis/{api_id}/integrations", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_integration_v2(
    instance_id: str,
    api_id: str,
    body: CreateIntegrationRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.create_integration(
        ApiId=api_id,
        IntegrationType=body.integration_type,
        IntegrationUri=body.integration_uri or "",
        IntegrationMethod=body.integration_method or "POST",
        PayloadFormatVersion=body.payload_format_version,
    )
    return {"integration_id": resp["IntegrationId"]}


@router.get("/apis/{api_id}/stages", dependencies=[RequireViewer])
async def list_stages_v2(
    instance_id: str,
    api_id: str,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.get_stages(ApiId=api_id)
    return [
        {
            "stage_name": s["StageName"],
            "auto_deploy": s.get("AutoDeploy", False),
            "last_deployment_status_message": s.get("LastDeploymentStatusMessage", ""),
            "created_date": str(s.get("CreatedDate", "")),
        }
        for s in resp.get("Items", [])
    ]


@router.post("/apis/{api_id}/deployments", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_deployment_v2(
    instance_id: str,
    api_id: str,
    body: CreateDeploymentV2Request,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigatewayv2")
    resp = client.create_deployment(ApiId=api_id, StageName=body.stage_name)
    return {"deployment_id": resp["DeploymentId"]}
