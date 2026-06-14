from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/dynamodb", tags=["dynamodb"])


class TableCreate(BaseModel):
    table_name: str
    hash_key: str
    hash_type: str = "S"
    range_key: str | None = None
    range_type: str | None = None
    billing_mode: str = "PAY_PER_REQUEST"


class ScanRequest(BaseModel):
    filter_expression: str | None = None
    expression_values: dict[str, Any] | None = None
    limit: int | None = None
    last_key: dict[str, Any] | None = None


class PutItemRequest(BaseModel):
    item: dict[str, Any]


class DeleteItemRequest(BaseModel):
    key: dict[str, Any]


class GetItemRequest(BaseModel):
    key: dict[str, Any]


class UpdateSettingsRequest(BaseModel):
    billing_mode: str
    read_capacity: int | None = None
    write_capacity: int | None = None


@router.get("/tables", dependencies=[RequireViewer])
async def list_tables(instance_id: UUID, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    resp = client.list_tables()
    return {"tables": resp.get("TableNames", [])}


@router.post("/tables", status_code=201, dependencies=[RequireOperator])
async def create_table(
    instance_id: UUID, body: TableCreate, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    key_schema = [{"AttributeName": body.hash_key, "KeyType": "HASH"}]
    attrs = [{"AttributeName": body.hash_key, "AttributeType": body.hash_type}]
    if body.range_key:
        key_schema.append({"AttributeName": body.range_key, "KeyType": "RANGE"})
        attrs.append({"AttributeName": body.range_key, "AttributeType": body.range_type or "S"})
    client.create_table(
        TableName=body.table_name,
        KeySchema=key_schema,
        AttributeDefinitions=attrs,
        BillingMode=body.billing_mode,
    )
    return {"table_name": body.table_name, "status": "CREATING"}


@router.delete("/tables/{table}", status_code=204, dependencies=[RequireOperator])
async def delete_table(instance_id: UUID, table: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    client.delete_table(TableName=table)


@router.post("/tables/{table}/scan", dependencies=[RequireViewer])
async def scan_table(
    instance_id: UUID, table: str, body: ScanRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    kwargs: dict = {"TableName": table}
    if body.filter_expression:
        kwargs["FilterExpression"] = body.filter_expression
    if body.expression_values:
        kwargs["ExpressionAttributeValues"] = body.expression_values
    if body.limit:
        kwargs["Limit"] = body.limit
    if body.last_key:
        kwargs["ExclusiveStartKey"] = body.last_key
    resp = client.scan(**kwargs)
    return {"items": resp.get("Items", []), "count": resp.get("Count", 0), "last_key": resp.get("LastEvaluatedKey")}


@router.post("/tables/{table}/query", dependencies=[RequireViewer])
async def query_table(
    instance_id: UUID, table: str, body: dict, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    kwargs: dict = {"TableName": table, "KeyConditionExpression": body["key_condition"],
                    "ExpressionAttributeValues": body["expression_values"]}
    if body.get("index_name"):
        kwargs["IndexName"] = body["index_name"]
    if body.get("limit"):
        kwargs["Limit"] = body["limit"]
    if body.get("last_key"):
        kwargs["ExclusiveStartKey"] = body["last_key"]
    resp = client.query(**kwargs)
    return {"items": resp.get("Items", []), "count": resp.get("Count", 0), "last_key": resp.get("LastEvaluatedKey")}


@router.put("/tables/{table}/items", dependencies=[RequireOperator])
async def put_item(
    instance_id: UUID, table: str, body: PutItemRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    client.put_item(TableName=table, Item=body.item)
    return {"status": "ok"}


@router.delete("/tables/{table}/items", status_code=204, dependencies=[RequireOperator])
async def delete_item(
    instance_id: UUID, table: str, body: DeleteItemRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    client.delete_item(TableName=table, Key=body.key)


@router.get("/tables/{table}", dependencies=[RequireViewer])
async def describe_table(instance_id: UUID, table: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    resp = client.describe_table(TableName=table)
    t = resp["Table"]
    return {
        "name": t["TableName"],
        "status": t["TableStatus"],
        "item_count": t.get("ItemCount", 0),
        "size_bytes": t.get("TableSizeBytes", 0),
        "billing_mode": t.get("BillingModeSummary", {}).get("BillingMode", "PROVISIONED"),
        "key_schema": t["KeySchema"],
        "attribute_definitions": t["AttributeDefinitions"],
        "gsi": [{"name": g["IndexName"], "key_schema": g["KeySchema"], "projection": g["Projection"]} for g in t.get("GlobalSecondaryIndexes", [])],
        "lsi": [{"name": l["IndexName"], "key_schema": l["KeySchema"]} for l in t.get("LocalSecondaryIndexes", [])],
        "stream_arn": t.get("LatestStreamArn"),
        "created_at": str(t.get("CreationDateTime", "")),
        "read_capacity": t.get("ProvisionedThroughput", {}).get("ReadCapacityUnits"),
        "write_capacity": t.get("ProvisionedThroughput", {}).get("WriteCapacityUnits"),
    }


@router.post("/tables/{table}/get-item", dependencies=[RequireViewer])
async def get_item(
    instance_id: UUID, table: str, body: GetItemRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    resp = client.get_item(TableName=table, Key=body.key)
    return {"item": resp.get("Item")}


@router.put("/tables/{table}/settings", dependencies=[RequireOperator])
async def update_table_settings(
    instance_id: UUID, table: str, body: UpdateSettingsRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "dynamodb")
    kwargs: dict = {"TableName": table, "BillingMode": body.billing_mode}
    if body.billing_mode == "PROVISIONED" and body.read_capacity and body.write_capacity:
        kwargs["ProvisionedThroughput"] = {
            "ReadCapacityUnits": body.read_capacity,
            "WriteCapacityUnits": body.write_capacity,
        }
    client.update_table(**kwargs)
    return {"success": True}
