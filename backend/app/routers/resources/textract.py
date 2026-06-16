import base64
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/textract", tags=["textract"])


# ─── Request Models ───────────────────────────────────────────────────────────

class DocumentLocation(BaseModel):
    s3_bucket: Optional[str] = None
    s3_key: Optional[str] = None
    bytes_base64: Optional[str] = None


class QueryItem(BaseModel):
    text: str
    alias: Optional[str] = None


class QueriesRequest(BaseModel):
    document: DocumentLocation
    queries: List[QueryItem]


class StartJobRequest(BaseModel):
    s3_bucket: str
    s3_key: str
    feature_types: List[str]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def build_document(loc: DocumentLocation) -> dict:
    if loc.s3_bucket and loc.s3_key:
        return {"S3Object": {"Bucket": loc.s3_bucket, "Name": loc.s3_key}}
    if loc.bytes_base64:
        return {"Bytes": base64.b64decode(loc.bytes_base64)}
    raise HTTPException(status_code=400, detail="document location required")


def blocks_summary(blocks: List[dict]) -> List[dict]:
    return [
        {
            "block_type": b.get("BlockType", ""),
            "text": b.get("Text", ""),
            "confidence": b.get("Confidence", 0),
            "geometry": b.get("Geometry", {}),
        }
        for b in blocks
    ]


def _block_map(blocks: List[dict]) -> dict:
    return {b["Id"]: b for b in blocks if "Id" in b}


def resolve_text_for_block(block: dict, block_map: dict) -> str:
    words = []
    for rel in block.get("Relationships", []):
        if rel.get("Type") != "CHILD":
            continue
        for cid in rel.get("Ids", []):
            child = block_map.get(cid)
            if not child:
                continue
            if child.get("BlockType") == "WORD":
                words.append(child.get("Text", ""))
            elif child.get("BlockType") == "SELECTION_ELEMENT":
                if child.get("SelectionStatus") == "SELECTED":
                    words.append("[X]")
    return " ".join(words)


def extract_key_value_pairs(blocks: List[dict]) -> List[dict]:
    block_map = _block_map(blocks)
    key_blocks = [
        b for b in blocks
        if b.get("BlockType") == "KEY_VALUE_SET" and "KEY" in b.get("EntityTypes", [])
    ]
    pairs = []
    for key_block in key_blocks:
        key_text = resolve_text_for_block(key_block, block_map)
        value_text = ""
        confidence = key_block.get("Confidence", 0)
        for rel in key_block.get("Relationships", []):
            if rel.get("Type") == "VALUE":
                for vid in rel.get("Ids", []):
                    value_block = block_map.get(vid)
                    if value_block:
                        value_text = resolve_text_for_block(value_block, block_map)
                        confidence = value_block.get("Confidence", confidence)
        pairs.append({"key": key_text, "value": value_text, "confidence": confidence})
    return pairs


def extract_tables(blocks: List[dict]) -> List[List[List[str]]]:
    block_map = _block_map(blocks)
    table_blocks = [b for b in blocks if b.get("BlockType") == "TABLE"]
    tables = []
    for table_block in table_blocks:
        cells = []
        for rel in table_block.get("Relationships", []):
            if rel.get("Type") != "CHILD":
                continue
            for cid in rel.get("Ids", []):
                cell = block_map.get(cid)
                if cell and cell.get("BlockType") == "CELL":
                    cells.append(cell)
        if not cells:
            tables.append([])
            continue
        max_row = max(c.get("RowIndex", 1) for c in cells)
        max_col = max(c.get("ColumnIndex", 1) for c in cells)
        grid = [["" for _ in range(max_col)] for _ in range(max_row)]
        for cell in cells:
            r = cell.get("RowIndex", 1) - 1
            c = cell.get("ColumnIndex", 1) - 1
            text = resolve_text_for_block(cell, block_map)
            if 0 <= r < max_row and 0 <= c < max_col:
                grid[r][c] = text
        tables.append(grid)
    return tables


def extract_query_results(blocks: List[dict]) -> List[dict]:
    block_map = _block_map(blocks)
    query_blocks = [b for b in blocks if b.get("BlockType") == "QUERY"]
    results = []
    for qb in query_blocks:
        alias = qb.get("Query", {}).get("Alias", "")
        answer = ""
        confidence = 0
        for rel in qb.get("Relationships", []):
            if rel.get("Type") == "ANSWER":
                for aid in rel.get("Ids", []):
                    answer_block = block_map.get(aid)
                    if answer_block:
                        answer = answer_block.get("Text", "")
                        confidence = answer_block.get("Confidence", 0)
        results.append({"alias": alias, "answer": answer, "confidence": confidence})
    return results


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/documents/text", dependencies=[RequireOperator])
async def detect_document_text(
    instance_id, body: DocumentLocation, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    resp = client.detect_document_text(Document=build_document(body))
    return {
        "blocks": blocks_summary(resp.get("Blocks", [])),
        "document_metadata": resp.get("DocumentMetadata", {}),
    }


@router.post("/documents/forms", dependencies=[RequireOperator])
async def analyze_forms(
    instance_id, body: DocumentLocation, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    resp = client.analyze_document(Document=build_document(body), FeatureTypes=["FORMS"])
    blocks = resp.get("Blocks", [])
    return {
        "blocks": blocks_summary(blocks),
        "key_value_sets": extract_key_value_pairs(blocks),
    }


@router.post("/documents/tables", dependencies=[RequireOperator])
async def analyze_tables(
    instance_id, body: DocumentLocation, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    resp = client.analyze_document(Document=build_document(body), FeatureTypes=["TABLES"])
    blocks = resp.get("Blocks", [])
    return {
        "blocks": blocks_summary(blocks),
        "tables": extract_tables(blocks),
    }


@router.post("/documents/queries", dependencies=[RequireOperator])
async def analyze_queries(
    instance_id, body: QueriesRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    queries_config = {
        "Queries": [
            {"Text": q.text, **({"Alias": q.alias} if q.alias else {})}
            for q in body.queries
        ]
    }
    resp = client.analyze_document(
        Document=build_document(body.document),
        FeatureTypes=["QUERIES"],
        QueriesConfig=queries_config,
    )
    blocks = resp.get("Blocks", [])
    return {"query_results": extract_query_results(blocks)}


@router.post("/jobs/start", dependencies=[RequireOperator])
async def start_job(instance_id, body: StartJobRequest, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    resp = client.start_document_analysis(
        DocumentLocation={"S3Object": {"Bucket": body.s3_bucket, "Name": body.s3_key}},
        FeatureTypes=body.feature_types,
    )
    return {"job_id": resp["JobId"]}


@router.get("/jobs/{job_id}", dependencies=[RequireViewer])
async def get_job(instance_id, job_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "textract")
    resp = client.get_document_analysis(JobId=job_id)
    return {
        "job_status": resp.get("JobStatus", ""),
        "blocks": resp.get("Blocks", []),
        "document_metadata": resp.get("DocumentMetadata", {}),
    }
