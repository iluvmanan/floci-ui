from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/cognito", tags=["cognito"])


class UserCreate(BaseModel):
    username: str
    email: str
    temp_password: str


class UpdateUserAttributes(BaseModel):
    attributes: list[dict]


class AppClientCreate(BaseModel):
    client_name: str
    generate_secret: bool = False


@router.get("/user-pools", dependencies=[RequireViewer])
async def list_user_pools(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    resp = client.list_user_pools(MaxResults=60)
    return [{"id": p["Id"], "name": p["Name"]} for p in resp.get("UserPools", [])]


@router.get("/user-pools/{pool_id}/users", dependencies=[RequireViewer])
async def list_users(
    instance_id: UUID,
    pool_id: str,
    limit: int = Query(60, le=60),
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    kwargs: dict = {"UserPoolId": pool_id, "Limit": limit}
    if token:
        kwargs["PaginationToken"] = token
    resp = client.list_users(**kwargs)
    return [
        {
            "username": u["Username"],
            "status": u.get("UserStatus", ""),
            "enabled": u.get("Enabled", True),
            "attributes": {a["Name"]: a["Value"] for a in u.get("Attributes", [])},
        }
        for u in resp.get("Users", [])
    ]


@router.post("/user-pools/{pool_id}/users", status_code=201, dependencies=[RequireOperator])
async def create_user(
    instance_id: UUID, pool_id: str, body: UserCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    resp = client.admin_create_user(
        UserPoolId=pool_id,
        Username=body.username,
        TemporaryPassword=body.temp_password,
        UserAttributes=[{"Name": "email", "Value": body.email}],
    )
    user = resp["User"]
    return {
        "username": user["Username"],
        "status": user.get("UserStatus", ""),
        "attributes": {a["Name"]: a["Value"] for a in user.get("Attributes", [])},
    }


@router.delete("/user-pools/{pool_id}/users/{username}", status_code=204, dependencies=[RequireOperator])
async def delete_user(
    instance_id: UUID, pool_id: str, username: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    client.admin_delete_user(UserPoolId=pool_id, Username=username)


@router.get("/user-pools/{pool_id}", dependencies=[RequireViewer])
async def describe_user_pool(
    instance_id: UUID, pool_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    resp = client.describe_user_pool(UserPoolId=pool_id)
    p = resp["UserPool"]
    return {
        "id": p["Id"],
        "name": p["Name"],
        "status": p.get("Status", ""),
        "mfa_configuration": p.get("MfaConfiguration", "OFF"),
        "estimated_number_of_users": p.get("EstimatedNumberOfUsers", 0),
        "creation_date": str(p.get("CreationDate", "")),
        "last_modified_date": str(p.get("LastModifiedDate", "")),
    }


@router.post("/user-pools/{pool_id}/users/{username}/enable", dependencies=[RequireOperator])
async def enable_user(
    instance_id: UUID, pool_id: str, username: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    client.admin_enable_user(UserPoolId=pool_id, Username=username)
    return {"success": True}


@router.post("/user-pools/{pool_id}/users/{username}/disable", dependencies=[RequireOperator])
async def disable_user(
    instance_id: UUID, pool_id: str, username: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    client.admin_disable_user(UserPoolId=pool_id, Username=username)
    return {"success": True}


@router.post("/user-pools/{pool_id}/users/{username}/reset-password", dependencies=[RequireOperator])
async def reset_user_password(
    instance_id: UUID, pool_id: str, username: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    client.admin_reset_user_password(UserPoolId=pool_id, Username=username)
    return {"success": True}


@router.put("/user-pools/{pool_id}/users/{username}", dependencies=[RequireOperator])
async def update_user_attributes(
    instance_id: UUID, pool_id: str, username: str, body: UpdateUserAttributes, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    client.admin_update_user_attributes(UserPoolId=pool_id, Username=username, UserAttributes=body.attributes)
    return {"success": True}


@router.get("/user-pools/{pool_id}/app-clients", dependencies=[RequireViewer])
async def list_app_clients(
    instance_id: UUID, pool_id: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    resp = client.list_user_pool_clients(UserPoolId=pool_id, MaxResults=60)
    return [
        {"client_id": c["ClientId"], "client_name": c["ClientName"]}
        for c in resp.get("UserPoolClients", [])
    ]


@router.post("/user-pools/{pool_id}/app-clients", status_code=201, dependencies=[RequireOperator])
async def create_app_client(
    instance_id: UUID, pool_id: str, body: AppClientCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "cognito-idp")
    resp = client.create_user_pool_client(
        UserPoolId=pool_id,
        ClientName=body.client_name,
        GenerateSecret=body.generate_secret,
    )
    c = resp["UserPoolClient"]
    return {
        "client_id": c["ClientId"],
        "client_name": c["ClientName"],
        "client_secret": c.get("ClientSecret"),
    }
