import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.models.user import User, UserRole


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
async def active_user(db):
    user = User(
        email="user@test.com",
        hashed_password=hash_password("correct-password"),
        full_name="Test User",
        role=UserRole.VIEWER,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def admin_user(db):
    user = User(
        email="admin@test.com",
        hashed_password=hash_password("admin-password"),
        full_name="Admin User",
        role=UserRole.SUPERADMIN,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def inactive_user(db):
    user = User(
        email="inactive@test.com",
        hashed_password=hash_password("password123"),
        role=UserRole.VIEWER,
        is_active=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.fixture
async def auth_client(client: AsyncClient, active_user):
    """Client with viewer role pre-authenticated."""
    await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    return client


@pytest.fixture
async def admin_client(client: AsyncClient, admin_user):
    """Client with superadmin role pre-authenticated."""
    await client.post("/api/auth/login", json={"email": "admin@test.com", "password": "admin-password"})
    return client


# ─── First-run check ──────────────────────────────────────────────────────────

async def test_first_run_returns_true_when_no_users(client: AsyncClient):
    resp = await client.get("/api/auth/first-run")
    assert resp.status_code == 200
    assert resp.json()["is_first_run"] is True


async def test_first_run_returns_false_after_user_created(client: AsyncClient, active_user):
    resp = await client.get("/api/auth/first-run")
    assert resp.status_code == 200
    assert resp.json()["is_first_run"] is False


# ─── Login ───────────────────────────────────────────────────────────────────

async def test_login_with_correct_credentials_returns_user(client: AsyncClient, active_user):
    resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "user@test.com"
    assert body["role"] == "viewer"
    assert "id" in body


async def test_login_sets_httponly_cookies(client: AsyncClient, active_user):
    resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    assert resp.status_code == 200
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies


async def test_login_with_wrong_password_returns_401(client: AsyncClient, active_user):
    resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "wrong-password"})
    assert resp.status_code == 401


async def test_login_with_unknown_email_returns_401(client: AsyncClient):
    resp = await client.post("/api/auth/login", json={"email": "nobody@test.com", "password": "anything"})
    assert resp.status_code == 401


async def test_login_with_inactive_user_returns_401(client: AsyncClient, inactive_user):
    resp = await client.post("/api/auth/login", json={"email": "inactive@test.com", "password": "password123"})
    assert resp.status_code == 401


# ─── Logout ──────────────────────────────────────────────────────────────────

async def test_logout_clears_cookies(auth_client: AsyncClient):
    resp = await auth_client.post("/api/auth/logout")
    assert resp.status_code == 200
    # After logout cookies should be cleared (set to empty or removed)
    assert resp.cookies.get("access_token", "") in ("", None) or "access_token" not in resp.cookies


async def test_me_returns_401_after_logout(auth_client: AsyncClient):
    await auth_client.post("/api/auth/logout")
    # Clear cookies on client side too
    auth_client.cookies.clear()
    resp = await auth_client.get("/api/auth/me")
    assert resp.status_code == 401


# ─── /me ─────────────────────────────────────────────────────────────────────

async def test_me_requires_authentication(client: AsyncClient):
    resp = await client.get("/api/auth/me")
    assert resp.status_code == 401


async def test_me_returns_current_user_profile(auth_client: AsyncClient, active_user):
    resp = await auth_client.get("/api/auth/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "user@test.com"
    assert body["full_name"] == "Test User"
    assert body["role"] == "viewer"
    assert body["is_active"] is True


# ─── Token refresh ────────────────────────────────────────────────────────────

async def test_refresh_issues_new_access_token(client: AsyncClient, active_user):
    login_resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    original_access = login_resp.cookies["access_token"]

    refresh_resp = await client.post("/api/auth/refresh")
    assert refresh_resp.status_code == 200
    new_access = refresh_resp.cookies.get("access_token")
    # Should issue a new token (different from original)
    assert new_access is not None
    assert new_access != original_access


async def test_refresh_without_refresh_cookie_returns_401(client: AsyncClient):
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 401


async def test_using_access_token_as_refresh_returns_401(client: AsyncClient, active_user):
    login_resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    access_token = login_resp.cookies["access_token"]

    # Manually set access_token as the refresh_token cookie
    client.cookies.set("refresh_token", access_token)
    client.cookies.delete("access_token")  # clear actual access token

    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 401


# ─── Change password ─────────────────────────────────────────────────────────

async def test_change_password_with_correct_current_password(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "correct-password", "new_password": "new-secure-password"},
    )
    assert resp.status_code == 200


async def test_new_password_works_after_change(auth_client: AsyncClient, client: AsyncClient):
    await auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "correct-password", "new_password": "new-secure-password"},
    )
    # Log in with new password
    resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "new-secure-password"})
    assert resp.status_code == 200


async def test_old_password_fails_after_change(auth_client: AsyncClient, client: AsyncClient):
    await auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "correct-password", "new_password": "new-secure-password"},
    )
    resp = await client.post("/api/auth/login", json={"email": "user@test.com", "password": "correct-password"})
    assert resp.status_code == 401


async def test_change_password_with_wrong_current_returns_400(auth_client: AsyncClient):
    resp = await auth_client.post(
        "/api/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "new-secure-password"},
    )
    assert resp.status_code == 400


async def test_change_password_requires_authentication(client: AsyncClient):
    resp = await client.post(
        "/api/auth/change-password",
        json={"current_password": "any", "new_password": "any"},
    )
    assert resp.status_code == 401
