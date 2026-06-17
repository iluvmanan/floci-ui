"""AppSync resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/appsync", tags=["appsync"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateAPIRequest(BaseModel):
    name: str
    authentication_type: str = "API_KEY"  # API_KEY|AWS_IAM|AMAZON_COGNITO_USER_POOLS|OPENID_CONNECT


class CreateDataSourceRequest(BaseModel):
    name: str
    type: str  # AMAZON_DYNAMODB|AWS_LAMBDA|AMAZON_OPENSEARCH|HTTP|NONE
    description: Optional[str] = None
    service_role_arn: Optional[str] = None
    dynamodb_config: Optional[dict] = None
    lambda_config: Optional[dict] = None


# ─── APIs ─────────────────────────────────────────────────────────────────────

@router.get("/apis", dependencies=[RequireViewer])
async def list_apis(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    resp = client.list_graphql_apis()
    return [
        {
            "api_id": a["apiId"],
            "name": a.get("name", ""),
            "authentication_type": a.get("authenticationType", ""),
            "uris": a.get("uris", {}),
            "arn": a.get("arn", ""),
            "tags": a.get("tags", {}),
        }
        for a in resp.get("graphqlApis", [])
    ]


@router.post("/apis", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_api(
    instance_id, body: CreateAPIRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    resp = client.create_graphql_api(
        name=body.name, authenticationType=body.authentication_type
    )
    api = resp["graphqlApi"]
    return {
        "api_id": api["apiId"],
        "name": api.get("name", ""),
        "uris": api.get("uris", {}),
    }


@router.delete("/apis/{api_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_api(instance_id, api_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    client.delete_graphql_api(apiId=api_id)


@router.get("/apis/{api_id}/schema", dependencies=[RequireViewer])
async def get_schema(instance_id, api_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    try:
        resp = client.get_introspection_schema(apiId=api_id, format="SDL")
        schema = resp["schema"]
        if isinstance(schema, bytes):
            schema = schema.decode()
        elif hasattr(schema, "read"):
            schema = schema.read().decode()
        else:
            schema = str(schema)
        return {"schema": schema}
    except Exception as e:
        return {"schema": "", "error": str(e)}


# ─── Data Sources ─────────────────────────────────────────────────────────────

@router.get("/apis/{api_id}/datasources", dependencies=[RequireViewer])
async def list_data_sources(instance_id, api_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    resp = client.list_data_sources(apiId=api_id)
    return [
        {
            "name": ds.get("name", ""),
            "type": ds.get("type", ""),
            "description": ds.get("description", ""),
            "service_role_arn": ds.get("serviceRoleArn", ""),
            "dynamodb_config": ds.get("dynamodbConfig"),
            "lambda_config": ds.get("lambdaConfig"),
        }
        for ds in resp.get("dataSources", [])
    ]


@router.post(
    "/apis/{api_id}/datasources",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def create_data_source(
    instance_id,
    api_id: str,
    body: CreateDataSourceRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    kwargs: dict = {"apiId": api_id, "name": body.name, "type": body.type}
    if body.description:
        kwargs["description"] = body.description
    if body.service_role_arn:
        kwargs["serviceRoleArn"] = body.service_role_arn
    if body.dynamodb_config:
        kwargs["dynamodbConfig"] = body.dynamodb_config
    if body.lambda_config:
        kwargs["lambdaConfig"] = body.lambda_config
    resp = client.create_data_source(**kwargs)
    ds = resp["dataSource"]
    return {
        "name": ds.get("name", ""),
        "type": ds.get("type", ""),
        "description": ds.get("description", ""),
        "service_role_arn": ds.get("serviceRoleArn", ""),
        "dynamodb_config": ds.get("dynamodbConfig"),
        "lambda_config": ds.get("lambdaConfig"),
    }


@router.delete(
    "/apis/{api_id}/datasources/{name}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_data_source(
    instance_id, api_id: str, name: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    client.delete_data_source(apiId=api_id, name=name)


# ─── Types ────────────────────────────────────────────────────────────────────

@router.get("/apis/{api_id}/types", dependencies=[RequireViewer])
async def list_types(instance_id, api_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "appsync")
    resp = client.list_types(apiId=api_id, format="SDL")
    return [
        {"name": t.get("name", ""), "definition": t.get("definition", "")}
        for t in resp.get("types", [])
    ]
