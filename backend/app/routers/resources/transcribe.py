from typing import Optional

import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/transcribe", tags=["transcribe"])


# ─── Request Models ───────────────────────────────────────────────────────────

class StartTranscriptionRequest(BaseModel):
    transcription_job_name: str
    media_uri: str
    language_code: str = "en-US"
    media_format: Optional[str] = None
    output_bucket_name: Optional[str] = None


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.post("/jobs", status_code=201, dependencies=[RequireOperator])
async def start_transcription_job(
    instance_id, body: StartTranscriptionRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transcribe")
    kwargs: dict = {
        "TranscriptionJobName": body.transcription_job_name,
        "Media": {"MediaFileUri": body.media_uri},
        "LanguageCode": body.language_code,
    }
    if body.media_format:
        kwargs["MediaFormat"] = body.media_format
    if body.output_bucket_name:
        kwargs["OutputBucketName"] = body.output_bucket_name
    resp = client.start_transcription_job(**kwargs)
    job = resp["TranscriptionJob"]
    return {
        "transcription_job_name": job["TranscriptionJobName"],
        "transcription_job_status": job.get("TranscriptionJobStatus", ""),
    }


@router.get("/jobs", dependencies=[RequireViewer])
async def list_transcription_jobs(
    instance_id, status_filter: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transcribe")
    kwargs = {"Status": status_filter} if status_filter else {}
    resp = client.list_transcription_jobs(**kwargs)
    return [
        {
            "transcription_job_name": j.get("TranscriptionJobName", ""),
            "creation_time": str(j.get("CreationTime", "")),
            "start_time": str(j.get("StartTime", "")),
            "completion_time": str(j.get("CompletionTime", "")),
            "language_code": j.get("LanguageCode", ""),
            "transcription_job_status": j.get("TranscriptionJobStatus", ""),
            "failure_reason": j.get("FailureReason", ""),
        }
        for j in resp.get("TranscriptionJobSummaries", [])
    ]


@router.get("/jobs/{name}", dependencies=[RequireViewer])
async def get_transcription_job(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transcribe")
    resp = client.get_transcription_job(TranscriptionJobName=name)
    j = resp["TranscriptionJob"]
    return {
        "transcription_job_name": j.get("TranscriptionJobName", ""),
        "transcript_file_uri": j.get("Transcript", {}).get("TranscriptFileUri"),
        "media_uri": j.get("Media", {}).get("MediaFileUri", ""),
        "language_code": j.get("LanguageCode", ""),
        "transcription_job_status": j.get("TranscriptionJobStatus", ""),
        "creation_time": str(j.get("CreationTime", "")),
        "completion_time": str(j.get("CompletionTime", "")),
        "failure_reason": j.get("FailureReason", ""),
    }


@router.delete("/jobs/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_transcription_job(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transcribe")
    client.delete_transcription_job(TranscriptionJobName=name)


@router.get("/jobs/{name}/transcript", dependencies=[RequireViewer])
async def get_transcript(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "transcribe")
    try:
        resp = client.get_transcription_job(TranscriptionJobName=name)
        j = resp["TranscriptionJob"]
        uri = j.get("Transcript", {}).get("TranscriptFileUri")
        if not uri:
            return {"transcript": "", "items": [], "error": "Transcript not available yet"}
        async with httpx.AsyncClient(timeout=30) as http_client:
            r = await http_client.get(uri)
            r.raise_for_status()
            parsed = r.json()
        results = parsed.get("results", {})
        transcripts = results.get("transcripts", [])
        transcript_text = transcripts[0]["transcript"] if transcripts else ""
        return {"transcript": transcript_text, "items": results.get("items", [])}
    except Exception as e:
        return {"transcript": "", "items": [], "error": str(e)}
