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
