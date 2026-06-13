import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import User, UserRole


@pytest.fixture
async def admin_user(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.SUPERADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def test_first_run_true(client: AsyncClient):
    resp = await client.get("/api/auth/first-run")
    assert resp.status_code == 200
    assert resp.json()["is_first_run"] is True


async def test_login_success(client: AsyncClient, admin_user):
    resp = await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "password123"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@test.com"
    assert "access_token" in resp.cookies


async def test_login_wrong_password(client: AsyncClient, admin_user):
    resp = await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "wrong"})
    assert resp.status_code == 401


async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_with_auth(client: AsyncClient, admin_user):
    login_resp = await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "password123"})
    assert login_resp.status_code == 200

    me_resp = await client.get("/api/auth/me")
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "admin@test.com"
