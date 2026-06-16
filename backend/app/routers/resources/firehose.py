import base64
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/firehose", tags=["firehose"])


# ─── Request Models ───────────────────────────────────────────────────────────

class S3DestConfig(BaseModel):
    role_arn: str
    bucket_arn: str
    prefix: Optional[str] = None
    buffer_size_mb: Optional[int] = 5
    buffer_interval_seconds: Optional[int] = 300


class CreateStreamRequest(BaseModel):
    delivery_stream_name: str
    delivery_stream_type: Optional[str] = "DirectPut"
    s3_config: S3DestConfig


class PutRecordRequest(BaseModel):
    data_base64: str


class PutRecordBatchRequest(BaseModel):
    records: List[str]


# ─── Delivery Streams ─────────────────────────────────────────────────────────

@router.get("/delivery-streams", dependencies=[RequireViewer])
async def list_delivery_streams(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "firehose")
    names_resp = client.list_delivery_streams()
    names = names_resp.get("DeliveryStreamNames", [])
    streams = []
    for n in names:
        resp = client.describe_delivery_stream(DeliveryStreamName=n)
        d = resp["DeliveryStreamDescription"]
        streams.append({
            "delivery_stream_name": d["DeliveryStreamName"],
            "delivery_stream_arn": d.get("DeliveryStreamARN", ""),
            "delivery_stream_status": d.get("DeliveryStreamStatus", ""),
            "delivery_stream_type": d.get("DeliveryStreamType", ""),
            "destinations": d.get("Destinations", []),
            "create_timestamp": str(d.get("CreateTimestamp", "")),
        })
    return streams


@router.post("/delivery-streams", status_code=201, dependencies=[RequireOperator])
async def create_delivery_stream(
    instance_id, body: CreateStreamRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "firehose")
    s3_dest: dict = {
        "RoleARN": body.s3_config.role_arn,
        "BucketARN": body.s3_config.bucket_arn,
        "BufferingHints": {
            "SizeInMBs": body.s3_config.buffer_size_mb,
            "IntervalInSeconds": body.s3_config.buffer_interval_seconds,
        },
    }
    if body.s3_config.prefix:
        s3_dest["Prefix"] = body.s3_config.prefix
    resp = client.create_delivery_stream(
        DeliveryStreamName=body.delivery_stream_name,
        DeliveryStreamType=body.delivery_stream_type,
        S3DestinationConfiguration=s3_dest,
    )
    return {"delivery_stream_arn": resp["DeliveryStreamARN"]}


@router.delete("/delivery-streams/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_delivery_stream(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "firehose")
    client.delete_delivery_stream(DeliveryStreamName=name)


@router.post("/delivery-streams/{name}/records", dependencies=[RequireOperator])
async def put_record(
    instance_id, name: str, body: PutRecordRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "firehose")
    resp = client.put_record(
        DeliveryStreamName=name, Record={"Data": base64.b64decode(body.data_base64)}
    )
    return {"record_id": resp["RecordId"]}


@router.post("/delivery-streams/{name}/records/batch", dependencies=[RequireOperator])
async def put_record_batch(
    instance_id, name: str, body: PutRecordBatchRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "firehose")
    resp = client.put_record_batch(
        DeliveryStreamName=name,
        Records=[{"Data": base64.b64decode(r)} for r in body.records],
    )
    return {
        "failed_put_count": resp.get("FailedPutCount", 0),
        "request_responses": resp.get("RequestResponses", []),
    }
