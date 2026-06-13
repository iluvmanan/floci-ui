from datetime import UTC, datetime, timedelta

from cryptography.fernet import Fernet
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    return jwt.encode(
        {"sub": subject, "role": role, "exp": expire, "type": "access"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    return jwt.encode(
        {"sub": subject, "exp": expire, "type": "refresh"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError("Invalid token") from e


_fernet = Fernet(settings.encryption_key.encode() if len(settings.encryption_key) < 44 else settings.encryption_key.encode())


def encrypt_secret(value: str) -> str:
    return Fernet(settings.encryption_key.encode()).encrypt(value.encode()).decode()


def decrypt_secret(encrypted: str) -> str:
    return Fernet(settings.encryption_key.encode()).decrypt(encrypted.encode()).decode()
