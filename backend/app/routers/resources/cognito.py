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
