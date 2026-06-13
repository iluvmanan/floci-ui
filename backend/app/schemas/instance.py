from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, HttpUrl


class InstanceCreate(BaseModel):
    name: str
    description: str | None = None
    endpoint: str
    region: str = "us-east-1"
    access_key: str = "test"
    secret_key: str
    account_id: str = "000000000000"
    tls_verify: bool = False


class InstanceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    endpoint: str | None = None
    region: str | None = None
    access_key: str | None = None
    secret_key: str | None = None
    account_id: str | None = None
    tls_verify: bool | None = None


class InstanceResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    endpoint: str
    region: str
    access_key: str
    account_id: str
    tls_verify: bool
    status: str
    last_checked_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthCheckResponse(BaseModel):
    status: str
    checked_at: datetime
    latency_ms: float | None
    error: str | None = None
