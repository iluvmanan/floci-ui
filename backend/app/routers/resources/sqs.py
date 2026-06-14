import json
from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/sqs", tags=["sqs"])


class QueueCreate(BaseModel):
    queue_name: str
    fifo: bool = False
    visibility_timeout: int = 30


class QueueAttributesUpdate(BaseModel):
    visibility_timeout: int | None = None
    delay_seconds: int | None = None
    receive_wait_time: int | None = None


class SendMessage(BaseModel):
    message_body: str
    delay_seconds: int = 0
    attributes: dict[str, Any] | None = None


@router.get("/queues", dependencies=[RequireViewer])
async def list_queues(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    resp = client.list_queues()
    queues = []
    for url in resp.get("QueueUrls", []):
        name = url.split("/")[-1]
        attrs_resp = client.get_queue_attributes(
            QueueUrl=url, AttributeNames=["ApproximateNumberOfMessages", "QueueArn"]
        )
        attrs = attrs_resp.get("Attributes", {})
        queues.append({
            "name": name,
            "url": url,
            "arn": attrs.get("QueueArn", ""),
            "message_count": int(attrs.get("ApproximateNumberOfMessages", 0)),
        })
    return queues


@router.post("/queues", status_code=201, dependencies=[RequireOperator])
async def create_queue(
    instance_id: UUID, body: QueueCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    name = body.queue_name + (".fifo" if body.fifo and not body.queue_name.endswith(".fifo") else "")
    attrs: dict = {"VisibilityTimeout": str(body.visibility_timeout)}
    if body.fifo:
        attrs["FifoQueue"] = "true"
    resp = client.create_queue(QueueName=name, Attributes=attrs)
    return {"name": name, "url": resp["QueueUrl"]}


@router.delete("/queues/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_queue(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    client.delete_queue(QueueUrl=url_resp["QueueUrl"])


@router.post("/queues/{name}/send", dependencies=[RequireOperator])
async def send_message(
    instance_id: UUID, name: str, body: SendMessage, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    kwargs: dict = {
        "QueueUrl": url_resp["QueueUrl"],
        "MessageBody": body.message_body,
        "DelaySeconds": body.delay_seconds,
    }
    if body.attributes:
        kwargs["MessageAttributes"] = body.attributes
    resp = client.send_message(**kwargs)
    return {"message_id": resp["MessageId"]}


@router.get("/queues/{name}/receive", dependencies=[RequireViewer])
async def receive_messages(
    instance_id: UUID,
    name: str,
    count: int = Query(10, le=10),
    wait_seconds: int = Query(0, le=20),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    resp = client.receive_message(
        QueueUrl=url_resp["QueueUrl"],
        MaxNumberOfMessages=count,
        WaitTimeSeconds=wait_seconds,
        AttributeNames=["All"],
    )
    return [
        {"message_id": m["MessageId"], "body": m["Body"], "receipt_handle": m["ReceiptHandle"]}
        for m in resp.get("Messages", [])
    ]


@router.delete("/queues/{name}/purge", status_code=204, dependencies=[RequireOperator])
async def purge_queue(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    client.purge_queue(QueueUrl=url_resp["QueueUrl"])


@router.get("/queues/{name}/attributes", dependencies=[RequireViewer])
async def get_queue_attributes(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    url = url_resp["QueueUrl"]
    attrs = client.get_queue_attributes(QueueUrl=url, AttributeNames=["All"])["Attributes"]
    redrive = attrs.get("RedrivePolicy")
    redrive_parsed = json.loads(redrive) if redrive else None
    return {
        "arn": attrs.get("QueueArn", ""),
        "visibility_timeout": int(attrs.get("VisibilityTimeout", 30)),
        "delay_seconds": int(attrs.get("DelaySeconds", 0)),
        "receive_wait_time": int(attrs.get("ReceiveMessageWaitTimeSeconds", 0)),
        "max_message_size": int(attrs.get("MaximumMessageSize", 262144)),
        "retention_period": int(attrs.get("MessageRetentionPeriod", 345600)),
        "approximate_message_count": int(attrs.get("ApproximateNumberOfMessages", 0)),
        "dlq_arn": redrive_parsed.get("deadLetterTargetArn") if redrive_parsed else None,
        "max_receive_count": redrive_parsed.get("maxReceiveCount") if redrive_parsed else None,
    }


@router.put("/queues/{name}/attributes", dependencies=[RequireOperator])
async def set_queue_attributes(
    instance_id: UUID, name: str, body: QueueAttributesUpdate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sqs")
    url_resp = client.get_queue_url(QueueName=name)
    url = url_resp["QueueUrl"]
    attrs: dict = {}
    if body.visibility_timeout is not None:
        attrs["VisibilityTimeout"] = str(body.visibility_timeout)
    if body.delay_seconds is not None:
        attrs["DelaySeconds"] = str(body.delay_seconds)
    if body.receive_wait_time is not None:
        attrs["ReceiveMessageWaitTimeSeconds"] = str(body.receive_wait_time)
    if attrs:
        client.set_queue_attributes(QueueUrl=url, Attributes=attrs)
    return {"success": True}
