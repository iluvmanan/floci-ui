# Feature 02: Instance Manager

## Overview
Register, connect, and manage multiple Floci instances. Each instance has connection metadata stored encrypted in PostgreSQL. A background task polls health every 60s.

## Acceptance Criteria
- [ ] Admin can register a Floci instance with: name, endpoint URL, region, access_key, secret_key
- [ ] `secret_key` is encrypted at rest with Fernet symmetric encryption
- [ ] Health check runs automatically on instance creation
- [ ] Background task checks all instance health every 60 seconds
- [ ] Health status transitions: unknown → healthy | degraded | unreachable
- [ ] Admin can manually trigger a health check
- [ ] Deleting an instance removes it from DB and clears boto3 session cache
- [ ] Home dashboard shows all instances as cards with status badges

## API Contracts
```
GET    /api/instances              → list of instances with status (viewer+)
POST   /api/instances              { name, description?, endpoint, region, access_key, secret_key, account_id?, tls_verify? } (admin+)
GET    /api/instances/{id}         → full instance detail (viewer+)
PUT    /api/instances/{id}         partial update of any field (admin+)
DELETE /api/instances/{id}         → 204 (admin+)
POST   /api/instances/{id}/health-check  → { status, checked_at, latency_ms } (operator+)
```

## DB Schema
```sql
CREATE TYPE instance_status AS ENUM ('unknown', 'healthy', 'degraded', 'unreachable');
CREATE TABLE floci_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint VARCHAR(512) NOT NULL,
  region VARCHAR(64) NOT NULL DEFAULT 'us-east-1',
  access_key VARCHAR(255) NOT NULL DEFAULT 'test',
  secret_key_encrypted VARCHAR(512) NOT NULL,
  account_id VARCHAR(12) NOT NULL DEFAULT '000000000000',
  tls_verify BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  status instance_status NOT NULL DEFAULT 'unknown',
  last_checked_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Health Check Logic
1. Create boto3 STS client pointed at instance endpoint
2. Call `sts.get_caller_identity()` with 5s timeout
3. Success → `status = healthy`, record latency
4. Timeout / connection refused → `status = unreachable`
5. Success but unexpected response → `status = degraded`

## Encryption
```python
# Generate key once:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# Set ENCRYPTION_KEY env var
from cryptography.fernet import Fernet
f = Fernet(settings.encryption_key)
encrypted = f.encrypt(secret_key.encode()).decode()
decrypted = f.decrypt(encrypted.encode()).decode()
```

## Error Codes
- `INSTANCE_NOT_FOUND` — instance ID does not exist
- `ENDPOINT_UNREACHABLE` — could not connect to Floci endpoint
- `DUPLICATE_INSTANCE_NAME` — name already taken
