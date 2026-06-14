"""Config schema: all Floci env vars grouped by category with defaults."""
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ConfigVar:
    key: str
    group: str
    default: Any
    description: str
    type: str = "str"  # bool, int, str, enum, port-range, tag-list


# ── All known Floci config vars with defaults ──────────────────────────────────

CONFIG_VARS: list[ConfigVar] = [
    # Global
    ConfigVar("FLOCI_BASE_URL", "global", "http://localhost:4566", "Base URL for Floci endpoint"),
    ConfigVar("FLOCI_HOSTNAME", "global", "localhost", "Hostname for Floci"),
    ConfigVar("FLOCI_DEFAULT_REGION", "global", "us-east-1", "Default AWS region"),
    ConfigVar("FLOCI_DEFAULT_ACCOUNT_ID", "global", "000000000000", "Default AWS account ID"),
    ConfigVar("FLOCI_DEFAULT_AVAILABILITY_ZONE", "global", "us-east-1a", "Default availability zone"),
    ConfigVar("FLOCI_MAX_REQUEST_SIZE", "global", "67108864", "Max request size in bytes", "int"),
    ConfigVar("FLOCI_ECR_BASE_URI", "global", "localhost.localstack.cloud:4511", "ECR base URI"),
    # Auth
    ConfigVar("FLOCI_AUTH_VALIDATE_SIGNATURES", "auth", False, "Validate AWS request signatures", "bool"),
    ConfigVar("FLOCI_AUTH_PRESIGN_SECRET", "auth", "", "Secret for presigned URL validation"),
    ConfigVar("FLOCI_SECURITY_EXTRA_CORS_ALLOWED_ORIGINS", "auth", "", "Extra CORS allowed origins (comma-separated)", "tag-list"),
    ConfigVar("FLOCI_SECURITY_EXTRA_CORS_ALLOWED_HEADERS", "auth", "", "Extra CORS allowed headers (comma-separated)", "tag-list"),
    ConfigVar("FLOCI_SECURITY_EXTRA_CORS_EXPOSE_HEADERS", "auth", "", "Extra CORS exposed headers (comma-separated)", "tag-list"),
    ConfigVar("FLOCI_SECURITY_DISABLE_CORS_HEADERS", "auth", False, "Disable CORS headers entirely", "bool"),
    ConfigVar("FLOCI_DNS_EXTRA_SUFFIXES", "auth", "", "Extra DNS suffixes (comma-separated)", "tag-list"),
    # TLS
    ConfigVar("FLOCI_TLS_ENABLED", "tls", False, "Enable TLS for Floci endpoint", "bool"),
    ConfigVar("FLOCI_TLS_CERT_PATH", "tls", "", "Path to TLS certificate file"),
    ConfigVar("FLOCI_TLS_KEY_PATH", "tls", "", "Path to TLS private key file"),
    ConfigVar("FLOCI_TLS_SELF_SIGNED", "tls", False, "Use self-signed TLS certificate", "bool"),
    # Storage
    ConfigVar("FLOCI_STORAGE_MODE", "storage", "memory", "Storage mode", "enum"),
    ConfigVar("FLOCI_STORAGE_PERSISTENT_PATH", "storage", "/var/lib/localstack", "Path for persistent storage"),
    ConfigVar("FLOCI_STORAGE_HOST_PERSISTENT_PATH", "storage", "", "Host path for persistent storage (Docker bind mount)"),
    ConfigVar("FLOCI_STORAGE_PRUNE_VOLUMES_ON_DELETE", "storage", False, "Prune Docker volumes on resource deletion", "bool"),
    ConfigVar("FLOCI_STORAGE_WAL_COMPACTION_INTERVAL_MS", "storage", "30000", "WAL compaction interval in milliseconds", "int"),
    # Docker
    ConfigVar("FLOCI_DOCKER_DOCKER_HOST", "docker", "unix:///var/run/docker.sock", "Docker host socket"),
    ConfigVar("FLOCI_DOCKER_DOCKER_CONFIG_PATH", "docker", "", "Path to Docker config directory"),
    ConfigVar("FLOCI_DOCKER_LOG_MAX_SIZE", "docker", "10m", "Max Docker log size per container"),
    ConfigVar("FLOCI_DOCKER_LOG_MAX_FILE", "docker", "3", "Max Docker log files per container", "int"),
    # Init hooks
    ConfigVar("FLOCI_INIT_HOOKS_SHELL_EXECUTABLE", "advanced", "/bin/bash", "Shell executable for init hooks"),
    ConfigVar("FLOCI_INIT_HOOKS_TIMEOUT_SECONDS", "advanced", "30", "Init hook timeout in seconds", "int"),
    ConfigVar("FLOCI_INIT_HOOKS_SHUTDOWN_GRACE_PERIOD_SECONDS", "advanced", "10", "Shutdown grace period for hooks", "int"),
    # Compute: Lambda
    ConfigVar("FLOCI_LAMBDA_ENABLED", "compute", True, "Enable Lambda service", "bool"),
    ConfigVar("FLOCI_LAMBDA_MEMORY_MB", "compute", "128", "Default Lambda memory in MB", "int"),
    ConfigVar("FLOCI_LAMBDA_TIMEOUT_SECONDS", "compute", "3", "Default Lambda timeout in seconds", "int"),
    ConfigVar("FLOCI_LAMBDA_HOT_RELOADING", "compute", False, "Enable Lambda hot-reload mode", "bool"),
    ConfigVar("FLOCI_LAMBDA_MAX_CONCURRENCY", "compute", "10", "Max concurrent Lambda executions", "int"),
    ConfigVar("FLOCI_LAMBDA_PORT_RANGE_START", "compute", "19000", "Lambda port range start", "int"),
    ConfigVar("FLOCI_LAMBDA_PORT_RANGE_END", "compute", "20000", "Lambda port range end", "int"),
    # Compute: ECS
    ConfigVar("FLOCI_ECS_ENABLED", "compute", True, "Enable ECS service", "bool"),
    ConfigVar("FLOCI_ECS_TASK_MEMORY_MB", "compute", "512", "Default ECS task memory in MB", "int"),
    ConfigVar("FLOCI_ECS_TASK_CPU", "compute", "256", "Default ECS task CPU units", "int"),
    ConfigVar("FLOCI_ECS_MOCK_MODE", "compute", False, "Enable ECS mock mode (no Docker)", "bool"),
    ConfigVar("FLOCI_ECS_DOCKER_NETWORK", "compute", "", "Docker network for ECS tasks"),
    # Compute: EC2
    ConfigVar("FLOCI_EC2_ENABLED", "compute", True, "Enable EC2 service", "bool"),
    ConfigVar("FLOCI_EC2_MOCK_MODE", "compute", True, "Enable EC2 mock mode", "bool"),
    ConfigVar("FLOCI_EC2_IMDS_PORT", "compute", "1338", "IMDS (metadata service) port", "int"),
    # Compute: EKS
    ConfigVar("FLOCI_EKS_ENABLED", "compute", True, "Enable EKS service", "bool"),
    ConfigVar("FLOCI_EKS_MOCK_MODE", "compute", True, "Enable EKS mock mode", "bool"),
    # Data: S3
    ConfigVar("FLOCI_S3_ENABLED", "data", True, "Enable S3 service", "bool"),
    ConfigVar("FLOCI_S3_PRESIGN_EXPIRY_SECONDS", "data", "3600", "Default presigned URL expiry in seconds", "int"),
    # Data: DynamoDB
    ConfigVar("FLOCI_DYNAMODB_ENABLED", "data", True, "Enable DynamoDB service", "bool"),
    # Data: RDS
    ConfigVar("FLOCI_RDS_ENABLED", "data", True, "Enable RDS service", "bool"),
    ConfigVar("FLOCI_RDS_POSTGRES_IMAGE", "data", "postgres:16", "Docker image for RDS PostgreSQL"),
    ConfigVar("FLOCI_RDS_MYSQL_IMAGE", "data", "mysql:8", "Docker image for RDS MySQL"),
    ConfigVar("FLOCI_RDS_MARIADB_IMAGE", "data", "mariadb:11", "Docker image for RDS MariaDB"),
    ConfigVar("FLOCI_RDS_PROXY_PORT_RANGE_START", "data", "54510", "RDS proxy port range start", "int"),
    ConfigVar("FLOCI_RDS_PROXY_PORT_RANGE_END", "data", "54560", "RDS proxy port range end", "int"),
    # Data: ElastiCache
    ConfigVar("FLOCI_ELASTICACHE_ENABLED", "data", True, "Enable ElastiCache service", "bool"),
    ConfigVar("FLOCI_ELASTICACHE_IMAGE", "data", "valkey/valkey:7", "Docker image for ElastiCache"),
    ConfigVar("FLOCI_ELASTICACHE_PROXY_PORT_RANGE_START", "data", "55000", "ElastiCache proxy port range start", "int"),
    ConfigVar("FLOCI_ELASTICACHE_PROXY_PORT_RANGE_END", "data", "55100", "ElastiCache proxy port range end", "int"),
    # Data: MSK / Kafka
    ConfigVar("FLOCI_MSK_ENABLED", "data", True, "Enable MSK (Kafka) service", "bool"),
    ConfigVar("FLOCI_MSK_MOCK_MODE", "data", False, "Enable MSK mock mode (no Redpanda)", "bool"),
    ConfigVar("FLOCI_MSK_IMAGE", "data", "vectorized/redpanda:latest", "Docker image for MSK"),
    # Data: OpenSearch
    ConfigVar("FLOCI_OPENSEARCH_ENABLED", "data", True, "Enable OpenSearch service", "bool"),
    ConfigVar("FLOCI_OPENSEARCH_MOCK_MODE", "data", True, "Enable OpenSearch mock mode", "bool"),
    ConfigVar("FLOCI_OPENSEARCH_IMAGE", "data", "opensearchproject/opensearch:2", "Docker image for OpenSearch"),
    ConfigVar("FLOCI_OPENSEARCH_PROXY_PORT_RANGE_START", "data", "57000", "OpenSearch proxy port range start", "int"),
    ConfigVar("FLOCI_OPENSEARCH_PROXY_PORT_RANGE_END", "data", "58000", "OpenSearch proxy port range end", "int"),
    # Messaging: SQS
    ConfigVar("FLOCI_SQS_ENABLED", "messaging", True, "Enable SQS service", "bool"),
    ConfigVar("FLOCI_SQS_VISIBILITY_TIMEOUT", "messaging", "30", "Default SQS visibility timeout in seconds", "int"),
    ConfigVar("FLOCI_SQS_MAX_MESSAGE_SIZE", "messaging", "262144", "Max SQS message size in bytes", "int"),
    ConfigVar("FLOCI_SQS_FIFO_DEDUP_INTERVAL", "messaging", "300", "FIFO deduplication interval in seconds", "int"),
    # Messaging: SNS
    ConfigVar("FLOCI_SNS_ENABLED", "messaging", True, "Enable SNS service", "bool"),
    # Messaging: EventBridge
    ConfigVar("FLOCI_EVENTS_ENABLED", "messaging", True, "Enable EventBridge service", "bool"),
    ConfigVar("FLOCI_PIPES_ENABLED", "messaging", True, "Enable EventBridge Pipes service", "bool"),
    ConfigVar("FLOCI_SCHEDULER_ENABLED", "messaging", True, "Enable EventBridge Scheduler service", "bool"),
    ConfigVar("FLOCI_SCHEDULER_TICK_INTERVAL_MS", "messaging", "1000", "EventBridge Scheduler tick interval in ms", "int"),
    # Messaging: Kinesis
    ConfigVar("FLOCI_KINESIS_ENABLED", "messaging", True, "Enable Kinesis service", "bool"),
    # Security: SSM
    ConfigVar("FLOCI_SSM_ENABLED", "security", True, "Enable SSM Parameter Store service", "bool"),
    ConfigVar("FLOCI_SSM_MAX_PARAMETER_HISTORY", "security", "100", "Max parameter history versions", "int"),
    # Security: Secrets Manager
    ConfigVar("FLOCI_SECRETSMANAGER_ENABLED", "security", True, "Enable Secrets Manager service", "bool"),
    ConfigVar("FLOCI_SECRETSMANAGER_RECOVERY_WINDOW_DAYS", "security", "30", "Secret recovery window in days", "int"),
    # Security: ACM
    ConfigVar("FLOCI_ACM_ENABLED", "security", True, "Enable ACM service", "bool"),
    ConfigVar("FLOCI_ACM_VALIDATION_WAIT_SECONDS", "security", "1", "ACM certificate validation wait time in seconds", "int"),
    # Security: KMS
    ConfigVar("FLOCI_KMS_ENABLED", "security", True, "Enable KMS service", "bool"),
    # Security: IAM
    ConfigVar("FLOCI_IAM_ENABLED", "security", True, "Enable IAM service", "bool"),
    ConfigVar("FLOCI_IAM_ENFORCE_POLICIES", "security", False, "Enable strict IAM policy enforcement", "bool"),
    # Security: Cognito
    ConfigVar("FLOCI_COGNITO_ENABLED", "security", True, "Enable Cognito service", "bool"),
    # Security: AppConfig
    ConfigVar("FLOCI_APPCONFIG_ENABLED", "security", True, "Enable AppConfig service", "bool"),
    # Analytics: Athena
    ConfigVar("FLOCI_ATHENA_ENABLED", "analytics", True, "Enable Athena service", "bool"),
    ConfigVar("FLOCI_ATHENA_MOCK_MODE", "analytics", True, "Enable Athena mock mode (no DuckDB)", "bool"),
    ConfigVar("FLOCI_ATHENA_DUCKDB_IMAGE", "analytics", "motherduck/duckdb:latest", "Docker image for Athena DuckDB"),
    # Analytics: Glue
    ConfigVar("FLOCI_GLUE_ENABLED", "analytics", True, "Enable Glue service", "bool"),
    # Analytics: CloudWatch
    ConfigVar("FLOCI_LOGS_ENABLED", "analytics", True, "Enable CloudWatch Logs service", "bool"),
    ConfigVar("FLOCI_LOGS_MAX_EVENTS_PER_QUERY", "analytics", "10000", "Max log events returned per query", "int"),
    ConfigVar("FLOCI_METRICS_ENABLED", "analytics", True, "Enable CloudWatch Metrics service", "bool"),
]

# Build lookup maps
_BY_KEY: dict[str, ConfigVar] = {v.key: v for v in CONFIG_VARS}
_GROUPS: list[str] = ["global", "auth", "tls", "storage", "docker", "compute", "data", "messaging", "security", "analytics", "advanced"]


def get_default_config() -> dict[str, dict[str, Any]]:
    """Return the full default config grouped by category."""
    result: dict[str, dict[str, Any]] = {g: {} for g in _GROUPS}
    for var in CONFIG_VARS:
        result[var.group][var.key] = var.default
    return result


def merge_with_defaults(stored: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Merge stored values over defaults, preserving all groups."""
    defaults = get_default_config()
    for group, values in stored.items():
        if group in defaults:
            defaults[group].update(values)
    return defaults


def flatten_config(grouped: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Flatten grouped config into a single {KEY: value} dict."""
    flat: dict[str, Any] = {}
    for values in grouped.values():
        flat.update(values)
    return flat


def to_env_file(grouped: dict[str, dict[str, Any]]) -> str:
    """Generate KEY=value .env file content from grouped config."""
    lines: list[str] = []
    for group in _GROUPS:
        values = grouped.get(group, {})
        for key, value in values.items():
            if value != "" and value is not None:
                lines.append(f"{key}={value}")
    return "\n".join(lines)


def to_docker_compose_env(grouped: dict[str, dict[str, Any]]) -> str:
    """Generate docker-compose environment: block content."""
    lines = ["environment:"]
    for group in _GROUPS:
        values = grouped.get(group, {})
        for key, value in values.items():
            if value != "" and value is not None:
                lines.append(f"  {key}: {value}")
    return "\n".join(lines)
