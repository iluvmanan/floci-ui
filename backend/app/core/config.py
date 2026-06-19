from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    environment: str = "development"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://floci:floci_secret@localhost:5432/floci_console"

    # Auth — required; provided via env (docker-compose) or .env. No insecure default.
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Encryption (for Floci instance secret_key at rest) — required; provided via env.
    # Must be a valid Fernet key (44-char base64). Generate: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    encryption_key: str

    # Union allows pydantic-settings to skip JSON parsing when the value is a plain string,
    # then the validator normalises it to list[str] in all cases.
    backend_cors_origins: list[str] | str = ["http://localhost:3000", "http://localhost:3002"]

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def _parse_cors(cls, v: object) -> list[str]:
        if isinstance(v, list):
            return [str(i) for i in v]
        if isinstance(v, str):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v  # type: ignore[return-value]

    # First superadmin seeding
    first_superadmin_email: str = "admin@example.com"
    first_superadmin_password: str = "changeme123"

    # Rate limiting
    rate_limit_login: str = "10/minute"


settings = Settings()
