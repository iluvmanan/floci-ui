from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/s3", tags=["s3"])


class BucketCreate(BaseModel):
    bucket_name: str
    region: str | None = None


@router.get("/buckets", dependencies=[RequireViewer])
async def list_buckets(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    resp = client.list_buckets()
    return [
        {"name": b["Name"], "creation_date": str(b.get("CreationDate", ""))}
        for b in resp.get("Buckets", [])
    ]


@router.post("/buckets", status_code=201, dependencies=[RequireOperator])
async def create_bucket(
    instance_id: UUID, body: BucketCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    kwargs: dict = {"Bucket": body.bucket_name}
    region = body.region or inst.region
    if region != "us-east-1":
        kwargs["CreateBucketConfiguration"] = {"LocationConstraint": region}
    client.create_bucket(**kwargs)
    return {"name": body.bucket_name, "region": region}


@router.delete("/buckets/{bucket}", status_code=204, dependencies=[RequireOperator])
async def delete_bucket(instance_id: UUID, bucket: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    client.delete_bucket(Bucket=bucket)


@router.get("/buckets/{bucket}/objects", dependencies=[RequireViewer])
async def list_objects(
    instance_id: UUID,
    bucket: str,
    prefix: str = "",
    delimiter: str = "",
    max_keys: int = Query(100, le=1000),
    continuation_token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    kwargs: dict = {"Bucket": bucket, "MaxKeys": max_keys}
    if prefix:
        kwargs["Prefix"] = prefix
    if delimiter:
        kwargs["Delimiter"] = delimiter
    if continuation_token:
        kwargs["ContinuationToken"] = continuation_token
    resp = client.list_objects_v2(**kwargs)
    return {
        "objects": [
            {"key": o["Key"], "size": o.get("Size", 0), "last_modified": str(o.get("LastModified", ""))}
            for o in resp.get("Contents", [])
        ],
        "prefixes": [p.get("Prefix", "") for p in resp.get("CommonPrefixes", [])],
        "next_token": resp.get("NextContinuationToken"),
        "truncated": resp.get("IsTruncated", False),
    }


@router.delete("/buckets/{bucket}/objects/{key:path}", status_code=204, dependencies=[RequireOperator])
async def delete_object(
    instance_id: UUID, bucket: str, key: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    client.delete_object(Bucket=bucket, Key=key)


@router.get("/buckets/{bucket}/objects/{key:path}/download", dependencies=[RequireViewer])
async def download_object(
    instance_id: UUID, bucket: str, key: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    url = client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=3600
    )
    return {"url": url}


@router.put("/buckets/{bucket}/upload-url", dependencies=[RequireOperator])
async def upload_url(
    instance_id: UUID, bucket: str, body: dict, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "s3")
    resp = client.generate_presigned_post(
        Bucket=bucket,
        Key=body.get("key", ""),
        Conditions=[["content-length-range", 1, 104857600]],
        ExpiresIn=3600,
    )
    return resp
