# Feature 01: Foundation — Auth & RBAC

## Overview
Secure authentication system with JWT, refresh token rotation, and role-based access control. This is the prerequisite for all other features.

## Acceptance Criteria
- [ ] Users can log in with email + password; receive JWT in httpOnly cookie
- [ ] Access tokens expire in 15 minutes; refresh tokens expire in 7 days
- [ ] Refresh tokens rotate on use (old token invalidated)
- [ ] Unauthenticated requests to protected routes return 401
- [ ] Role-restricted routes return 403 when accessed by insufficient role
- [ ] First-time setup creates superadmin via env vars (`FIRST_SUPERADMIN_EMAIL` / `FIRST_SUPERADMIN_PASSWORD`)
- [ ] Superadmin can create/edit/deactivate users
- [ ] Frontend redirects unauthenticated users to `/login`
- [ ] Frontend hides UI elements based on current user role

## Roles (hierarchy: superadmin > admin > operator > viewer)
| Role | Can Do |
|------|--------|
| superadmin | Everything, including user management and system settings |
| admin | Configure instances, manage services, manage config |
| operator | Read + write/delete AWS resources within instances |
| viewer | Read-only access to all data |

## API Contracts
```
POST   /api/auth/login           { email, password } → sets httpOnly cookies
POST   /api/auth/logout          → clears cookies
POST   /api/auth/refresh         → rotates refresh token, new access token
GET    /api/auth/me              → { id, email, full_name, role, is_active }
POST   /api/auth/change-password { current_password, new_password }
GET    /api/auth/first-run       → { is_first_run: bool }

GET    /api/users                → paginated list (admin+)
POST   /api/users                { email, full_name, role, password } (admin+)
PUT    /api/users/{id}           { full_name, role, is_active } (admin+)
DELETE /api/users/{id}           → soft deactivate (superadmin)
```

## DB Schema
```sql
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'operator', 'viewer');
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  role user_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Error Codes
- `INVALID_CREDENTIALS` — wrong email or password
- `ACCOUNT_INACTIVE` — user is deactivated
- `TOKEN_EXPIRED` — JWT expired
- `TOKEN_INVALID` — JWT malformed or signature invalid
- `INSUFFICIENT_ROLE` — role too low for this route
