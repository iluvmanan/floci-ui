import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import User, UserRole


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
async def superadmin(db):
    user = User(
        email="superadmin@test.com",
        hashed_password=hash_password("super-password"),
        full_name="Super Admin",
        role=UserRole.SUPERADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def admin(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("admin-password"),
        full_name="Admin",
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def viewer(db):
    user = User(
        email="viewer@test.com",
        hashed_password=hash_password("viewer-password"),
        full_name="Viewer",
        role=UserRole.VIEWER,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def superadmin_client(client: AsyncClient, superadmin):
    await client.post("/api/auth/login", json={"email": "superadmin@test.com", "password": "super-password"})
    return client


@pytest.fixture
async def admin_client(client: AsyncClient, admin):
    await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin-password"})
    return client


@pytest.fixture
async def viewer_client(client: AsyncClient, viewer):
    await client.post("/api/auth/login", json={"email": "viewer@test.com", "password": "viewer-password"})
    return client


# ─── List users (GET /api/users) ─────────────────────────────────────────────

async def test_admin_can_list_users(admin_client: AsyncClient, viewer):
    resp = await admin_client.get("/api/users")
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert body["total"] >= 1


async def test_viewer_cannot_list_users(viewer_client: AsyncClient):
    resp = await viewer_client.get("/api/users")
    assert resp.status_code == 403


async def test_unauthenticated_cannot_list_users(client: AsyncClient):
    resp = await client.get("/api/users")
    assert resp.status_code == 401


async def test_list_users_pagination(admin_client: AsyncClient, db):
    # Create 5 extra users
    for i in range(5):
        db.add(User(
            email=f"extra{i}@test.com",
            hashed_password=hash_password("pw"),
            role=UserRole.VIEWER,
        ))
    await db.commit()

    resp = await admin_client.get("/api/users?limit=3&page=1")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["items"]) == 3
    assert body["pages"] >= 2


# ─── Create user (POST /api/users) ───────────────────────────────────────────

async def test_admin_can_create_user(admin_client: AsyncClient):
    resp = await admin_client.post("/api/users", json={
        "email": "newuser@test.com",
        "full_name": "New User",
        "role": "operator",
        "password": "secure-password",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "newuser@test.com"
    assert body["role"] == "operator"
    assert "id" in body
    assert "hashed_password" not in body  # must never leak hash


async def test_viewer_cannot_create_user(viewer_client: AsyncClient):
    resp = await viewer_client.post("/api/users", json={
        "email": "new@test.com", "role": "viewer", "password": "pw"
    })
    assert resp.status_code == 403


async def test_create_user_with_duplicate_email_returns_409(admin_client: AsyncClient, viewer):
    resp = await admin_client.post("/api/users", json={
        "email": "viewer@test.com",  # already exists
        "role": "viewer",
        "password": "pw",
    })
    assert resp.status_code == 409


async def test_created_user_can_log_in(admin_client: AsyncClient, client: AsyncClient):
    await admin_client.post("/api/users", json={
        "email": "created@test.com",
        "role": "operator",
        "password": "their-password",
    })
    resp = await client.post("/api/auth/login", json={"email": "created@test.com", "password": "their-password"})
    assert resp.status_code == 200


# ─── Update user (PUT /api/users/{id}) ───────────────────────────────────────

async def test_admin_can_update_user_role(admin_client: AsyncClient, viewer):
    resp = await admin_client.put(f"/api/users/{viewer.id}", json={"role": "operator"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "operator"


async def test_admin_can_deactivate_user(admin_client: AsyncClient, viewer):
    resp = await admin_client.put(f"/api/users/{viewer.id}", json={"is_active": False})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


async def test_deactivated_user_cannot_log_in(admin_client: AsyncClient, client: AsyncClient, viewer):
    await admin_client.put(f"/api/users/{viewer.id}", json={"is_active": False})
    resp = await client.post("/api/auth/login", json={"email": "viewer@test.com", "password": "viewer-password"})
    assert resp.status_code == 401


async def test_update_nonexistent_user_returns_404(admin_client: AsyncClient):
    import uuid
    resp = await admin_client.put(f"/api/users/{uuid.uuid4()}", json={"role": "viewer"})
    assert resp.status_code == 404


async def test_viewer_cannot_update_user(viewer_client: AsyncClient, viewer):
    resp = await viewer_client.put(f"/api/users/{viewer.id}", json={"full_name": "Hacked"})
    assert resp.status_code == 403


# ─── Delete / deactivate user (DELETE /api/users/{id}) ───────────────────────

async def test_superadmin_can_deactivate_user(superadmin_client: AsyncClient, viewer):
    resp = await superadmin_client.delete(f"/api/users/{viewer.id}")
    assert resp.status_code == 204


async def test_admin_cannot_delete_user(admin_client: AsyncClient, viewer):
    resp = await admin_client.delete(f"/api/users/{viewer.id}")
    assert resp.status_code == 403


async def test_deleted_user_cannot_log_in(superadmin_client: AsyncClient, client: AsyncClient, viewer):
    await superadmin_client.delete(f"/api/users/{viewer.id}")
    resp = await client.post("/api/auth/login", json={"email": "viewer@test.com", "password": "viewer-password"})
    assert resp.status_code == 401
