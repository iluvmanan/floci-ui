from functools import lru_cache
from uuid import UUID

import boto3
import botocore.config

from app.core.security import decrypt_secret


_session_cache: dict[str, boto3.Session] = {}


def get_boto3_session(
    instance_id: UUID,
    endpoint: str,
    region: str,
    access_key: str,
    secret_key_encrypted: str,
) -> boto3.Session:
    key = str(instance_id)
    if key not in _session_cache:
        secret_key = decrypt_secret(secret_key_encrypted)
        session = boto3.Session(
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        _session_cache[key] = session
    return _session_cache[key]


def invalidate_session(instance_id: UUID) -> None:
    _session_cache.pop(str(instance_id), None)


def get_client(
    instance_id: UUID,
    service_name: str,
    endpoint: str,
    region: str,
    access_key: str,
    secret_key_encrypted: str,
    tls_verify: bool = False,
):
    session = get_boto3_session(instance_id, endpoint, region, access_key, secret_key_encrypted)
    return session.client(
        service_name,
        endpoint_url=endpoint,
        verify=tls_verify,
        config=botocore.config.Config(
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 1},
        ),
    )
