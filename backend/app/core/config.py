from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    environment: str = "development"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://floci:floci_secret@localhost:5432/floci_console"

    # Auth
    jwt_secret: str = "dev-jwt-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Encryption (for Floci instance secret_key at rest)
    encryption_key: str = "dev-encryption-key-32-chars-long!"

    # CORS
    backend_cors_origins: list[str] = ["http://localhost:3000"]

    # First superadmin seeding
    first_superadmin_email: str = "admin@example.com"
    first_superadmin_password: str = "changeme123"

    # Rate limiting
    rate_limit_login: str = "10/minute"


settings = Settings()
