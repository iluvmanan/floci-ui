import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/pricing", tags=["pricing"])


# ─── Request Models ───────────────────────────────────────────────────────────

class PriceFilterRequest(BaseModel):
    type: str = "TERM_MATCH"
    field: str
    value: str


class GetProductsRequest(BaseModel):
    service_code: str
    filters: Optional[List[PriceFilterRequest]] = None
    format_version: Optional[str] = "aws_v1"
    max_results: Optional[int] = 20


def _get_pricing_client(inst):
    return _rb.get_client_with_region(inst, "pricing", "us-east-1")


def _parse_price_list_item(raw: str) -> dict:
    item = json.loads(raw)
    on_demand_terms = item.get("terms", {}).get("OnDemand", {})
    on_demand: dict = {}
    for _term_key, term in on_demand_terms.items():
        dims = term.get("priceDimensions", {})
        for _dim_key, dim in dims.items():
            price_per_unit = dim.get("pricePerUnit", {})
            usd = price_per_unit.get("USD", "")
            on_demand = {
                "price_per_unit": usd,
                "unit": dim.get("unit", ""),
                "description": dim.get("description", ""),
            }
            break
        break
    return {
        "sku": item.get("product", {}).get("sku", ""),
        "product_family": item.get("product", {}).get("productFamily", ""),
        "attributes": item.get("product", {}).get("attributes", {}),
        "terms": {"on_demand": on_demand},
    }


# ─── Services ─────────────────────────────────────────────────────────────────

@router.get("/services", dependencies=[RequireViewer])
async def list_services(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _get_pricing_client(inst)
    resp = client.describe_services(FormatVersion="aws_v1")
    return [
        {
            "service_code": s["ServiceCode"],
            "attribute_names": s.get("AttributeNames", []),
        }
        for s in resp.get("Services", [])
    ]


@router.get("/services/{code}/attribute-values/{attr}", dependencies=[RequireViewer])
async def get_attribute_values(
    instance_id, code: str, attr: str, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _get_pricing_client(inst)
    resp = client.get_attribute_values(ServiceCode=code, AttributeName=attr)
    return [v.get("Value", "") for v in resp.get("AttributeValues", [])]


# ─── Products ─────────────────────────────────────────────────────────────────

@router.post("/products", dependencies=[RequireViewer])
async def get_products(
    instance_id, body: GetProductsRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _get_pricing_client(inst)
    kwargs: dict = {
        "ServiceCode": body.service_code,
        "FormatVersion": body.format_version or "aws_v1",
        "MaxResults": body.max_results or 20,
    }
    if body.filters:
        kwargs["Filters"] = [
            {"Type": f.type, "Field": f.field, "Value": f.value} for f in body.filters
        ]
    resp = client.get_products(**kwargs)
    return [_parse_price_list_item(raw) for raw in resp.get("PriceList", [])]
