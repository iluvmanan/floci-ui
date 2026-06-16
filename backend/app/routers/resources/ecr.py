import base64
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/ecr", tags=["ecr"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateRepoRequest(BaseModel):
    repository_name: str
    image_tag_mutability: Optional[str] = "MUTABLE"
    scan_on_push: Optional[bool] = False


class DeleteImagesRequest(BaseModel):
    image_ids: List[dict]


class SetPolicyRequest(BaseModel):
    policy_text: str


# ─── Repositories ─────────────────────────────────────────────────────────────

@router.get("/repositories", dependencies=[RequireViewer])
async def list_repositories(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.describe_repositories()
    return [
        {
            "repository_name": r["repositoryName"],
            "repository_uri": r.get("repositoryUri", ""),
            "registry_id": r.get("registryId", ""),
            "created_at": str(r.get("createdAt", "")),
            "image_tag_mutability": r.get("imageTagMutability", ""),
            "image_scanning_configuration": r.get("imageScanningConfiguration", {}),
        }
        for r in resp.get("repositories", [])
    ]


@router.post("/repositories", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_repository(
    instance_id, body: CreateRepoRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.create_repository(
        repositoryName=body.repository_name,
        imageTagMutability=body.image_tag_mutability,
        imageScanningConfiguration={"scanOnPush": body.scan_on_push},
    )
    r = resp["repository"]
    return {
        "repository_name": r["repositoryName"],
        "repository_uri": r.get("repositoryUri", ""),
        "registry_id": r.get("registryId", ""),
        "created_at": str(r.get("createdAt", "")),
        "image_tag_mutability": r.get("imageTagMutability", ""),
        "image_scanning_configuration": r.get("imageScanningConfiguration", {}),
    }


@router.delete("/repositories/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_repository(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    client.delete_repository(repositoryName=name, force=True)


# ─── Images ───────────────────────────────────────────────────────────────────

@router.get("/repositories/{name}/images", dependencies=[RequireViewer])
async def list_images(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.describe_images(repositoryName=name)
    return [
        {
            "image_digest": img.get("imageDigest", ""),
            "image_tags": img.get("imageTags", []),
            "image_size_in_bytes": img.get("imageSizeInBytes", 0),
            "image_pushed_at": str(img.get("imagePushedAt", "")),
            "image_scan_status": img.get("imageScanStatus", {}),
        }
        for img in resp.get("imageDetails", [])
    ]


@router.delete("/repositories/{name}/images", dependencies=[RequireOperator])
async def delete_images(
    instance_id, name: str, body: DeleteImagesRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.batch_delete_image(repositoryName=name, imageIds=body.image_ids)
    return {
        "failed_count": len(resp.get("failures", [])),
        "image_ids": resp.get("imageIds", []),
    }


# ─── Repository Policy ─────────────────────────────────────────────────────────

@router.get("/repositories/{name}/policy", dependencies=[RequireViewer])
async def get_repository_policy(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    try:
        resp = client.get_repository_policy(repositoryName=name)
        return {"policy_text": resp.get("policyText")}
    except client.exceptions.RepositoryPolicyNotFoundException:
        return {"policy_text": None}


@router.put("/repositories/{name}/policy", dependencies=[RequireOperator])
async def set_repository_policy(
    instance_id, name: str, body: SetPolicyRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.set_repository_policy(repositoryName=name, policyText=body.policy_text)
    return {"policy_text": resp.get("policyText")}


@router.delete(
    "/repositories/{name}/policy",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[RequireOperator],
)
async def delete_repository_policy(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    client.delete_repository_policy(repositoryName=name)


# ─── Auth Token ────────────────────────────────────────────────────────────────

@router.get("/auth-token", dependencies=[RequireViewer])
async def get_auth_token(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "ecr")
    resp = client.get_authorization_token()
    data = resp["authorizationData"][0]
    token = data["authorizationToken"]
    proxy_endpoint = data.get("proxyEndpoint", "")
    decoded = base64.b64decode(token).decode("utf-8")
    user, _, password = decoded.partition(":")
    docker_login_command = f"docker login -u {user} -p {password} {proxy_endpoint}"
    return {
        "authorization_token": token,
        "proxy_endpoint": proxy_endpoint,
        "expires_at": str(data.get("expiresAt", "")),
        "docker_login_command": docker_login_command,
    }
