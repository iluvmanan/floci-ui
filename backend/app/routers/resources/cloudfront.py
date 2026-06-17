from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/cloudfront", tags=["cloudfront"])


# ─── Request Models ───────────────────────────────────────────────────────────

class OriginConfig(BaseModel):
    id: str
    domain_name: str
    s3_origin_config: Optional[dict] = None


class CacheBehavior(BaseModel):
    target_origin_id: str
    viewer_protocol_policy: str  # allow-all|redirect-to-https|https-only
    allowed_methods: Optional[List[str]] = None
    compress: Optional[bool] = True


class CreateDistributionRequest(BaseModel):
    origins: List[OriginConfig]
    default_cache_behavior: CacheBehavior
    price_class: Optional[str] = "PriceClass_All"
    enabled: Optional[bool] = True
    comment: Optional[str] = None
    aliases: Optional[List[str]] = None


class UpdateDistributionRequest(BaseModel):
    enabled: Optional[bool] = None
    comment: Optional[str] = None


class CreateInvalidationRequest(BaseModel):
    paths: List[str]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _build_origin_item(o: OriginConfig) -> dict:
    item = {
        "Id": o.id,
        "DomainName": o.domain_name,
        "OriginPath": "",
        "CustomHeaders": {"Quantity": 0},
    }
    if o.s3_origin_config:
        item["S3OriginConfig"] = o.s3_origin_config
    else:
        item["CustomOriginConfig"] = {
            "HTTPPort": 80,
            "HTTPSPort": 443,
            "OriginProtocolPolicy": "https-only",
            "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
        }
    return item


def _build_default_cache_behavior(b: dict) -> dict:
    methods = b.get("allowed_methods") or ["GET", "HEAD"]
    return {
        "TargetOriginId": b["target_origin_id"],
        "ViewerProtocolPolicy": b["viewer_protocol_policy"],
        "AllowedMethods": {
            "Quantity": len(methods),
            "Items": methods,
            "CachedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"],
            },
        },
        "Compress": b.get("compress", True),
        "ForwardedValues": {
            "QueryString": False,
            "Cookies": {"Forward": "none"},
        },
        "TrustedSigners": {"Enabled": False, "Quantity": 0},
        "MinTTL": 0,
    }


def _distribution_summary(item: dict) -> dict:
    return {
        "id": item.get("Id"),
        "domain_name": item.get("DomainName"),
        "status": item.get("Status"),
        "origins": item.get("Origins", {}).get("Items", []),
        "default_cache_behavior": item.get("DefaultCacheBehavior"),
        "price_class": item.get("PriceClass"),
        "enabled": item.get("Enabled"),
        "last_modified_time": str(item.get("LastModifiedTime", "")),
        "aliases": item.get("Aliases", {}).get("Items", []) if item.get("Aliases") else [],
    }


def _invalidation_summary(inv: dict) -> dict:
    return {
        "id": inv.get("Id"),
        "status": inv.get("Status"),
        "create_time": str(inv.get("CreateTime", "")),
    }


# ─── Distributions ────────────────────────────────────────────────────────────

@router.get("/distributions", dependencies=[RequireViewer])
async def list_distributions(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")
    resp = client.list_distributions()
    items = resp.get("DistributionList", {}).get("Items", [])
    return [_distribution_summary(item) for item in items]


@router.post("/distributions", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_distribution(
    instance_id, body: CreateDistributionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")

    origin_items = [_build_origin_item(o) for o in body.origins]
    config: dict = {
        "CallerReference": str(uuid4()),
        "Origins": {
            "Quantity": len(origin_items),
            "Items": origin_items,
        },
        "DefaultCacheBehavior": _build_default_cache_behavior(body.default_cache_behavior.model_dump()),
        "Enabled": body.enabled,
        "Comment": body.comment or "",
        "PriceClass": body.price_class,
    }
    if body.aliases:
        config["Aliases"] = {"Quantity": len(body.aliases), "Items": body.aliases}

    resp = client.create_distribution(DistributionConfig=config)
    dist = resp["Distribution"]
    return {
        "id": dist["Id"],
        "domain_name": dist["DomainName"],
        "status": dist["Status"],
    }


@router.get("/distributions/{dist_id}", dependencies=[RequireViewer])
async def get_distribution(instance_id, dist_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")
    resp = client.get_distribution(Id=dist_id)
    dist = resp["Distribution"]
    config = dist.get("DistributionConfig", {})
    return {
        "id": dist.get("Id"),
        "domain_name": dist.get("DomainName"),
        "status": dist.get("Status"),
        "last_modified_time": str(dist.get("LastModifiedTime", "")),
        "config": config,
        "etag": resp.get("ETag"),
    }


@router.put("/distributions/{dist_id}", dependencies=[RequireOperator])
async def update_distribution(
    instance_id, dist_id: str, body: UpdateDistributionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")

    current = client.get_distribution(Id=dist_id)
    config = current["Distribution"]["DistributionConfig"]
    etag = current["ETag"]

    if body.enabled is not None:
        config["Enabled"] = body.enabled
    if body.comment is not None:
        config["Comment"] = body.comment

    resp = client.update_distribution(Id=dist_id, DistributionConfig=config, IfMatch=etag)
    dist = resp["Distribution"]
    return {
        "id": dist.get("Id"),
        "domain_name": dist.get("DomainName"),
        "status": dist.get("Status"),
        "config": dist.get("DistributionConfig", {}),
        "etag": resp.get("ETag"),
    }


@router.delete("/distributions/{dist_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_distribution(instance_id, dist_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")

    current = client.get_distribution(Id=dist_id)
    config = current["Distribution"]["DistributionConfig"]
    etag = current["ETag"]

    if config.get("Enabled"):
        config["Enabled"] = False
        client.update_distribution(Id=dist_id, DistributionConfig=config, IfMatch=etag)

    fresh = client.get_distribution(Id=dist_id)
    client.delete_distribution(Id=dist_id, IfMatch=fresh["ETag"])


# ─── Invalidations ────────────────────────────────────────────────────────────

@router.post("/distributions/{dist_id}/invalidations", dependencies=[RequireOperator])
async def create_invalidation(
    instance_id, dist_id: str, body: CreateInvalidationRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")
    resp = client.create_invalidation(
        DistributionId=dist_id,
        InvalidationBatch={
            "Paths": {"Quantity": len(body.paths), "Items": body.paths},
            "CallerReference": str(uuid4()),
        },
    )
    inv = resp["Invalidation"]
    return _invalidation_summary(inv)


@router.get("/distributions/{dist_id}/invalidations", dependencies=[RequireViewer])
async def list_invalidations(instance_id, dist_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "cloudfront")
    resp = client.list_invalidations(DistributionId=dist_id)
    items = resp.get("InvalidationList", {}).get("Items", [])
    return [_invalidation_summary(inv) for inv in items]
