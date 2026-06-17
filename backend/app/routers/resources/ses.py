from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/ses", tags=["ses"])


# ─── Request Models ───────────────────────────────────────────────────────────

class VerifyEmailRequest(BaseModel):
    email_address: str


class VerifyDomainRequest(BaseModel):
    domain: str


class CreateTemplateRequest(BaseModel):
    name: str
    subject_part: str
    html_part: Optional[str] = None
    text_part: Optional[str] = None
    description: Optional[str] = None


class SendEmailRequest(BaseModel):
    source: str
    destinations: List[str]
    subject: str
    body_text: Optional[str] = None
    body_html: Optional[str] = None


class SendTemplatedEmailRequest(BaseModel):
    source: str
    destinations: List[str]
    template: str
    template_data: str


# ─── Identities ───────────────────────────────────────────────────────────────

@router.get("/identities", dependencies=[RequireViewer])
async def list_identities(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    identities: list[str] = []
    for id_type in ("EmailAddress", "Domain"):
        resp = client.list_identities(IdentityType=id_type, MaxItems=100)
        identities.extend(resp.get("Identities", []))
    if not identities:
        return []
    attrs_resp = client.get_identity_verification_attributes(Identities=identities)
    attrs = attrs_resp.get("VerificationAttributes", {})
    results = []
    for identity in identities:
        a = attrs.get(identity, {})
        results.append({
            "identity": identity,
            "verification_status": a.get("VerificationStatus", "Pending"),
            "verification_token": a.get("VerificationToken"),
        })
    return results


@router.post("/identities/email", dependencies=[RequireOperator])
async def verify_email_identity(
    instance_id, body: VerifyEmailRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    client.verify_email_identity(EmailAddress=body.email_address)
    return {"success": True}


@router.post("/identities/domain", dependencies=[RequireOperator])
async def verify_domain_identity(
    instance_id, body: VerifyDomainRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    resp = client.verify_domain_identity(Domain=body.domain)
    return {"verification_token": resp["VerificationToken"]}


@router.delete("/identities/{identity}", status_code=204, dependencies=[RequireOperator])
async def delete_identity(instance_id, identity: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    client.delete_identity(Identity=identity)


# ─── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", dependencies=[RequireViewer])
async def list_templates(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    resp = client.list_templates(MaxItems=100)
    templates = []
    for t in resp.get("TemplatesMetadata", []):
        name = t["Name"]
        detail = client.get_template(TemplateName=name)
        tpl = detail.get("Template", {})
        templates.append({
            "name": name,
            "subject_part": tpl.get("SubjectPart", ""),
            "html_part": tpl.get("HtmlPart", ""),
            "text_part": tpl.get("TextPart", ""),
        })
    return templates


@router.post("/templates", status_code=201, dependencies=[RequireOperator])
async def create_template(
    instance_id, body: CreateTemplateRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    template: dict = {"TemplateName": body.name, "SubjectPart": body.subject_part}
    if body.html_part:
        template["HtmlPart"] = body.html_part
    if body.text_part:
        template["TextPart"] = body.text_part
    client.create_template(Template=template)
    return {"success": True}


@router.delete("/templates/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_template(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    client.delete_template(TemplateName=name)


# ─── Sending ──────────────────────────────────────────────────────────────────

@router.post("/send", dependencies=[RequireOperator])
async def send_email(
    instance_id, body: SendEmailRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    message_body: dict = {}
    if body.body_text:
        message_body["Text"] = {"Data": body.body_text}
    if body.body_html:
        message_body["Html"] = {"Data": body.body_html}
    resp = client.send_email(
        Source=body.source,
        Destination={"ToAddresses": body.destinations},
        Message={"Subject": {"Data": body.subject}, "Body": message_body},
    )
    return {"message_id": resp["MessageId"]}


@router.post("/send-template", dependencies=[RequireOperator])
async def send_templated_email(
    instance_id, body: SendTemplatedEmailRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    resp = client.send_templated_email(
        Source=body.source,
        Destination={"ToAddresses": body.destinations},
        Template=body.template,
        TemplateData=body.template_data,
    )
    return {"message_id": resp["MessageId"]}


# ─── Statistics & Quota ───────────────────────────────────────────────────────

@router.get("/statistics", dependencies=[RequireViewer])
async def get_send_statistics(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    resp = client.get_send_statistics()
    return [
        {
            "timestamp": str(dp.get("Timestamp", "")),
            "delivery_attempts": dp.get("DeliveryAttempts", 0),
            "bounces": dp.get("Bounces", 0),
            "complaints": dp.get("Complaints", 0),
            "rejects": dp.get("Rejects", 0),
        }
        for dp in resp.get("SendDataPoints", [])
    ]


@router.get("/quota", dependencies=[RequireViewer])
async def get_send_quota(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "ses")
    resp = client.get_send_quota()
    return {
        "max_24_hour_send": resp.get("Max24HourSend", 0),
        "max_send_rate": resp.get("MaxSendRate", 0),
        "sent_last_24_hours": resp.get("SentLast24Hours", 0),
    }
