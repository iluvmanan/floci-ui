"""AWS Backup resource router."""
from typing import Optional, List

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import RequireViewer, RequireOperator
import app.routers.resources.base as _rb
from app.routers.resources.base import get_instance

router = APIRouter(prefix="/instances/{instance_id}/resources/backup", tags=["backup"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateVaultRequest(BaseModel):
    backup_vault_name: str
    encryption_key_arn: Optional[str] = None


class BackupRule(BaseModel):
    rule_name: str
    target_vault_name: str
    schedule_expression: Optional[str] = None
    start_window_minutes: Optional[int] = None
    completion_window_minutes: Optional[int] = None
    delete_after_days: Optional[int] = None


class CreatePlanRequest(BaseModel):
    backup_plan_name: str
    rules: List[BackupRule]


class StartBackupJobRequest(BaseModel):
    backup_vault_name: str
    resource_arn: str
    iam_role_arn: str
    start_window_minutes: Optional[int] = None


# ─── Vaults ───────────────────────────────────────────────────────────────────

@router.get("/vaults", dependencies=[RequireViewer])
async def list_vaults(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    resp = client.list_backup_vaults()
    return [
        {
            "backup_vault_name": v.get("BackupVaultName", ""),
            "backup_vault_arn": v.get("BackupVaultArn", ""),
            "creation_date": str(v.get("CreationDate", "")),
            "number_of_recovery_points": v.get("NumberOfRecoveryPoints", 0),
            "encryption_key_arn": v.get("EncryptionKeyArn", ""),
        }
        for v in resp.get("BackupVaultList", [])
    ]


@router.post("/vaults", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_vault(
    instance_id, body: CreateVaultRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    kwargs: dict = {"BackupVaultName": body.backup_vault_name}
    if body.encryption_key_arn:
        kwargs["EncryptionKeyArn"] = body.encryption_key_arn
    resp = client.create_backup_vault(**kwargs)
    return {
        "backup_vault_name": resp.get("BackupVaultName", ""),
        "backup_vault_arn": resp.get("BackupVaultArn", ""),
    }


@router.delete("/vaults/{name}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_vault(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    client.delete_backup_vault(BackupVaultName=name)


# ─── Plans ────────────────────────────────────────────────────────────────────

@router.get("/plans", dependencies=[RequireViewer])
async def list_plans(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    resp = client.list_backup_plans()
    return [
        {
            "backup_plan_id": p.get("BackupPlanId", ""),
            "backup_plan_name": p.get("BackupPlanName", ""),
            "creation_date": str(p.get("CreationDate", "")),
            "last_execution_date": str(p.get("LastExecutionDate", "")),
            "rules_count": len(p.get("Rules", [])) if p.get("Rules") else 0,
        }
        for p in resp.get("BackupPlansList", [])
    ]


@router.post("/plans", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def create_plan(
    instance_id, body: CreatePlanRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    plan = {
        "BackupPlanName": body.backup_plan_name,
        "Rules": [
            {
                "RuleName": r.rule_name,
                "TargetBackupVaultName": r.target_vault_name,
                **({"ScheduleExpression": r.schedule_expression} if r.schedule_expression else {}),
                **({"StartWindowMinutes": r.start_window_minutes} if r.start_window_minutes else {}),
                **({"CompletionWindowMinutes": r.completion_window_minutes} if r.completion_window_minutes else {}),
                **({"Lifecycle": {"DeleteAfterDays": r.delete_after_days}} if r.delete_after_days else {}),
            }
            for r in body.rules
        ],
    }
    resp = client.create_backup_plan(BackupPlan=plan)
    return {
        "backup_plan_id": resp.get("BackupPlanId", ""),
        "backup_plan_arn": resp.get("BackupPlanArn", ""),
    }


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[RequireOperator])
async def delete_plan(instance_id, plan_id: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    client.delete_backup_plan(BackupPlanId=plan_id)


# ─── Jobs ─────────────────────────────────────────────────────────────────────

@router.get("/jobs/backup", dependencies=[RequireViewer])
async def list_backup_jobs(instance_id, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    resp = client.list_backup_jobs()
    return [
        {
            "backup_job_id": j.get("BackupJobId", ""),
            "resource_arn": j.get("ResourceArn", ""),
            "resource_type": j.get("ResourceType", ""),
            "backup_vault_name": j.get("BackupVaultName", ""),
            "state": j.get("State", ""),
            "percent_done": j.get("PercentDone", ""),
            "start_by": str(j.get("StartBy", "")),
            "creation_date": str(j.get("CreationDate", "")),
            "completion_date": str(j.get("CompletionDate", "")),
        }
        for j in resp.get("BackupJobs", [])
    ]


@router.post("/jobs/backup", status_code=status.HTTP_201_CREATED, dependencies=[RequireOperator])
async def start_backup_job(
    instance_id, body: StartBackupJobRequest, db: AsyncSession = Depends(get_db)
):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    kwargs: dict = {
        "BackupVaultName": body.backup_vault_name,
        "ResourceArn": body.resource_arn,
        "IamRoleArn": body.iam_role_arn,
    }
    if body.start_window_minutes:
        kwargs["StartWindowMinutes"] = body.start_window_minutes
    resp = client.start_backup_job(**kwargs)
    return {
        "backup_job_id": resp.get("BackupJobId", ""),
        "creation_date": str(resp.get("CreationDate", "")),
    }


# ─── Recovery Points ───────────────────────────────────────────────────────────

@router.get("/vaults/{name}/recovery-points", dependencies=[RequireViewer])
async def list_recovery_points(instance_id, name: str, db: AsyncSession = Depends(get_db)):
    inst = await get_instance(instance_id, db)
    client = _rb.get_client(inst, "backup")
    resp = client.list_recovery_points_by_backup_vault(BackupVaultName=name)
    return [
        {
            "recovery_point_arn": r.get("RecoveryPointArn", ""),
            "resource_arn": r.get("ResourceArn", ""),
            "resource_type": r.get("ResourceType", ""),
            "creation_date": str(r.get("CreationDate", "")),
            "status": r.get("Status", ""),
            "backup_size_in_bytes": r.get("BackupSizeInBytes", 0),
        }
        for r in resp.get("RecoveryPoints", [])
    ]
