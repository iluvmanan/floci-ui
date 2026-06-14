"""RBAC role hierarchy tests — verifies that role boundaries are enforced."""
import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import User, UserRole


@pytest.fixture
async def users(db):
    roles = {
        "superadmin": UserRole.SUPERADMIN,
        "admin": UserRole.ADMIN,
        "operator": UserRole.OPERATOR,
        "viewer": UserRole.VIEWER,
    }
    created = {}
    for name, role in roles.items():
        u = User(
            email=f"{name}@rbac.test",
            hashed_password=hash_password(f"{name}-pw"),
            role=role,
        )
        db.add(u)
        created[name] = u
    await db.commit()
    return created


async def logged_in(client: AsyncClient, role: str) -> AsyncClient:
    await client.post("/api/auth/login", json={"email": f"{role}@rbac.test", "password": f"{role}-pw"})
    return client


# ─── Viewer-level access ──────────────────────────────────────────────────────

async def test_viewer_can_access_own_profile(client: AsyncClient, users):
    c = await logged_in(client, "viewer")
    resp = await c.get("/api/auth/me")
    assert resp.status_code == 200


async def test_viewer_cannot_list_users(client: AsyncClient, users):
    c = await logged_in(client, "viewer")
    resp = await c.get("/api/users")
    assert resp.status_code == 403


async def test_viewer_cannot_create_user(client: AsyncClient, users):
    c = await logged_in(client, "viewer")
    resp = await c.post("/api/users", json={"email": "x@x.com", "role": "viewer", "password": "pw"})
    assert resp.status_code == 403


# ─── Operator-level access ────────────────────────────────────────────────────

async def test_operator_can_access_own_profile(client: AsyncClient, users):
    c = await logged_in(client, "operator")
    resp = await c.get("/api/auth/me")
    assert resp.status_code == 200


async def test_operator_cannot_list_users(client: AsyncClient, users):
    c = await logged_in(client, "operator")
    resp = await c.get("/api/users")
    assert resp.status_code == 403


# ─── Admin-level access ───────────────────────────────────────────────────────

async def test_admin_can_list_users(client: AsyncClient, users):
    c = await logged_in(client, "admin")
    resp = await c.get("/api/users")
    assert resp.status_code == 200


async def test_admin_can_create_users(client: AsyncClient, users):
    c = await logged_in(client, "admin")
    resp = await c.post("/api/users", json={"email": "new@test.com", "role": "viewer", "password": "pw"})
    assert resp.status_code == 201


async def test_admin_cannot_delete_users(client: AsyncClient, users):
    c = await logged_in(client, "admin")
    viewer = users["viewer"]
    resp = await c.delete(f"/api/users/{viewer.id}")
    assert resp.status_code == 403


# ─── Superadmin-level access ──────────────────────────────────────────────────

async def test_superadmin_can_list_users(client: AsyncClient, users):
    c = await logged_in(client, "superadmin")
    resp = await c.get("/api/users")
    assert resp.status_code == 200


async def test_superadmin_can_delete_users(client: AsyncClient, users):
    c = await logged_in(client, "superadmin")
    viewer = users["viewer"]
    resp = await c.delete(f"/api/users/{viewer.id}")
    assert resp.status_code == 204


# ─── Token validation ─────────────────────────────────────────────────────────

async def test_tampered_access_token_returns_401(client: AsyncClient):
    client.cookies.set("access_token", "not.a.valid.jwt")
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_missing_token_returns_401(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401
