"""Phase 7: Audit logs, API keys, system info — TDD RED phase."""
import secrets
from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.instance import FlociInstance
from app.models.user import User, UserRole
from app.core.security import encrypt_secret


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def superadmin(db):
    u = User(
        email="super@p7.test",
        hashed_password=hash_password("pw"),
        role=UserRole.SUPERADMIN,
    )
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def admin(db):
    u = User(
        email="admin@p7.test",
        hashed_password=hash_password("pw"),
        role=UserRole.ADMIN,
    )
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def operator(db):
    u = User(
        email="operator@p7.test",
        hashed_password=hash_password("pw"),
        role=UserRole.OPERATOR,
    )
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def viewer(db):
    u = User(
        email="viewer@p7.test",
        hashed_password=hash_password("pw"),
        role=UserRole.VIEWER,
    )
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def instance(db, admin):
    inst = FlociInstance(
        name="p7-instance",
        endpoint="http://localhost:4566",
        region="us-east-1",
        access_key="test",
        secret_key_encrypted=encrypt_secret("secret"),
        account_id="000000000000",
        created_by=admin.id,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


@pytest.fixture
async def superadmin_client(superadmin, client):
    await client.post("/api/auth/login", json={"email": "super@p7.test", "password": "pw"})
    return client


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@p7.test", "password": "pw"})
    return client


@pytest.fixture
async def operator_client(operator, client):
    await client.post("/api/auth/login", json={"email": "operator@p7.test", "password": "pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@p7.test", "password": "pw"})
    return client


# ── Audit Logs ────────────────────────────────────────────────────────────────


class TestAuditLogs:
    async def test_mutating_request_creates_audit_entry(self, admin_client, instance, db):
        """POST/PUT/DELETE requests should create an audit_log row automatically."""
        from sqlalchemy import select
        from app.models.audit import AuditLog

        # Trigger a mutating request (health check is a POST)
        await admin_client.post(f"/api/instances/{instance.id}/health-check")

        rows = (await db.execute(select(AuditLog))).scalars().all()
        assert len(rows) >= 1
        entry = rows[0]
        assert entry.user_email == "admin@p7.test"
        assert entry.action is not None

    async def test_audit_list_requires_admin(self, viewer_client, operator_client):
        resp_viewer = await viewer_client.get("/api/audit")
        assert resp_viewer.status_code == 403

        resp_op = await operator_client.get("/api/audit")
        assert resp_op.status_code == 403

    async def test_audit_list_unauthenticated(self, client):
        resp = await client.get("/api/audit")
        assert resp.status_code == 401

    async def test_audit_list_returns_entries(self, admin_client, instance, db):
        from app.models.audit import AuditLog

        # Seed a log entry directly
        db.add(AuditLog(
            user_id=None,
            user_email="admin@p7.test",
            instance_id=instance.id,
            action="health_check",
            resource_type="instance",
            resource_id=str(instance.id),
            ip_address="127.0.0.1",
        ))
        await db.commit()

        resp = await admin_client.get("/api/audit")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) >= 1
        entry = data["items"][0]
        assert "action" in entry
        assert "user_email" in entry
        assert "created_at" in entry

    async def test_audit_filter_by_instance(self, admin_client, instance, db):
        from app.models.audit import AuditLog

        db.add(AuditLog(
            user_email="admin@p7.test",
            instance_id=instance.id,
            action="resource_create",
        ))
        other_id = uuid4()
        db.add(AuditLog(
            user_email="admin@p7.test",
            instance_id=None,
            action="login",
        ))
        await db.commit()

        resp = await admin_client.get(f"/api/audit?instance_id={instance.id}")
        assert resp.status_code == 200
        data = resp.json()
        assert all(
            item.get("instance_id") == str(instance.id)
            for item in data["items"]
        )

    async def test_audit_filter_by_action(self, admin_client, db):
        from app.models.audit import AuditLog

        db.add(AuditLog(user_email="a@b.com", action="login"))
        db.add(AuditLog(user_email="a@b.com", action="resource_delete"))
        await db.commit()

        resp = await admin_client.get("/api/audit?action=login")
        assert resp.status_code == 200
        data = resp.json()
        assert all(item["action"] == "login" for item in data["items"])

    async def test_audit_pagination(self, admin_client, db):
        from app.models.audit import AuditLog

        for i in range(15):
            db.add(AuditLog(user_email=f"u{i}@test.com", action="login"))
        await db.commit()

        resp = await admin_client.get("/api/audit?limit=5&offset=0")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 5
        assert data["total"] >= 15

    async def test_audit_export_csv(self, admin_client, db):
        from app.models.audit import AuditLog

        db.add(AuditLog(user_email="admin@p7.test", action="login"))
        await db.commit()

        resp = await admin_client.get("/api/audit/export")
        assert resp.status_code == 200
        assert "text/csv" in resp.headers.get("content-type", "")
        assert b"action" in resp.content  # CSV header row


# ── API Keys ──────────────────────────────────────────────────────────────────


class TestApiKeys:
    async def test_generate_api_key(self, admin_client):
        resp = await admin_client.post("/api/api-keys", json={
            "name": "ci-key",
            "scopes": ["read"],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert "key" in data  # shown once
        assert data["key"].startswith("floci_")
        assert "id" in data
        assert data["name"] == "ci-key"

    async def test_key_shown_only_once(self, admin_client):
        create = await admin_client.post("/api/api-keys", json={"name": "once", "scopes": []})
        assert create.status_code == 201

        key_id = create.json()["id"]
        list_resp = await admin_client.get("/api/api-keys")
        listed = next(k for k in list_resp.json() if k["id"] == key_id)
        assert "key" not in listed  # raw key NOT returned in list

    async def test_list_own_keys(self, admin_client):
        await admin_client.post("/api/api-keys", json={"name": "k1", "scopes": []})
        await admin_client.post("/api/api-keys", json={"name": "k2", "scopes": ["read"]})

        resp = await admin_client.get("/api/api-keys")
        assert resp.status_code == 200
        names = [k["name"] for k in resp.json()]
        assert "k1" in names
        assert "k2" in names

    async def test_revoke_key(self, admin_client):
        create = await admin_client.post("/api/api-keys", json={"name": "revoke-me", "scopes": []})
        key_id = create.json()["id"]

        resp = await admin_client.delete(f"/api/api-keys/{key_id}")
        assert resp.status_code == 204

        list_resp = await admin_client.get("/api/api-keys")
        ids = [k["id"] for k in list_resp.json()]
        assert key_id not in ids

    async def test_cannot_revoke_others_key(self, client, admin, viewer):
        # Login as admin and create a key
        await client.post("/api/auth/login", json={"email": "admin@p7.test", "password": "pw"})
        create = await client.post("/api/api-keys", json={"name": "admin-key", "scopes": []})
        assert create.status_code == 201
        key_id = create.json()["id"]

        # Switch to viewer and try to delete admin's key
        await client.post("/api/auth/login", json={"email": "viewer@p7.test", "password": "pw"})
        resp = await client.delete(f"/api/api-keys/{key_id}")
        assert resp.status_code in (403, 404)

    async def test_authenticate_with_api_key(self, admin_client, client):
        create = await admin_client.post("/api/api-keys", json={"name": "bearer-key", "scopes": ["read"]})
        raw_key = create.json()["key"]

        # Use the raw key as a Bearer token on a fresh (unauthenticated) client
        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {raw_key}"})
        assert resp.status_code == 200
        assert resp.json()["email"] == "admin@p7.test"

    async def test_expired_key_rejected(self, admin_client, client):
        create = await admin_client.post("/api/api-keys", json={
            "name": "expired-key",
            "scopes": [],
            "expires_at": (datetime.now(UTC) - timedelta(days=1)).isoformat(),
        })
        raw_key = create.json()["key"]

        resp = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {raw_key}"})
        assert resp.status_code == 401

    async def test_generate_key_unauthenticated(self, client):
        resp = await client.post("/api/api-keys", json={"name": "x", "scopes": []})
        assert resp.status_code == 401

    async def test_generate_key_with_expiry(self, admin_client):
        expires = (datetime.now(UTC) + timedelta(days=30)).isoformat()
        resp = await admin_client.post("/api/api-keys", json={
            "name": "expiring",
            "scopes": ["read"],
            "expires_at": expires,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["expires_at"] is not None


# ── System Info ───────────────────────────────────────────────────────────────


class TestSystemInfo:
    async def test_health_public(self, client):
        resp = await client.get("/api/system/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["db"] is True
        assert "version" in data
        assert "uptime_s" in data

    async def test_info_requires_auth(self, client):
        resp = await client.get("/api/system/info")
        assert resp.status_code == 401

    async def test_info_returns_counts(self, admin_client, instance):
        resp = await admin_client.get("/api/system/info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["user_count"] >= 1
        assert data["instance_count"] >= 1
        assert "version" in data
        assert "uptime_s" in data
