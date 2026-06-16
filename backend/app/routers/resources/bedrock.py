import json
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/bedrock", tags=["bedrock"])


# ─── Request Models ───────────────────────────────────────────────────────────

class InvokeModelRequest(BaseModel):
    body: dict
    content_type: Optional[str] = "application/json"


# ─── Models ───────────────────────────────────────────────────────────────────

@router.get("/models", dependencies=[RequireViewer])
async def list_models(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "bedrock")
    resp = client.list_foundation_models()
    return [
        {
            "model_id": m.get("modelId", ""),
            "model_name": m.get("modelName", ""),
            "provider_name": m.get("providerName", ""),
            "input_modalities": m.get("inputModalities", []),
            "output_modalities": m.get("outputModalities", []),
            "response_streaming_supported": m.get("responseStreamingSupported", False),
            "customizations_supported": m.get("customizationsSupported", []),
        }
        for m in resp.get("modelSummaries", [])
    ]


@router.post("/models/{model_id}/invoke", dependencies=[RequireOperator])
async def invoke_model(
    instance_id, model_id: str, body: InvokeModelRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "bedrock-runtime")
    resp = client.invoke_model(
        modelId=model_id,
        body=json.dumps(body.body),
        contentType=body.content_type,
        accept="application/json",
    )
    response_body = json.loads(resp["body"].read())
    return {"body": response_body, "content_type": resp.get("contentType", "")}


@router.post("/models/{model_id}/invoke-stream", dependencies=[RequireOperator])
async def invoke_model_stream(
    instance_id, model_id: str, body: InvokeModelRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "bedrock-runtime")
    resp = client.invoke_model_with_response_stream(
        modelId=model_id,
        body=json.dumps(body.body),
        contentType=body.content_type,
        accept="application/json",
    )
    chunks = []
    for event in resp.get("body", []):
        chunk = event.get("chunk")
        if chunk and "bytes" in chunk:
            try:
                chunks.append(json.loads(chunk["bytes"].decode("utf-8")))
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
    return {"chunks": chunks}
