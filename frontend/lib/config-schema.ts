export type VarType = "bool" | "int" | "str" | "enum" | "tag-list"

export interface ConfigVar {
  key: string
  type: VarType
  default: boolean | number | string
  description: string
  options?: string[] // for enum type
}

export type ConfigGroup =
  | "global"
  | "auth"
  | "tls"
  | "storage"
  | "docker"
  | "compute"
  | "data"
  | "messaging"
  | "security"
  | "analytics"
  | "advanced"

export const CONFIG_GROUPS: ConfigGroup[] = [
  "global", "auth", "tls", "storage", "docker", "compute",
  "data", "messaging", "security", "analytics", "advanced",
]

export const CONFIG_SCHEMA: Record<ConfigGroup, ConfigVar[]> = {
  global: [
    { key: "FLOCI_BASE_URL", type: "str", default: "http://localhost:4566", description: "Base URL for Floci endpoint" },
    { key: "FLOCI_HOSTNAME", type: "str", default: "localhost", description: "Hostname for Floci" },
    { key: "FLOCI_DEFAULT_REGION", type: "enum", default: "us-east-1", description: "Default AWS region", options: ["us-east-1","us-east-2","us-west-1","us-west-2","eu-west-1","eu-west-2","eu-west-3","eu-central-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","sa-east-1"] },
    { key: "FLOCI_DEFAULT_ACCOUNT_ID", type: "str", default: "000000000000", description: "Default AWS account ID" },
    { key: "FLOCI_DEFAULT_AVAILABILITY_ZONE", type: "str", default: "us-east-1a", description: "Default availability zone" },
    { key: "FLOCI_MAX_REQUEST_SIZE", type: "int", default: 67108864, description: "Max request size in bytes" },
    { key: "FLOCI_ECR_BASE_URI", type: "str", default: "localhost.localstack.cloud:4511", description: "ECR base URI" },
  ],
  auth: [
    { key: "FLOCI_AUTH_VALIDATE_SIGNATURES", type: "bool", default: false, description: "Validate AWS request signatures" },
    { key: "FLOCI_AUTH_PRESIGN_SECRET", type: "str", default: "", description: "Secret for presigned URL validation" },
    { key: "FLOCI_SECURITY_EXTRA_CORS_ALLOWED_ORIGINS", type: "tag-list", default: "", description: "Extra CORS allowed origins (comma-separated)" },
    { key: "FLOCI_SECURITY_EXTRA_CORS_ALLOWED_HEADERS", type: "tag-list", default: "", description: "Extra CORS allowed headers (comma-separated)" },
    { key: "FLOCI_SECURITY_EXTRA_CORS_EXPOSE_HEADERS", type: "tag-list", default: "", description: "Extra CORS exposed headers (comma-separated)" },
    { key: "FLOCI_SECURITY_DISABLE_CORS_HEADERS", type: "bool", default: false, description: "Disable CORS headers entirely" },
    { key: "FLOCI_DNS_EXTRA_SUFFIXES", type: "tag-list", default: "", description: "Extra DNS suffixes (comma-separated)" },
  ],
  tls: [
    { key: "FLOCI_TLS_ENABLED", type: "bool", default: false, description: "Enable TLS for Floci endpoint" },
    { key: "FLOCI_TLS_CERT_PATH", type: "str", default: "", description: "Path to TLS certificate file" },
    { key: "FLOCI_TLS_KEY_PATH", type: "str", default: "", description: "Path to TLS private key file" },
    { key: "FLOCI_TLS_SELF_SIGNED", type: "bool", default: false, description: "Use self-signed TLS certificate" },
  ],
  storage: [
    { key: "FLOCI_STORAGE_MODE", type: "enum", default: "memory", description: "Storage mode", options: ["memory", "persistent", "hybrid", "wal"] },
    { key: "FLOCI_STORAGE_PERSISTENT_PATH", type: "str", default: "/var/lib/localstack", description: "Path for persistent storage" },
    { key: "FLOCI_STORAGE_HOST_PERSISTENT_PATH", type: "str", default: "", description: "Host path for persistent storage (Docker bind mount)" },
    { key: "FLOCI_STORAGE_PRUNE_VOLUMES_ON_DELETE", type: "bool", default: false, description: "Prune Docker volumes on resource deletion" },
    { key: "FLOCI_STORAGE_WAL_COMPACTION_INTERVAL_MS", type: "int", default: 30000, description: "WAL compaction interval in milliseconds" },
  ],
  docker: [
    { key: "FLOCI_DOCKER_DOCKER_HOST", type: "str", default: "unix:///var/run/docker.sock", description: "Docker host socket" },
    { key: "FLOCI_DOCKER_DOCKER_CONFIG_PATH", type: "str", default: "", description: "Path to Docker config directory" },
    { key: "FLOCI_DOCKER_LOG_MAX_SIZE", type: "str", default: "10m", description: "Max Docker log size per container" },
    { key: "FLOCI_DOCKER_LOG_MAX_FILE", type: "int", default: 3, description: "Max Docker log files per container" },
  ],
  compute: [
    { key: "FLOCI_LAMBDA_ENABLED", type: "bool", default: true, description: "Enable Lambda service" },
    { key: "FLOCI_LAMBDA_MEMORY_MB", type: "int", default: 128, description: "Default Lambda memory in MB" },
    { key: "FLOCI_LAMBDA_TIMEOUT_SECONDS", type: "int", default: 3, description: "Default Lambda timeout in seconds" },
    { key: "FLOCI_LAMBDA_HOT_RELOADING", type: "bool", default: false, description: "Enable Lambda hot-reload mode" },
    { key: "FLOCI_LAMBDA_MAX_CONCURRENCY", type: "int", default: 10, description: "Max concurrent Lambda executions" },
    { key: "FLOCI_LAMBDA_PORT_RANGE_START", type: "int", default: 19000, description: "Lambda port range start" },
    { key: "FLOCI_LAMBDA_PORT_RANGE_END", type: "int", default: 20000, description: "Lambda port range end" },
    { key: "FLOCI_ECS_ENABLED", type: "bool", default: true, description: "Enable ECS service" },
    { key: "FLOCI_ECS_TASK_MEMORY_MB", type: "int", default: 512, description: "Default ECS task memory in MB" },
    { key: "FLOCI_ECS_TASK_CPU", type: "int", default: 256, description: "Default ECS task CPU units" },
    { key: "FLOCI_ECS_MOCK_MODE", type: "bool", default: false, description: "Enable ECS mock mode (no Docker)" },
    { key: "FLOCI_ECS_DOCKER_NETWORK", type: "str", default: "", description: "Docker network for ECS tasks" },
    { key: "FLOCI_EC2_ENABLED", type: "bool", default: true, description: "Enable EC2 service" },
    { key: "FLOCI_EC2_MOCK_MODE", type: "bool", default: true, description: "Enable EC2 mock mode" },
    { key: "FLOCI_EC2_IMDS_PORT", type: "int", default: 1338, description: "IMDS (metadata service) port" },
    { key: "FLOCI_EKS_ENABLED", type: "bool", default: true, description: "Enable EKS service" },
    { key: "FLOCI_EKS_MOCK_MODE", type: "bool", default: true, description: "Enable EKS mock mode" },
  ],
  data: [
    { key: "FLOCI_S3_ENABLED", type: "bool", default: true, description: "Enable S3 service" },
    { key: "FLOCI_S3_PRESIGN_EXPIRY_SECONDS", type: "int", default: 3600, description: "Default presigned URL expiry in seconds" },
    { key: "FLOCI_DYNAMODB_ENABLED", type: "bool", default: true, description: "Enable DynamoDB service" },
    { key: "FLOCI_RDS_ENABLED", type: "bool", default: true, description: "Enable RDS service" },
    { key: "FLOCI_RDS_POSTGRES_IMAGE", type: "str", default: "postgres:16", description: "Docker image for RDS PostgreSQL" },
    { key: "FLOCI_RDS_MYSQL_IMAGE", type: "str", default: "mysql:8", description: "Docker image for RDS MySQL" },
    { key: "FLOCI_RDS_MARIADB_IMAGE", type: "str", default: "mariadb:11", description: "Docker image for RDS MariaDB" },
    { key: "FLOCI_RDS_PROXY_PORT_RANGE_START", type: "int", default: 54510, description: "RDS proxy port range start" },
    { key: "FLOCI_RDS_PROXY_PORT_RANGE_END", type: "int", default: 54560, description: "RDS proxy port range end" },
    { key: "FLOCI_ELASTICACHE_ENABLED", type: "bool", default: true, description: "Enable ElastiCache service" },
    { key: "FLOCI_ELASTICACHE_IMAGE", type: "str", default: "valkey/valkey:7", description: "Docker image for ElastiCache" },
    { key: "FLOCI_ELASTICACHE_PROXY_PORT_RANGE_START", type: "int", default: 55000, description: "ElastiCache proxy port range start" },
    { key: "FLOCI_ELASTICACHE_PROXY_PORT_RANGE_END", type: "int", default: 55100, description: "ElastiCache proxy port range end" },
    { key: "FLOCI_MSK_ENABLED", type: "bool", default: true, description: "Enable MSK (Kafka) service" },
    { key: "FLOCI_MSK_MOCK_MODE", type: "bool", default: false, description: "Enable MSK mock mode (no Redpanda)" },
    { key: "FLOCI_MSK_IMAGE", type: "str", default: "vectorized/redpanda:latest", description: "Docker image for MSK" },
    { key: "FLOCI_OPENSEARCH_ENABLED", type: "bool", default: true, description: "Enable OpenSearch service" },
    { key: "FLOCI_OPENSEARCH_MOCK_MODE", type: "bool", default: true, description: "Enable OpenSearch mock mode" },
    { key: "FLOCI_OPENSEARCH_IMAGE", type: "str", default: "opensearchproject/opensearch:2", description: "Docker image for OpenSearch" },
    { key: "FLOCI_OPENSEARCH_PROXY_PORT_RANGE_START", type: "int", default: 57000, description: "OpenSearch proxy port range start" },
    { key: "FLOCI_OPENSEARCH_PROXY_PORT_RANGE_END", type: "int", default: 58000, description: "OpenSearch proxy port range end" },
  ],
  messaging: [
    { key: "FLOCI_SQS_ENABLED", type: "bool", default: true, description: "Enable SQS service" },
    { key: "FLOCI_SQS_VISIBILITY_TIMEOUT", type: "int", default: 30, description: "Default SQS visibility timeout in seconds" },
    { key: "FLOCI_SQS_MAX_MESSAGE_SIZE", type: "int", default: 262144, description: "Max SQS message size in bytes" },
    { key: "FLOCI_SQS_FIFO_DEDUP_INTERVAL", type: "int", default: 300, description: "FIFO deduplication interval in seconds" },
    { key: "FLOCI_SNS_ENABLED", type: "bool", default: true, description: "Enable SNS service" },
    { key: "FLOCI_EVENTS_ENABLED", type: "bool", default: true, description: "Enable EventBridge service" },
    { key: "FLOCI_PIPES_ENABLED", type: "bool", default: true, description: "Enable EventBridge Pipes service" },
    { key: "FLOCI_SCHEDULER_ENABLED", type: "bool", default: true, description: "Enable EventBridge Scheduler service" },
    { key: "FLOCI_SCHEDULER_TICK_INTERVAL_MS", type: "int", default: 1000, description: "EventBridge Scheduler tick interval in ms" },
    { key: "FLOCI_KINESIS_ENABLED", type: "bool", default: true, description: "Enable Kinesis service" },
  ],
  security: [
    { key: "FLOCI_SSM_ENABLED", type: "bool", default: true, description: "Enable SSM Parameter Store service" },
    { key: "FLOCI_SSM_MAX_PARAMETER_HISTORY", type: "int", default: 100, description: "Max parameter history versions" },
    { key: "FLOCI_SECRETSMANAGER_ENABLED", type: "bool", default: true, description: "Enable Secrets Manager service" },
    { key: "FLOCI_SECRETSMANAGER_RECOVERY_WINDOW_DAYS", type: "int", default: 30, description: "Secret recovery window in days" },
    { key: "FLOCI_ACM_ENABLED", type: "bool", default: true, description: "Enable ACM service" },
    { key: "FLOCI_ACM_VALIDATION_WAIT_SECONDS", type: "int", default: 1, description: "ACM certificate validation wait time in seconds" },
    { key: "FLOCI_KMS_ENABLED", type: "bool", default: true, description: "Enable KMS service" },
    { key: "FLOCI_IAM_ENABLED", type: "bool", default: true, description: "Enable IAM service" },
    { key: "FLOCI_IAM_ENFORCE_POLICIES", type: "bool", default: false, description: "Enable strict IAM policy enforcement" },
    { key: "FLOCI_COGNITO_ENABLED", type: "bool", default: true, description: "Enable Cognito service" },
    { key: "FLOCI_APPCONFIG_ENABLED", type: "bool", default: true, description: "Enable AppConfig service" },
  ],
  analytics: [
    { key: "FLOCI_ATHENA_ENABLED", type: "bool", default: true, description: "Enable Athena service" },
    { key: "FLOCI_ATHENA_MOCK_MODE", type: "bool", default: true, description: "Enable Athena mock mode (no DuckDB)" },
    { key: "FLOCI_ATHENA_DUCKDB_IMAGE", type: "str", default: "motherduck/duckdb:latest", description: "Docker image for Athena DuckDB" },
    { key: "FLOCI_GLUE_ENABLED", type: "bool", default: true, description: "Enable Glue service" },
    { key: "FLOCI_LOGS_ENABLED", type: "bool", default: true, description: "Enable CloudWatch Logs service" },
    { key: "FLOCI_LOGS_MAX_EVENTS_PER_QUERY", type: "int", default: 10000, description: "Max log events returned per query" },
    { key: "FLOCI_METRICS_ENABLED", type: "bool", default: true, description: "Enable CloudWatch Metrics service" },
  ],
  advanced: [
    { key: "FLOCI_INIT_HOOKS_SHELL_EXECUTABLE", type: "str", default: "/bin/bash", description: "Shell executable for init hooks" },
    { key: "FLOCI_INIT_HOOKS_TIMEOUT_SECONDS", type: "int", default: 30, description: "Init hook timeout in seconds" },
    { key: "FLOCI_INIT_HOOKS_SHUTDOWN_GRACE_PERIOD_SECONDS", type: "int", default: 10, description: "Shutdown grace period for hooks" },
  ],
}
