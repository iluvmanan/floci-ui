from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/iam", tags=["iam"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    username: str


class AttachPolicyRequest(BaseModel):
    policy_arn: str


class CreateRoleRequest(BaseModel):
    name: str
    trust_policy: str  # JSON string
    description: Optional[str] = None


class CreatePolicyRequest(BaseModel):
    name: str
    document: str  # JSON string
    description: Optional[str] = None


class CreateGroupRequest(BaseModel):
    name: str


class AddUserToGroupRequest(BaseModel):
    username: str


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_iam_users(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_users()
    return [
        {
            "username": u["UserName"],
            "user_id": u["UserId"],
            "arn": u["Arn"],
            "create_date": str(u.get("CreateDate", "")),
            "path": u.get("Path", "/"),
        }
        for u in resp.get("Users", [])
    ]


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_iam_user(
    instance_id: str,
    body: CreateUserRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.create_user(UserName=body.username)
    u = resp["User"]
    return {"username": u["UserName"], "arn": u["Arn"]}


@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_iam_user(
    instance_id: str,
    username: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.delete_user(UserName=username)


@router.get("/users/{username}/policies")
async def list_user_policies(
    instance_id: str,
    username: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_attached_user_policies(UserName=username)
    return [
        {"policy_name": p["PolicyName"], "policy_arn": p["PolicyArn"]}
        for p in resp.get("AttachedPolicies", [])
    ]


@router.post("/users/{username}/policies")
async def attach_user_policy(
    instance_id: str,
    username: str,
    body: AttachPolicyRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.attach_user_policy(UserName=username, PolicyArn=body.policy_arn)
    return {"success": True}


@router.delete("/users/{username}/policies/{policy_arn:path}", status_code=status.HTTP_204_NO_CONTENT)
async def detach_user_policy(
    instance_id: str,
    username: str,
    policy_arn: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.detach_user_policy(UserName=username, PolicyArn=policy_arn)


@router.get("/users/{username}/access-keys")
async def list_access_keys(
    instance_id: str,
    username: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_access_keys(UserName=username)
    return [
        {
            "access_key_id": k["AccessKeyId"],
            "status": k["Status"],
            "create_date": str(k.get("CreateDate", "")),
        }
        for k in resp.get("AccessKeyMetadata", [])
    ]


@router.post("/users/{username}/access-keys", status_code=status.HTTP_201_CREATED)
async def create_access_key(
    instance_id: str,
    username: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.create_access_key(UserName=username)
    k = resp["AccessKey"]
    return {
        "access_key_id": k["AccessKeyId"],
        "secret_access_key": k["SecretAccessKey"],
        "status": k["Status"],
    }


@router.delete("/users/{username}/access-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_access_key(
    instance_id: str,
    username: str,
    key_id: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.delete_access_key(UserName=username, AccessKeyId=key_id)


# ─── Roles ────────────────────────────────────────────────────────────────────

@router.get("/roles")
async def list_iam_roles(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_roles()
    return [
        {
            "role_name": r["RoleName"],
            "role_id": r["RoleId"],
            "arn": r["Arn"],
            "create_date": str(r.get("CreateDate", "")),
            "description": r.get("Description", ""),
        }
        for r in resp.get("Roles", [])
    ]


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_iam_role(
    instance_id: str,
    body: CreateRoleRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.create_role(
        RoleName=body.name,
        AssumeRolePolicyDocument=body.trust_policy,
        Description=body.description or "",
    )
    r = resp["Role"]
    return {"role_name": r["RoleName"], "arn": r["Arn"]}


@router.delete("/roles/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_iam_role(
    instance_id: str,
    name: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.delete_role(RoleName=name)


@router.get("/roles/{name}/policies")
async def list_role_policies(
    instance_id: str,
    name: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_attached_role_policies(RoleName=name)
    return [
        {"policy_name": p["PolicyName"], "policy_arn": p["PolicyArn"]}
        for p in resp.get("AttachedPolicies", [])
    ]


@router.post("/roles/{name}/policies")
async def attach_role_policy(
    instance_id: str,
    name: str,
    body: AttachPolicyRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.attach_role_policy(RoleName=name, PolicyArn=body.policy_arn)
    return {"success": True}


@router.delete("/roles/{name}/policies/{policy_arn:path}", status_code=status.HTTP_204_NO_CONTENT)
async def detach_role_policy(
    instance_id: str,
    name: str,
    policy_arn: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.detach_role_policy(RoleName=name, PolicyArn=policy_arn)


# ─── Policies ─────────────────────────────────────────────────────────────────

@router.get("/policies")
async def list_iam_policies(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_policies(Scope="Local")
    return [
        {
            "policy_name": p["PolicyName"],
            "policy_id": p["PolicyId"],
            "arn": p["Arn"],
            "create_date": str(p.get("CreateDate", "")),
            "description": p.get("Description", ""),
        }
        for p in resp.get("Policies", [])
    ]


@router.post("/policies", status_code=status.HTTP_201_CREATED)
async def create_iam_policy(
    instance_id: str,
    body: CreatePolicyRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.create_policy(
        PolicyName=body.name,
        PolicyDocument=body.document,
        Description=body.description or "",
    )
    p = resp["Policy"]
    return {"policy_name": p["PolicyName"], "arn": p["Arn"]}


@router.delete("/policies/{policy_arn:path}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_iam_policy(
    instance_id: str,
    policy_arn: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.delete_policy(PolicyArn=policy_arn)


# ─── Groups ───────────────────────────────────────────────────────────────────

@router.get("/groups")
async def list_iam_groups(
    instance_id: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.list_groups()
    return [
        {
            "group_name": g["GroupName"],
            "group_id": g["GroupId"],
            "arn": g["Arn"],
            "create_date": str(g.get("CreateDate", "")),
            "path": g.get("Path", "/"),
        }
        for g in resp.get("Groups", [])
    ]


@router.post("/groups", status_code=status.HTTP_201_CREATED)
async def create_iam_group(
    instance_id: str,
    body: CreateGroupRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.create_group(GroupName=body.name)
    g = resp["Group"]
    return {"group_name": g["GroupName"], "arn": g["Arn"]}


@router.delete("/groups/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_iam_group(
    instance_id: str,
    name: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.delete_group(GroupName=name)


@router.get("/groups/{name}/users")
async def list_group_members(
    instance_id: str,
    name: str,
    _viewer=Depends(RequireViewer),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    resp = client.get_group(GroupName=name)
    return [
        {"username": u["UserName"], "arn": u["Arn"]}
        for u in resp.get("Users", [])
    ]


@router.post("/groups/{name}/users")
async def add_user_to_group(
    instance_id: str,
    name: str,
    body: AddUserToGroupRequest,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.add_user_to_group(GroupName=name, UserName=body.username)
    return {"success": True}


@router.delete("/groups/{name}/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_user_from_group(
    instance_id: str,
    name: str,
    username: str,
    _op=Depends(RequireOperator),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "iam")
    client.remove_user_from_group(GroupName=name, UserName=username)
