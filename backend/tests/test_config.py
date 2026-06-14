"""Phase 3: Configuration Manager — GET/PUT/reset/export."""
import pytest
from httpx import AsyncClient

from app.core.security import encrypt_secret, hash_password
from app.models.instance import FlociInstance
from app.models.user import User, UserRole


# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
async def admin(db):
    u = User(email="admin@config.test", hashed_password=hash_password("admin-pw"), role=UserRole.ADMIN)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def viewer(db):
    u = User(email="viewer@config.test", hashed_password=hash_password("viewer-pw"), role=UserRole.VIEWER)
    db.add(u)
    await db.commit()
    return u


@pytest.fixture
async def admin_client(admin, client):
    await client.post("/api/auth/login", json={"email": "admin@config.test", "password": "admin-pw"})
    return client


@pytest.fixture
async def viewer_client(viewer, client):
    await client.post("/api/auth/login", json={"email": "viewer@config.test", "password": "viewer-pw"})
    return client


@pytest.fixture
async def instance(db, admin):
    inst = FlociInstance(
        name="cfg-instance",
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


# ── GET config ────────────────────────────────────────────────────────────────


async def test_get_config_returns_defaults_when_empty(
    admin_client: AsyncClient, instance: FlociInstance
):
    resp = await admin_client.get(f"/api/instances/{instance.id}/config")
    assert resp.status_code == 200
    data = resp.json()
    # Top-level keys must match the defined groups
    for group in ("global", "auth", "tls", "storage", "docker", "compute", "data", "messaging", "security", "analytics", "advanced"):
        assert group in data, f"Missing group '{group}' in config response"


async def test_get_config_viewer_allowed(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.get(f"/api/instances/{instance.id}/config")
    assert resp.status_code == 200


async def test_get_config_unauthenticated(client: AsyncClient, instance: FlociInstance):
    resp = await client.get(f"/api/instances/{instance.id}/config")
    assert resp.status_code == 401


async def test_get_config_instance_not_found(admin_client: AsyncClient):
    resp = await admin_client.get("/api/instances/00000000-0000-0000-0000-000000000000/config")
    assert resp.status_code == 404


async def test_get_config_includes_default_region(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/config")
    assert resp.status_code == 200
    data = resp.json()
    assert data["global"]["FLOCI_DEFAULT_REGION"] == "us-east-1"


# ── PUT config ────────────────────────────────────────────────────────────────


async def test_put_config_updates_values(admin_client: AsyncClient, instance: FlociInstance):
    payload = {"global": {"FLOCI_DEFAULT_REGION": "eu-west-1"}}
    resp = await admin_client.put(f"/api/instances/{instance.id}/config", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["global"]["FLOCI_DEFAULT_REGION"] == "eu-west-1"


async def test_put_config_persists_across_requests(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"storage": {"FLOCI_STORAGE_MODE": "persistent"}},
    )
    resp = await admin_client.get(f"/api/instances/{instance.id}/config")
    assert resp.json()["storage"]["FLOCI_STORAGE_MODE"] == "persistent"


async def test_put_config_viewer_forbidden(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.put(
        f"/api/instances/{instance.id}/config",
        json={"global": {"FLOCI_DEFAULT_REGION": "eu-west-1"}},
    )
    assert resp.status_code == 403


async def test_put_config_merges_groups(admin_client: AsyncClient, instance: FlociInstance):
    """Updating one group should not wipe other groups."""
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"global": {"FLOCI_DEFAULT_REGION": "ap-southeast-1"}},
    )
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"storage": {"FLOCI_STORAGE_MODE": "persistent"}},
    )
    resp = await admin_client.get(f"/api/instances/{instance.id}/config")
    data = resp.json()
    assert data["global"]["FLOCI_DEFAULT_REGION"] == "ap-southeast-1"
    assert data["storage"]["FLOCI_STORAGE_MODE"] == "persistent"


async def test_put_config_instance_not_found(admin_client: AsyncClient):
    resp = await admin_client.put(
        "/api/instances/00000000-0000-0000-0000-000000000000/config",
        json={"global": {}},
    )
    assert resp.status_code == 404


# ── POST config/reset ─────────────────────────────────────────────────────────


async def test_reset_config_clears_stored_values(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"global": {"FLOCI_DEFAULT_REGION": "eu-central-1"}},
    )
    resp = await admin_client.post(f"/api/instances/{instance.id}/config/reset")
    assert resp.status_code == 200
    # After reset, defaults are restored
    get_resp = await admin_client.get(f"/api/instances/{instance.id}/config")
    assert get_resp.json()["global"]["FLOCI_DEFAULT_REGION"] == "us-east-1"


async def test_reset_config_viewer_forbidden(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.post(f"/api/instances/{instance.id}/config/reset")
    assert resp.status_code == 403


# ── GET config/export ─────────────────────────────────────────────────────────


async def test_export_env_format(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"global": {"FLOCI_DEFAULT_REGION": "us-west-2"}},
    )
    resp = await admin_client.get(f"/api/instances/{instance.id}/config/export?format=env")
    assert resp.status_code == 200
    assert "FLOCI_DEFAULT_REGION=us-west-2" in resp.text


async def test_export_docker_compose_format(admin_client: AsyncClient, instance: FlociInstance):
    await admin_client.put(
        f"/api/instances/{instance.id}/config",
        json={"global": {"FLOCI_DEFAULT_REGION": "us-west-2"}},
    )
    resp = await admin_client.get(
        f"/api/instances/{instance.id}/config/export?format=docker-compose"
    )
    assert resp.status_code == 200
    assert "FLOCI_DEFAULT_REGION: us-west-2" in resp.text


async def test_export_json_format(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/config/export?format=json")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "FLOCI_DEFAULT_REGION" in data


async def test_export_invalid_format(admin_client: AsyncClient, instance: FlociInstance):
    resp = await admin_client.get(f"/api/instances/{instance.id}/config/export?format=xml")
    assert resp.status_code == 400


async def test_export_viewer_allowed(viewer_client: AsyncClient, instance: FlociInstance):
    resp = await viewer_client.get(f"/api/instances/{instance.id}/config/export?format=json")
    assert resp.status_code == 200
