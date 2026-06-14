"""Audit logging middleware — records all mutating HTTP requests."""
from uuid import UUID

from fastapi import Request
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.models.audit import AuditLog

_MUTATING = {"POST", "PUT", "PATCH", "DELETE"}
_SKIP_PREFIXES = ("/api/auth/refresh", "/api/system/health", "/api/auth/login")


def _extract_instance_id(path: str) -> UUID | None:
    parts = path.split("/")
    for i, part in enumerate(parts):
        if part == "instances" and i + 1 < len(parts):
            try:
                return UUID(parts[i + 1])
            except ValueError:
                return None
    return None


def _action_from(method: str, path: str) -> str:
    segment = path.rstrip("/").split("/")[-1]
    prefix = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}.get(method, method.lower())
    return f"{prefix}_{segment}"


def _user_from_request(request: Request) -> tuple[UUID | None, str | None]:
    """Decode the access_token cookie to extract user_id and email without a DB hit."""
    from app.core.config import settings
    from jose import jwt

    token = request.cookies.get("access_token")
    if not token:
        return None, None
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        uid = UUID(payload["sub"])
        email = payload.get("email")
        return uid, email
    except (JWTError, ValueError, KeyError):
        return None, None


def make_audit_middleware(session_factory: async_sessionmaker[AsyncSession] | None = None):
    async def audit_middleware(request: Request, call_next):
        response = await call_next(request)

        method = request.method
        path = request.url.path

        if method not in _MUTATING:
            return response
        if any(path.startswith(p) for p in _SKIP_PREFIXES):
            return response
        if response.status_code >= 500:
            return response

        user_id, user_email = _user_from_request(request)
        instance_id = _extract_instance_id(path)
        action = _action_from(method, path)
        ip = request.headers.get("x-forwarded-for") or (request.client.host if request.client else None)

        factory = session_factory or getattr(request.app.state, "db_factory", None)
        if factory is None:
            return response
        try:
            async with factory() as db:
                db.add(AuditLog(
                    user_id=user_id,
                    user_email=user_email,
                    instance_id=instance_id,
                    action=action,
                    resource_type=path.split("/")[-2] if path.count("/") >= 2 else None,
                    ip_address=ip,
                ))
                await db.commit()
        except Exception:
            pass

        return response

    return audit_middleware
