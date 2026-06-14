import base64
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/kinesis", tags=["kinesis"])


class StreamCreate(BaseModel):
    stream_name: str
    shard_count: int = 1


class PutRecord(BaseModel):
    data_b64: str
    partition_key: str


@router.get("/streams", dependencies=[RequireViewer])
async def list_streams(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kinesis")
    resp = client.list_streams()
    return resp.get("StreamNames", [])


@router.post("/streams", status_code=201, dependencies=[RequireOperator])
async def create_stream(
    instance_id: UUID, body: StreamCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kinesis")
    client.create_stream(StreamName=body.stream_name, ShardCount=body.shard_count)
    return {"name": body.stream_name, "shard_count": body.shard_count}


@router.delete("/streams/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_stream(instance_id: UUID, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kinesis")
    client.delete_stream(StreamName=name)


@router.post("/streams/{name}/records", dependencies=[RequireOperator])
async def put_record(
    instance_id: UUID, name: str, body: PutRecord, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "kinesis")
    data = base64.b64decode(body.data_b64)
    resp = client.put_record(StreamName=name, Data=data, PartitionKey=body.partition_key)
    return {"shard_id": resp["ShardId"], "sequence_number": resp["SequenceNumber"]}
