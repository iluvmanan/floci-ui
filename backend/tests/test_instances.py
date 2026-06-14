"""Phase 2: Instance Manager — CRUD, RBAC, health checks, encryption."""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import encrypt_secret, hash_password
from app.models.instance import FlociInstance, InstanceStatus
from app.models.user import User, UserRole

# ── Fixtures ──────────────────────────────────────────────────────────────────

INSTANCE_PAYLOAD = {
    "name": "local-floci",
    "endpoint": "http://localhost:4566",
    "region": "us-east-1",
    "access_key": "test",
    "secret_key": "test-secret",
    "account_id": "000000000000",
    "tls_verify": False,
}


@pytest.fixture
async def admin(db):
    u = User(email="admin@inst.test", hashed_password=hash_password("admin-pw"), role=UserRole.ADMIN)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def viewer(db):
    u = User(email="viewer@inst.test", hashed_password=hash_password("viewer-pw"), role=UserRole.VIEWER)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def operator(db):
    u = User(
        email="operator@inst.test",
        hashed_password=hash_password("operator-pw"),
        role=UserRole.OPERATOR,
    )
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@inst.test", "password": "admin-pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@inst.test", "password": "viewer-pw"})
    return client


@pytest.fixture
async def operator_client(operator, client):
    await client.post(
        "/api/auth/login", json={"email": "operator@inst.test", "password": "operator-pw"}
    )
    return client


@pytest.fixture
async def sample_instance(db, admin):
    """Instance pre-created directly in DB (bypasses API)."""
    inst = FlociInstance(
        name="test-instance",
        endpoint="http://localhost:4566",
        region="us-east-1",
        access_key="test",
        secret_key_encrypted=encrypt_secret("test-secret"),
        account_id="000000000000",
        created_by=admin.id,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


# ── List instances ────────────────────────────────────────────────────────────


async def test_list_instances_empty(viewer_client: AsyncClient):
    resp = await viewer_client.get("/api/instances")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_instances_returns_existing(viewer_client: AsyncClient, sample_instance: FlociInstance):
    resp = await viewer_client.get("/api/instances")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["name"] == "test-instance"


async def test_list_instances_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/instances")
    assert resp.status_code == 401


# ── Create instance ───────────────────────────────────────────────────────────


async def test_create_instance_as_admin(admin_client: AsyncClient):
    with patch("app.routers.instances.check_health", new=AsyncMock()):
        resp = await admin_client.post("/api/instances", json=INSTANCE_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "local-floci"
    assert data["endpoint"] == "http://localhost:4566"
    assert data["region"] == "us-east-1"
    assert data["status"] == "unknown"
    assert "id" in data


async def test_create_instance_secret_not_in_response(admin_client: AsyncClient):
    with patch("app.routers.instances.check_health", new=AsyncMock()):
        resp = await admin_client.post("/api/instances", json=INSTANCE_PAYLOAD)
    assert resp.status_code == 201
    data = resp.json()
    assert "secret_key" not in data
    assert "secret_key_encrypted" not in data


async def test_create_instance_viewer_forbidden(viewer_client: AsyncClient):
    resp = await viewer_client.post("/api/instances", json=INSTANCE_PAYLOAD)
    assert resp.status_code == 403


async def test_create_instance_unauthenticated(client: AsyncClient):
    resp = await client.post("/api/instances", json=INSTANCE_PAYLOAD)
    assert resp.status_code == 401


async def test_create_instance_missing_required_fields(admin_client: AsyncClient):
    resp = await admin_client.post("/api/instances", json={"name": "incomplete"})
    assert resp.status_code == 422


# ── Get instance ──────────────────────────────────────────────────────────────


async def test_get_instance_viewer_can_read(viewer_client: AsyncClient, sample_instance: FlociInstance):
    resp = await viewer_client.get(f"/api/instances/{sample_instance.id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == str(sample_instance.id)


async def test_get_instance_not_found(viewer_client: AsyncClient):
    resp = await viewer_client.get("/api/instances/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_get_instance_unauthenticated(client: AsyncClient, sample_instance: FlociInstance):
    resp = await client.get(f"/api/instances/{sample_instance.id}")
    assert resp.status_code == 401


# ── Update instance ───────────────────────────────────────────────────────────


async def test_update_instance_name(admin_client: AsyncClient, sample_instance: FlociInstance):
    resp = await admin_client.put(
        f"/api/instances/{sample_instance.id}", json={"name": "renamed"}
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "renamed"


async def test_update_instance_viewer_forbidden(
    viewer_client: AsyncClient, sample_instance: FlociInstance
):
    resp = await viewer_client.put(f"/api/instances/{sample_instance.id}", json={"name": "x"})
    assert resp.status_code == 403


async def test_update_instance_not_found(admin_client: AsyncClient):
    resp = await admin_client.put(
        "/api/instances/00000000-0000-0000-0000-000000000000", json={"name": "x"}
    )
    assert resp.status_code == 404


# ── Delete instance ───────────────────────────────────────────────────────────


async def test_delete_instance_admin(admin_client: AsyncClient, sample_instance: FlociInstance):
    resp = await admin_client.delete(f"/api/instances/{sample_instance.id}")
    assert resp.status_code == 204
    assert (await admin_client.get(f"/api/instances/{sample_instance.id}")).status_code == 404


async def test_delete_instance_viewer_forbidden(
    viewer_client: AsyncClient, sample_instance: FlociInstance
):
    resp = await viewer_client.delete(f"/api/instances/{sample_instance.id}")
    assert resp.status_code == 403


async def test_delete_instance_not_found(admin_client: AsyncClient):
    resp = await admin_client.delete("/api/instances/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


# ── Health check ──────────────────────────────────────────────────────────────


async def test_health_check_marks_healthy(
    operator_client: AsyncClient, sample_instance: FlociInstance
):
    mock_sts = MagicMock()
    mock_sts.get_caller_identity.return_value = {"Account": "000000000000"}
    with patch("app.routers.instances.get_client", return_value=mock_sts):
        resp = await operator_client.post(f"/api/instances/{sample_instance.id}/health-check")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["latency_ms"] is not None
    assert data["error"] is None


async def test_health_check_marks_unreachable(
    operator_client: AsyncClient, sample_instance: FlociInstance
):
    mock_sts = MagicMock()
    mock_sts.get_caller_identity.side_effect = ConnectionError("Connection refused")
    with patch("app.routers.instances.get_client", return_value=mock_sts):
        resp = await operator_client.post(f"/api/instances/{sample_instance.id}/health-check")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "unreachable"
    assert data["error"] is not None


async def test_health_check_viewer_forbidden(
    viewer_client: AsyncClient, sample_instance: FlociInstance
):
    resp = await viewer_client.post(f"/api/instances/{sample_instance.id}/health-check")
    assert resp.status_code == 403


async def test_health_check_operator_allowed(
    operator_client: AsyncClient, sample_instance: FlociInstance
):
    mock_sts = MagicMock()
    mock_sts.get_caller_identity.return_value = {"Account": "000000000000"}
    with patch("app.routers.instances.get_client", return_value=mock_sts):
        resp = await operator_client.post(f"/api/instances/{sample_instance.id}/health-check")
    assert resp.status_code == 200


async def test_health_check_not_found(operator_client: AsyncClient):
    resp = await operator_client.post(
        "/api/instances/00000000-0000-0000-0000-000000000000/health-check"
    )
    assert resp.status_code == 404


# ── Encryption ────────────────────────────────────────────────────────────────


async def test_secret_key_encrypted_at_rest(admin_client: AsyncClient, db):
    with patch("app.routers.instances.check_health", new=AsyncMock()):
        resp = await admin_client.post(
            "/api/instances", json={**INSTANCE_PAYLOAD, "secret_key": "super-secret"}
        )
    assert resp.status_code == 201
    instance_id = UUID(resp.json()["id"])

    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    inst = result.scalar_one()
    assert inst.secret_key_encrypted != "super-secret"
    assert inst.secret_key_encrypted.startswith("gAAAAA")  # Fernet token prefix


async def test_secret_key_decryptable(admin_client: AsyncClient, db):
    from app.core.security import decrypt_secret

    with patch("app.routers.instances.check_health", new=AsyncMock()):
        resp = await admin_client.post(
            "/api/instances", json={**INSTANCE_PAYLOAD, "secret_key": "my-secret-key"}
        )
    instance_id = UUID(resp.json()["id"])

    result = await db.execute(select(FlociInstance).where(FlociInstance.id == instance_id))
    inst = result.scalar_one()
    assert decrypt_secret(inst.secret_key_encrypted) == "my-secret-key"
