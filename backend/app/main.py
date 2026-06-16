import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.middleware.audit import make_audit_middleware
from app.routers import audit, auth, api_keys, config, instances, monitoring, services, system, users
from app.routers.resources import s3, dynamodb, lambda_, sqs, sns, kinesis, eventbridge, cognito, ec2, iam, apigw, apigwv2, rds, elasticache
from app.services.auth_service import seed_superadmin
from app.services.instance_service import run_periodic_health_checks

# Ensure all models are registered with Base.metadata before create_all
import app.models.audit  # noqa: F401
import app.models.api_key  # noqa: F401


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
app.state.db_factory = AsyncSessionLocal
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.backend_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Audit middleware — must wrap after CORS so it sees real paths
@app.middleware("http")
async def _audit(request: Request, call_next):
    return await make_audit_middleware()(request, call_next)


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(instances.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(s3.router, prefix="/api")
app.include_router(dynamodb.router, prefix="/api")
app.include_router(lambda_.router, prefix="/api")
app.include_router(sqs.router, prefix="/api")
app.include_router(sns.router, prefix="/api")
app.include_router(kinesis.router, prefix="/api")
app.include_router(eventbridge.router, prefix="/api")
app.include_router(cognito.router, prefix="/api")
app.include_router(ec2.router, prefix="/api")
app.include_router(iam.router, prefix="/api")
app.include_router(apigw.router, prefix="/api")
app.include_router(apigwv2.router, prefix="/api")
app.include_router(rds.router, prefix="/api")
app.include_router(elasticache.router, prefix="/api")
app.include_router(monitoring.router, prefix="/api")
app.include_router(audit.router, prefix="/api")
app.include_router(api_keys.router, prefix="/api")
app.include_router(system.router, prefix="/api")
