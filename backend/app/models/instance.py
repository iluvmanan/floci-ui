import enum
from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class InstanceStatus(str, enum.Enum):
    UNKNOWN = "unknown"
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNREACHABLE = "unreachable"


class FlociInstance(Base):
    __tablename__ = "floci_instances"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    endpoint: Mapped[str] = mapped_column(String(512), nullable=False)
    region: Mapped[str] = mapped_column(String(64), nullable=False, default="us-east-1")
    access_key: Mapped[str] = mapped_column(String(255), nullable=False, default="test")
    secret_key_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    account_id: Mapped[str] = mapped_column(String(12), nullable=False, default="000000000000")
    tls_verify: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[InstanceStatus] = mapped_column(
        Enum(InstanceStatus), nullable=False, default=InstanceStatus.UNKNOWN
    )
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
