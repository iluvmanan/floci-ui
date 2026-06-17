from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/sns", tags=["sns"])


class TopicCreate(BaseModel):
    topic_name: str
    fifo: bool = False


class PublishMessage(BaseModel):
    message: str
    subject: str | None = None
    attributes: dict[str, Any] | None = None


class SubscribeBody(BaseModel):
    protocol: str
    endpoint: str


@router.get("/topics", dependencies=[RequireViewer])
async def list_topics(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    resp = client.list_topics()
    return [{"arn": t["TopicArn"], "name": t["TopicArn"].split(":")[-1]} for t in resp.get("Topics", [])]


@router.post("/topics", status_code=201, dependencies=[RequireOperator])
async def create_topic(
    instance_id: UUID, body: TopicCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    name = body.topic_name + (".fifo" if body.fifo and not body.topic_name.endswith(".fifo") else "")
    attrs = {"FifoTopic": "true"} if body.fifo else {}
    resp = client.create_topic(Name=name, Attributes=attrs)
    return {"arn": resp["TopicArn"], "name": name}


@router.delete("/topics/{arn:path}", status_code=204, dependencies=[RequireOperator])
async def delete_topic(instance_id: UUID, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    client.delete_topic(TopicArn=arn)


@router.post("/topics/{arn:path}/publish", dependencies=[RequireOperator])
async def publish_message(
    instance_id: UUID, arn: str, body: PublishMessage, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    kwargs: dict = {"TopicArn": arn, "Message": body.message}
    if body.subject:
        kwargs["Subject"] = body.subject
    if body.attributes:
        kwargs["MessageAttributes"] = body.attributes
    resp = client.publish(**kwargs)
    return {"message_id": resp["MessageId"]}


@router.get("/topics/{arn:path}/subscriptions", dependencies=[RequireViewer])
async def list_topic_subscriptions(instance_id: UUID, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    resp = client.list_subscriptions_by_topic(TopicArn=arn)
    return [
        {"arn": s["SubscriptionArn"], "protocol": s["Protocol"], "endpoint": s["Endpoint"]}
        for s in resp.get("Subscriptions", [])
    ]


@router.get("/subscriptions", dependencies=[RequireViewer])
async def list_all_subscriptions(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    resp = client.list_subscriptions()
    return [
        {
            "arn": s["SubscriptionArn"],
            "protocol": s["Protocol"],
            "endpoint": s["Endpoint"],
            "topic_arn": s["TopicArn"],
            "owner": s.get("Owner", ""),
        }
        for s in resp.get("Subscriptions", [])
    ]


@router.post("/topics/{arn:path}/subscribe", dependencies=[RequireOperator])
async def subscribe_to_topic(
    instance_id: UUID, arn: str, body: SubscribeBody, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    resp = client.subscribe(TopicArn=arn, Protocol=body.protocol, Endpoint=body.endpoint, ReturnSubscriptionArn=True)
    return {"subscription_arn": resp["SubscriptionArn"]}


@router.delete("/subscriptions/{arn:path}", status_code=204, dependencies=[RequireOperator])
async def unsubscribe(instance_id: UUID, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    client.unsubscribe(SubscriptionArn=arn)


@router.get("/topics/{arn:path}/attributes", dependencies=[RequireViewer])
async def get_topic_attributes(instance_id: UUID, arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "sns")
    resp = client.get_topic_attributes(TopicArn=arn)
    attrs = resp.get("Attributes", {})
    return {
        "arn": attrs.get("TopicArn", ""),
        "subscriptions_confirmed": attrs.get("SubscriptionsConfirmed", "0"),
        "subscriptions_pending": attrs.get("SubscriptionsPending", "0"),
        "subscriptions_deleted": attrs.get("SubscriptionsDeleted", "0"),
    }
