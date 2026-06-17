"""Transfer Family resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/transfer", tags=["transfer"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateServerRequest(BaseModel):
    protocols: List[str] = ["SFTP"]
    endpoint_type: Optional[str] = "PUBLIC"
    identity_provider_type: Optional[str] = "SERVICE_MANAGED"


class CreateUserRequest(BaseModel):
    user_name: str
    role: str
    home_directory: Optional[str] = None
    ssh_public_key_body: Optional[str] = None


# ─── Servers ──────────────────────────────────────────────────────────────────

@router.get("/servers", dependencies=[RequireViewer])
async def list_servers(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    ids = [s["ServerId"] for s in client.list_servers().get("Servers", [])]
    region = getattr(client.meta, "region_name", "") or ""
    result = []
    for server_id in ids:
        resp = client.describe_server(ServerId=server_id)
        s = resp["Server"]
        endpoint_details = s.get("EndpointDetails", {})
        endpoint = endpoint_details.get("Address") or f"{server_id}.server.transfer.{region}.amazonaws.com"
        result.append({
            "server_id": s.get("ServerId", server_id),
            "arn": s.get("Arn", ""),
            "protocols": s.get("Protocols", []),
            "endpoint_type": s.get("EndpointType", ""),
            "state": s.get("State", ""),
            "user_count": s.get("UserCount", 0),
            "identity_provider_type": s.get("IdentityProviderType", ""),
            "endpoint": endpoint,
        })
    return result


@router.post("/servers", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_server(
    instance_id, body: CreateServerRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    kwargs: dict = {
        "Protocols": body.protocols,
        "EndpointType": body.endpoint_type,
        "IdentityProviderType": body.identity_provider_type,
    }
    if body.identity_provider_type == "SERVICE_MANAGED":
        kwargs["IdentityProviderDetails"] = {}
    resp = client.create_server(**kwargs)
    return {"server_id": resp.get("ServerId", "")}


@router.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_server(instance_id, server_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    client.delete_server(ServerId=server_id)


@router.post("/servers/{server_id}/start", dependencies=[RequireOperator])
async def start_server(instance_id, server_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    client.start_server(ServerId=server_id)
    return {"success": True}


@router.post("/servers/{server_id}/stop", dependencies=[RequireOperator])
async def stop_server(instance_id, server_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    client.stop_server(ServerId=server_id)
    return {"success": True}


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/servers/{server_id}/users", dependencies=[RequireViewer])
async def list_users(instance_id, server_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    usernames = [
        u["UserName"] for u in client.list_users(ServerId=server_id).get("Users", [])
    ]
    result = []
    for username in usernames:
        resp = client.describe_user(ServerId=server_id, UserName=username)
        u = resp["User"]
        result.append({
            "user_name": u.get("UserName", username),
            "role": u.get("Role", ""),
            "home_directory": u.get("HomeDirectory", ""),
            "home_directory_type": u.get("HomeDirectoryType", ""),
            "ssh_public_key_count": len(u.get("SshPublicKeys", [])),
        })
    return result


@router.post(
    "/servers/{server_id}/users",
    status_code=status.HTTP_201_CREATED,
    dependencies=[RequireOperator],
)
async def create_user(
    instance_id,
    server_id: str,
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    kwargs: dict = {
        "ServerId": server_id,
        "UserName": body.user_name,
        "Role": body.role,
    }
    if body.home_directory:
        kwargs["HomeDirectory"] = body.home_directory
    if body.ssh_public_key_body:
        kwargs["SshPublicKeyBody"] = body.ssh_public_key_body
    resp = client.create_user(**kwargs)
    return {
        "server_id": resp.get("ServerId", server_id),
        "user_name": resp.get("UserName", body.user_name),
    }


@router.delete(
    "/servers/{server_id}/users/{username}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_user(
    instance_id, server_id: str, username: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transfer")
    client.delete_user(ServerId=server_id, UserName=username)
