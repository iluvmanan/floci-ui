import asyncio

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import NullPool, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.main import app

TEST_DATABASE_URL = "postgresql+asyncpg://floci:floci_secret@localhost:5433/floci_console_test"


def _run_sync(coro):
    """Run a coroutine in a fresh event loop (for session-scoped sync fixtures)."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once before any tests using a throwaway event loop."""
    async def _setup():
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        await engine.dispose()

    async def _teardown():
        engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        await engine.dispose()

    _run_sync(_setup())
    yield
    _run_sync(_teardown())


@pytest.fixture(autouse=True)
async def truncate_tables(create_tables):
    """Truncate all rows before each test using a fresh connection."""
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f'TRUNCATE TABLE "{table.name}" RESTART IDENTITY CASCADE'))
    await engine.dispose()


@pytest.fixture
async def db():
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with SessionLocal() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def client(db):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    # Let the audit middleware use the test DB session factory
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    test_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    app.state.db_factory = test_factory

    from unittest.mock import AsyncMock, patch

    with patch("app.services.instance_service.run_periodic_health_checks", new=AsyncMock()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    app.dependency_overrides.clear()
    await engine.dispose()
