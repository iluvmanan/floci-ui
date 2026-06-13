# Feature 03: Configuration Manager

## Overview
View and edit all ~150 Floci environment variables through a typed UI. Changes are stored as JSONB on the instance record. Supports export as `.env`, `docker-compose environment:` block, or JSON.

## Acceptance Criteria
- [ ] All 150+ env vars are displayed with correct input types (switch, select, number, text, port-range, tag-list)
- [ ] Each field shows its description and default value in a tooltip
- [ ] Config is grouped into tabs: Global | Auth | TLS | Storage | Docker | Compute | Data | Messaging | Security | Analytics | Advanced
- [ ] Unsaved changes tracked (dirty state), "Save Changes" button disabled if no changes
- [ ] "Reset to Defaults" clears stored config and reverts to schema defaults
- [ ] Search bar filters across all config key names
- [ ] Export modal with three formats: `.env`, `docker-compose.yml snippet`, `JSON`
- [ ] Export download works as file download in browser

## API Contracts
```
GET  /api/instances/{id}/config              → { global: {...}, auth: {...}, storage: {...}, ... }
PUT  /api/instances/{id}/config              { partial config updates } (admin+)
POST /api/instances/{id}/config/reset        → resets to defaults (admin+)
GET  /api/instances/{id}/config/export       ?format=env|docker-compose|json
                                             → text/plain or application/json
```

## Config Groups & Key Env Vars

### Global (7 vars)
`FLOCI_BASE_URL`, `FLOCI_HOSTNAME`, `FLOCI_DEFAULT_REGION`, `FLOCI_DEFAULT_ACCOUNT_ID`,
`FLOCI_DEFAULT_AVAILABILITY_ZONE`, `FLOCI_MAX_REQUEST_SIZE`, `FLOCI_ECR_BASE_URI`

### Authentication (7 vars)
`FLOCI_AUTH_VALIDATE_SIGNATURES`, `FLOCI_AUTH_PRESIGN_SECRET`,
`FLOCI_SECURITY_EXTRA_CORS_ALLOWED_ORIGINS`, `FLOCI_SECURITY_EXTRA_CORS_ALLOWED_HEADERS`,
`FLOCI_SECURITY_EXTRA_CORS_EXPOSE_HEADERS`, `FLOCI_SECURITY_DISABLE_CORS_HEADERS`,
`FLOCI_DNS_EXTRA_SUFFIXES`

### TLS (4 vars)
`FLOCI_TLS_ENABLED`, `FLOCI_TLS_CERT_PATH`, `FLOCI_TLS_KEY_PATH`, `FLOCI_TLS_SELF_SIGNED`

### Storage (5 vars + per-service overrides)
`FLOCI_STORAGE_MODE` (enum: memory|persistent|hybrid|wal), `FLOCI_STORAGE_PERSISTENT_PATH`,
`FLOCI_STORAGE_HOST_PERSISTENT_PATH`, `FLOCI_STORAGE_PRUNE_VOLUMES_ON_DELETE`,
`FLOCI_STORAGE_WAL_COMPACTION_INTERVAL_MS`
Per-service: `FLOCI_STORAGE_SERVICES_<SERVICE>_MODE`, `FLOCI_STORAGE_SERVICES_<SERVICE>_FLUSH_INTERVAL_MS`

### Docker (7 vars)
`FLOCI_DOCKER_DOCKER_HOST`, `FLOCI_DOCKER_DOCKER_CONFIG_PATH`,
`FLOCI_DOCKER_LOG_MAX_SIZE`, `FLOCI_DOCKER_LOG_MAX_FILE`,
`FLOCI_DOCKER_REGISTRY_CREDENTIALS_<N>__SERVER/USERNAME/PASSWORD` (indexed, repeatable)

### Initialization Hooks (3 vars)
`FLOCI_INIT_HOOKS_SHELL_EXECUTABLE`, `FLOCI_INIT_HOOKS_TIMEOUT_SECONDS`,
`FLOCI_INIT_HOOKS_SHUTDOWN_GRACE_PERIOD_SECONDS`

### Compute Services (20+ vars)
Lambda: memory, timeout, hot-reload, concurrency, port ranges
ECS: memory, CPU, mock mode, docker network
EC2: IMDS port, SSH port ranges, mock mode
EKS: k3s provider, API server ports, mock mode, docker network
CodeBuild/CodeDeploy: enabled, docker network

### Data Services (20+ vars)
S3: enabled, presign expiry
DynamoDB: enabled
RDS: enabled, Postgres/MySQL/MariaDB images, proxy port ranges
ElastiCache: enabled, Valkey/Redis image, proxy port ranges
MSK: enabled, mock mode, Redpanda image
OpenSearch: enabled, mock mode, image, proxy ports
ECR: enabled, TLS, Docker network, registry ports

### Messaging Services (10+ vars)
SQS: visibility timeout, message size, FIFO dedup
SNS: enabled
EventBridge: enabled
EventBridge Pipes: enabled
EventBridge Scheduler: enabled, invocation, tick interval
Kinesis: enabled

### Security Services
SSM: enabled, max parameter history
Secrets Manager: enabled, recovery window days
AppConfig/AppConfigData: enabled
ACM: enabled, validation wait seconds
KMS: enabled
IAM: enabled, enforcement enabled
Cognito: enabled

### Analytics Services
Athena: enabled, DuckDB image, mock mode, external DuckDB URL
Glue: enabled
CloudWatch Logs/Metrics: enabled, max events per query

## Export Format Examples

### .env
```
FLOCI_BASE_URL=http://localhost:4566
FLOCI_DEFAULT_REGION=eu-west-1
FLOCI_STORAGE_MODE=persistent
FLOCI_LAMBDA_ENABLED=true
```

### docker-compose environment block
```yaml
environment:
  FLOCI_BASE_URL: http://localhost:4566
  FLOCI_DEFAULT_REGION: eu-west-1
  FLOCI_STORAGE_MODE: persistent
```

## Error Codes
- `CONFIG_VALIDATION_ERROR` — field value fails validation (e.g., port out of range)
- `EXPORT_FORMAT_INVALID` — unknown export format requested
