from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
from app.routers.resources.base import get_instance, get_client

router = APIRouter(prefix="/instances/{instance_id}/resources/acm", tags=["acm"])


# ─── Request Models ───────────────────────────────────────────────────────────

class RequestCertRequest(BaseModel):
    domain_name: str
    validation_method: str = "DNS"  # DNS|EMAIL
    subject_alternative_names: Optional[List[str]] = None


class ResendValidationRequest(BaseModel):
    domain: str
    validation_domain: str


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cert_summary(cert: dict) -> dict:
    return {
        "certificate_arn": cert.get("CertificateArn"),
        "domain_name": cert.get("DomainName"),
        "status": cert.get("Status"),
        "type": cert.get("Type"),
        "in_use_by": cert.get("InUseBy", []),
        "not_after": str(cert.get("NotAfter", "")),
        "subject_alternative_names": cert.get("SubjectAlternativeNames", []),
        "created_at": str(cert.get("CreatedAt", "")),
        "issued_at": str(cert.get("IssuedAt", "")),
    }


# ─── Certificates ─────────────────────────────────────────────────────────────

@router.get("/certificates", dependencies=[RequireViewer])
async def list_certificates(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "acm")
    resp = client.list_certificates()
    summaries = resp.get("CertificateSummaryList", [])
    certs = []
    for s in summaries:
        arn = s["CertificateArn"]
        detail = client.describe_certificate(CertificateArn=arn)
        certs.append(_cert_summary(detail["Certificate"]))
    return certs


@router.post("/certificates", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def request_certificate(
    instance_id, body: RequestCertRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "acm")
    kwargs: dict = {
        "DomainName": body.domain_name,
        "ValidationMethod": body.validation_method,
    }
    if body.subject_alternative_names:
        kwargs["SubjectAlternativeNames"] = body.subject_alternative_names
    resp = client.request_certificate(**kwargs)
    return {"certificate_arn": resp["CertificateArn"]}


@router.delete("/certificates/{cert_arn:path}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_certificate(instance_id, cert_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "acm")
    client.delete_certificate(CertificateArn=cert_arn)


@router.get("/certificates/{cert_arn:path}", dependencies=[RequireViewer])
async def describe_certificate(instance_id, cert_arn: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "acm")
    resp = client.describe_certificate(CertificateArn=cert_arn)
    cert = resp["Certificate"]
    summary = _cert_summary(cert)
    summary["domain_validation_options"] = cert.get("DomainValidationOptions", [])
    return summary


@router.post("/certificates/{cert_arn:path}/resend-validation", dependencies=[RequireOperator])
async def resend_validation_email(
    instance_id, cert_arn: str, body: ResendValidationRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = get_client(inst, "acm")
    client.resend_validation_email(
        CertificateArn=cert_arn,
        Domain=body.domain,
        ValidationDomain=body.validation_domain,
    )
    return {"success": True}
