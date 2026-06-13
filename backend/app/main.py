import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.routers import auth, instances, system, users
from app.services.auth_service import seed_superadmin
from app.services.instance_service import run_periodic_health_checks


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        await seed_superadmin(
            settings.first_superadmin_email,
            settings.first_superadmin_password,
            db,
        )

    health_task = asyncio.create_task(run_periodic_health_checks(AsyncSessionLocal))

    yield

    health_task.cancel()
    await engine.dispose()


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Floci Management Console API",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(instances.router, prefix="/api")
app.include_router(system.router, prefix="/api")
