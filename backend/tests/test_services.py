"""Phase 4: Service Control Panel — list, enable/disable, batch toggle."""
import pytest
from httpx import AsyncClient

from app.core.security import encrypt_secret, hash_password
from app.models.instance import FlociInstance
from app.models.user import User, UserRole


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def admin(db):
    u = User(email="admin@svc.test", hashed_password=hash_password("admin-pw"), role=UserRole.ADMIN)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def operator(db):
    u = User(email="operator@svc.test", hashed_password=hash_password("op-pw"), role=UserRole.OPERATOR)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def viewer(db):
    u = User(email="viewer@svc.test", hashed_password=hash_password("viewer-pw"), role=UserRole.VIEWER)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@svc.test", "password": "admin-pw"})
    return client


@pytest.fixture
async def operator_client(operator, client):
    await client.post("/api/auth/login", json={"email": "operator@svc.test", "password": "op-pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@svc.test", "password": "viewer-pw"})
    return client


@pytest.fixture
async def instance(db, admin):
    inst = FlociInstance(
        name="svc-instance",
        endpoint="http://localhost:4566",
        region="us-east-1",
        access_key="test",
        secret_key_encrypted=encrypt_secret("test-secret"),
        account_id="000000000000",
        created_by=admin.id,
        config={},
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)
    return inst


# ── GET /services ─────────────────────────────────────────────────────────────


async def test_list_services_returns_all_56(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/services")
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    assert len(data["services"]) == 56


async def test_list_services_schema(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/services")
    svc = resp.json()["services"][0]
    for field in ("name", "display_name", "category", "description", "operation_count", "env_key", "enabled"):
        assert field in svc, f"Missing field: {field}"


async def test_list_services_viewer_allowed(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.get(f"/api/instances/{instance.id}/services")
    assert resp.status_code == 200


async def test_list_services_unauthenticated(client: AsyncClient, instance: FlociInstance):
    resp = await client.get(f"/api/instances/{instance.id}/services")
    assert resp.status_code == 401


async def test_list_services_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/api/instances/00000000-0000-0000-0000-000000000000/services")
    assert resp.status_code == 404


async def test_list_services_all_enabled_by_default(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/services")
    services = resp.json()["services"]
    all_enabled = all(s["enabled"] for s in services)
    assert all_enabled, "All services should be enabled by default"


async def test_list_services_categories_present(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/services")
    categories = {s["category"] for s in resp.json()["services"]}
    for cat in ("compute", "storage", "messaging", "security", "analytics", "infrastructure"):
        assert cat in categories, f"Missing category: {cat}"


# ── PUT /services/{service} ───────────────────────────────────────────────────


async def test_toggle_service_disable(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.put(
        f"/api/instances/{instance.id}/services/lambda",
        json={"enabled": False},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "lambda"
    assert data["enabled"] is False


async def test_toggle_service_re_enable(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/services/lambda",
        json={"enabled": False},
    )
    resp = await admin_client.put(
        f"/api/instances/{instance.id}/services/lambda",
        json={"enabled": True},
    )
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True


async def test_toggle_service_persists(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/services/s3",
        json={"enabled": False},
    )
    resp = await admin_client.get(f"/api/instances/{instance.id}/services")
    s3 = next(s for s in resp.json()["services"] if s["name"] == "s3")
    assert s3["enabled"] is False


async def test_toggle_service_viewer_forbidden(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.put(
        f"/api/instances/{instance.id}/services/s3",
        json={"enabled": False},
    )
    assert resp.status_code == 403


async def test_toggle_service_operator_allowed(operator_client: AsyncClient, instance: FlociInstance):
    resp = await operator_client.put(
        f"/api/instances/{instance.id}/services/s3",
        json={"enabled": False},
    )
    assert resp.status_code == 200


async def test_toggle_service_not_found_instance(admin_client: AsyncClient):
    resp = await admin_client.put(
        "/api/instances/00000000-0000-0000-0000-000000000000/services/s3",
        json={"enabled": False},
    )
    assert resp.status_code == 404


async def test_toggle_unknown_service_returns_404(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.put(
        f"/api/instances/{instance.id}/services/nonexistent-service",
        json={"enabled": False},
    )
    assert resp.status_code == 404


# ── PUT /services/batch ───────────────────────────────────────────────────────


async def test_batch_toggle_services(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.put(
        f"/api/instances/{instance.id}/services/batch",
        json={"services": [{"name": "lambda", "enabled": False}, {"name": "s3", "enabled": False}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    lambda_svc = next(s for s in data["services"] if s["name"] == "lambda")
    s3_svc = next(s for s in data["services"] if s["name"] == "s3")
    assert lambda_svc["enabled"] is False
    assert s3_svc["enabled"] is False


async def test_batch_toggle_viewer_forbidden(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.put(
        f"/api/instances/{instance.id}/services/batch",
        json={"services": [{"name": "lambda", "enabled": False}]},
    )
    assert resp.status_code == 403


async def test_batch_enable_all(admin_client: AsyncClient, instance: FlociInstance):
    # First disable a few
    await admin_client.put(
        f"/api/instances/{instance.id}/services/lambda", json={"enabled": False}
    )
    # Batch enable all by sending empty list (no services = no-op, but test the endpoint works)
    resp = await admin_client.put(
        f"/api/instances/{instance.id}/services/batch",
        json={"services": [{"name": "lambda", "enabled": True}]},
    )
    assert resp.status_code == 200
    lambda_svc = next(s for s in resp.json()["services"] if s["name"] == "lambda")
    assert lambda_svc["enabled"] is True
