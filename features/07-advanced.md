# Feature 07: Advanced Features

## Overview
Audit trail, API keys, and system settings for enterprise governance.

## Acceptance Criteria
- [ ] All mutating requests (POST/PUT/DELETE) auto-logged to audit_logs table
- [ ] Audit log queryable by: user, instance, action type, date range
- [ ] Audit log exportable to CSV
- [ ] Users can create/revoke API keys with custom names and expiry dates
- [ ] API keys accepted as `Authorization: Bearer <key>` alternative to JWT
- [ ] System info page shows: version, uptime, DB status, instance count, user count
- [ ] Admin can view all users' API keys; users can only see their own

## API Contracts

### Audit Log
```
GET  /api/audit                 (admin+)
     ?instance_id=&user_id=&action=&start=&end=&page=1&limit=50
     → { items: [AuditEntry], total, page, pages }

GET  /api/audit/export          (admin+)
     ?...same filters...
     → text/csv attachment
```

### API Keys
```
GET    /api/api-keys             → list own keys (or all for superadmin)
POST   /api/api-keys             { name, expires_at?, scopes: ["read", "write"] }
                                 → { id, key: "floci_...", name, expires_at }  (key shown once)
DELETE /api/api-keys/{id}        → 204 (revoke)
```

### System
```
GET  /api/system/health          → { status, db: bool, version, uptime_s }
GET  /api/system/info            → { version, user_count, instance_count, started_at }
```

## DB Schemas

### Audit Log
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  instance_id UUID REFERENCES floci_instances(id) ON DELETE SET NULL,
  action VARCHAR(64) NOT NULL,           -- e.g. "create_bucket", "invoke_lambda"
  resource_type VARCHAR(64),             -- e.g. "s3_bucket", "lambda_function"
  resource_id VARCHAR(512),              -- e.g. bucket name or function ARN
  details JSONB,                         -- request body snapshot
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_instance ON audit_logs(instance_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### API Keys
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL UNIQUE,  -- bcrypt of the key
  scopes VARCHAR(64)[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## API Key Format
Generated keys: `floci_<32 random bytes as hex>` — 70 chars total, prefixed for easy identification.

## Audit Middleware
```python
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and response.status_code < 400:
        await audit_service.log(request, response)
    return response
```

## Frontend Pages

### Audit Log Page (`/settings/audit`)
- DataTable: Timestamp | User | Action | Instance | Resource | IP
- Filters: date range picker, user dropdown, action type multi-select, instance dropdown
- "Export CSV" button (downloads filtered results)
- Auto-refresh toggle (every 30s for live audit monitoring)

### API Keys Page (`/settings/api-keys`)
- Table: Name | Scopes | Last Used | Expires | Actions (revoke)
- "Generate New Key" dialog:
  - Name input
  - Expiry: 30d / 90d / 1y / Never
  - Scope checkboxes: Read | Write | Admin
- After generation: modal shows key once with copy button + "This key will not be shown again" warning

### System Settings Page (`/settings/system`)
- Info card: version, started at, uptime
- DB status: connected / disconnected indicator
- Stats: total users, total instances
- Danger zone: "Force refresh all health checks"
