from typing import Optional

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/apigw", tags=["apigw"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateRestAPIRequest(BaseModel):
    name: str
    description: Optional[str] = None
    endpoint_type: str = "REGIONAL"  # REGIONAL|EDGE|PRIVATE


class CreateResourceRequest(BaseModel):
    parent_id: str
    path_part: str


class CreateDeploymentRequest(BaseModel):
    stage_name: str
    description: Optional[str] = None


class CreateAPIKeyRequest(BaseModel):
    name: str
    enabled: bool = True


# ─── REST APIs ────────────────────────────────────────────────────────────────

@router.get("/rest-apis")
async def list_rest_apis(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.get_rest_apis()
    return [
        {
            "id": a["id"],
            "name": a.get("name", ""),
            "description": a.get("description", ""),
            "endpoint_configuration": a.get("endpointConfiguration", {}).get("types", []),
            "created_date": str(a.get("createdDate", "")),
        }
        for a in resp.get("items", [])
    ]


@router.post("/rest-apis", status_code=status.HTTP_201_CREATED)
async def create_rest_api(
    instance_id: str,
    body: CreateRestAPIRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.create_rest_api(
        name=body.name,
        description=body.description or "",
        endpointConfiguration={"types": [body.endpoint_type]},
    )
    return {"id": resp["id"], "name": resp["name"]}


@router.delete("/rest-apis/{api_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rest_api(
    instance_id: str,
    api_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    client.delete_rest_api(restApiId=api_id)


@router.get("/rest-apis/{api_id}/resources")
async def list_api_resources(
    instance_id: str,
    api_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.get_resources(restApiId=api_id)
    return [
        {
            "id": r["id"],
            "parent_id": r.get("parentId", ""),
            "path": r.get("path", ""),
            "path_part": r.get("pathPart", ""),
            "resource_methods": list(r.get("resourceMethods", {}).keys()),
        }
        for r in resp.get("items", [])
    ]


@router.post("/rest-apis/{api_id}/resources", status_code=status.HTTP_201_CREATED)
async def create_api_resource(
    instance_id: str,
    api_id: str,
    body: CreateResourceRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.create_resource(
        restApiId=api_id,
        parentId=body.parent_id,
        pathPart=body.path_part,
    )
    return {"id": resp["id"], "path": resp.get("path", "")}


@router.post("/rest-apis/{api_id}/deployments", status_code=status.HTTP_201_CREATED)
async def create_api_deployment(
    instance_id: str,
    api_id: str,
    body: CreateDeploymentRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.create_deployment(
        restApiId=api_id,
        stageName=body.stage_name,
        description=body.description or "",
    )
    return {"id": resp["id"], "created_date": str(resp.get("createdDate", ""))}


@router.get("/rest-apis/{api_id}/stages")
async def list_api_stages(
    instance_id: str,
    api_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.get_stages(restApiId=api_id)
    return [
        {
            "stage_name": s["stageName"],
            "deployment_id": s.get("deploymentId", ""),
            "description": s.get("description", ""),
            "created_date": str(s.get("createdDate", "")),
            "last_updated_date": str(s.get("lastUpdatedDate", "")),
        }
        for s in resp.get("item", [])
    ]


# ─── API Keys ─────────────────────────────────────────────────────────────────

@router.get("/api-keys")
async def list_api_keys(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.get_api_keys(includeValues=True)
    return [
        {
            "id": k["id"],
            "name": k.get("name", ""),
            "enabled": k.get("enabled", False),
            "value": k.get("value", ""),
            "created_date": str(k.get("createdDate", "")),
        }
        for k in resp.get("items", [])
    ]


@router.post("/api-keys", status_code=status.HTTP_201_CREATED)
async def create_api_key(
    instance_id: str,
    body: CreateAPIKeyRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    resp = client.create_api_key(name=body.name, enabled=body.enabled)
    return {"id": resp["id"], "name": resp["name"], "value": resp.get("value", "")}


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    instance_id: str,
    key_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "apigateway")
    client.delete_api_key(apiKey=key_id)
