from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireOperator, RequireViewer
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/awsconfig", tags=["awsconfig"])


# ─── Request Models ───────────────────────────────────────────────────────────

class RecordingGroupRequest(BaseModel):
    all_supported: Optional[bool] = True
    include_global_resource_types: Optional[bool] = True
    resource_types: Optional[List[str]] = None


class PutRecorderRequest(BaseModel):
    name: str
    role_arn: str
    recording_group: Optional[RecordingGroupRequest] = None


class SourceRequest(BaseModel):
    owner: str
    source_identifier: str


class PutConfigRuleRequest(BaseModel):
    config_rule_name: str
    description: Optional[str] = None
    scope: Optional[dict] = None
    source: SourceRequest
    input_parameters: Optional[str] = None


# ─── Configuration Recorder ───────────────────────────────────────────────────

@router.get("/recorders", dependencies=[RequireViewer])
async def list_recorders(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    recorders_resp = client.describe_configuration_recorders()
    status_resp = client.describe_configuration_recorder_status()
    status_by_name = {s["name"]: s for s in status_resp.get("ConfigurationRecordersStatus", [])}
    results = []
    for r in recorders_resp.get("ConfigurationRecorders", []):
        s = status_by_name.get(r["name"], {})
        group = r.get("recordingGroup", {})
        results.append({
            "name": r["name"],
            "role_arn": r.get("roleARN", ""),
            "all_supported": group.get("allSupported", False),
            "include_global_resource_types": group.get("includeGlobalResourceTypes", False),
            "recording": s.get("recording", False),
            "last_status": s.get("lastStatus", ""),
            "last_error_code": s.get("lastErrorCode", ""),
            "last_status_change_time": str(s.get("lastStatusChangeTime", "")),
        })
    return results


@router.post("/recorders", dependencies=[RequireOperator])
async def put_recorder(
    instance_id, body: PutRecorderRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    recording_group: dict = {}
    if body.recording_group:
        if body.recording_group.all_supported is not None:
            recording_group["allSupported"] = body.recording_group.all_supported
        if body.recording_group.include_global_resource_types is not None:
            recording_group["includeGlobalResourceTypes"] = body.recording_group.include_global_resource_types
        if body.recording_group.resource_types:
            recording_group["resourceTypes"] = body.recording_group.resource_types
    client.put_configuration_recorder(
        ConfigurationRecorder={
            "name": body.name,
            "roleARN": body.role_arn,
            "recordingGroup": recording_group,
        }
    )
    return {"success": True}


@router.post("/recorders/{name}/start", dependencies=[RequireOperator])
async def start_recorder(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    client.start_configuration_recorder(ConfigurationRecorderName=name)
    return {"success": True}


@router.post("/recorders/{name}/stop", dependencies=[RequireOperator])
async def stop_recorder(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    client.stop_configuration_recorder(ConfigurationRecorderName=name)
    return {"success": True}


# ─── Config Rules ─────────────────────────────────────────────────────────────

@router.get("/rules", dependencies=[RequireViewer])
async def list_rules(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    resp = client.describe_config_rules()
    return [
        {
            "config_rule_name": r["ConfigRuleName"],
            "config_rule_arn": r.get("ConfigRuleArn", ""),
            "config_rule_state": r.get("ConfigRuleState", ""),
            "description": r.get("Description", ""),
            "source": {
                "owner": r.get("Source", {}).get("Owner", ""),
                "source_identifier": r.get("Source", {}).get("SourceIdentifier", ""),
            },
        }
        for r in resp.get("ConfigRules", [])
    ]


@router.post("/rules", status_code=201, dependencies=[RequireOperator])
async def put_config_rule(
    instance_id, body: PutConfigRuleRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    config_rule: dict = {
        "ConfigRuleName": body.config_rule_name,
        "Source": {
            "Owner": body.source.owner,
            "SourceIdentifier": body.source.source_identifier,
        },
    }
    if body.description:
        config_rule["Description"] = body.description
    if body.scope:
        config_rule["Scope"] = body.scope
    if body.input_parameters:
        config_rule["InputParameters"] = body.input_parameters
    client.put_config_rule(ConfigRule=config_rule)
    return {"success": True}


@router.delete("/rules/{name}", status_code=204, dependencies=[RequireOperator])
async def delete_config_rule(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    client.delete_config_rule(ConfigRuleName=name)


# ─── Compliance ────────────────────────────────────────────────────────────────

@router.get("/compliance", dependencies=[RequireViewer])
async def get_compliance(
    instance_id,
    config_rule_names: Optional[str] = Query(default=None, description="Comma-separated rule names"),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    kwargs: dict = {}
    if config_rule_names:
        kwargs["ConfigRuleNames"] = [n.strip() for n in config_rule_names.split(",") if n.strip()]
    resp = client.describe_compliance_by_config_rule(**kwargs)
    return [
        {
            "config_rule_name": c["ConfigRuleName"],
            "compliance": {
                "compliance_type": c.get("Compliance", {}).get("ComplianceType", ""),
                "compliance_contributor_count": c.get("Compliance", {}).get("ComplianceContributorCount", {}),
            },
        }
        for c in resp.get("ComplianceByConfigRules", [])
    ]


# ─── Resource Inventory ────────────────────────────────────────────────────────

@router.get("/resources", dependencies=[RequireViewer])
async def list_discovered_resources(
    instance_id,
    resource_type: Optional[str] = Query(default="AWS::EC2::Instance"),
    db: AsyncSession = Depends(get_db),
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "config")
    # resourceType is required by the underlying AWS Config API; default to a
    # common type when the caller doesn't specify a filter.
    resp = client.list_discovered_resources(resourceType=resource_type or "AWS::EC2::Instance")
    return [
        {
            "resource_type": r.get("resourceType", ""),
            "resource_id": r.get("resourceId", ""),
            "resource_name": r.get("resourceName", ""),
        }
        for r in resp.get("resourceIdentifiers", [])
    ]
