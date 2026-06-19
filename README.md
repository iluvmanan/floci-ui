# Floci Management Console

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An enterprise web console for managing [Floci](https://floci.io) instances — browse
and operate **53 AWS-compatible services** (EC2, S3, IAM, Lambda, RDS, DynamoDB,
and more) against any Floci endpoint, with role-based access, audit logging, and a
bundled local emulator for development.

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router, Turbopack), React, Tailwind, shadcn/ui, TanStack Query |
| Backend | FastAPI, SQLAlchemy 2 (async), boto3 |
| Database | PostgreSQL 16 |
| Emulator | `floci/floci` (AWS-compatible, bundled for local dev) |
| Orchestration | Docker Compose + Make |

---

## Prerequisites

- **Docker** + **Docker Compose** (Docker Desktop on macOS/Windows, or Docker Engine on Linux)
- **make** (preinstalled on macOS/Linux)
- Python 3 (only for generating secrets, optional)

That's it — everything else runs inside containers.

---

## Quick start

```bash
# 1. Clone
git clone <repo-url> floci-console && cd floci-console

# 2. Create your .env from the template
cp .env.example .env

# 3. Fill in the two required secrets (or use the generators)
make gen-jwt-secret        # paste output into JWT_SECRET=
make gen-encryption-key    # paste output into ENCRYPTION_KEY=

# 4. Start everything (frontend + backend + Postgres + Floci emulator)
make dev
```

Then open **<http://localhost:3000>** and log in with the superadmin you set in
`.env` (`FIRST_SUPERADMIN_EMAIL` / `FIRST_SUPERADMIN_PASSWORD`).

> First run pulls images and builds — give it a minute. If the dashboard looks blank
> immediately after the very first login, hard-refresh once (⌘/Ctrl+Shift+R).

### What's running

| Service | URL |
|---------|-----|
| Frontend (console) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Floci emulator | http://localhost:4566 |
| PostgreSQL | localhost:5432 |

---

## Environment variables

Copy `.env.example` → `.env` and set:

| Variable | Required | Notes |
|----------|----------|-------|
| `JWT_SECRET` | ✅ | Signs auth tokens. `make gen-jwt-secret` |
| `ENCRYPTION_KEY` | ✅ | Fernet key; encrypts stored Floci credentials at rest. `make gen-encryption-key` |
| `POSTGRES_PASSWORD` | — | Defaults to `floci_secret` for local dev |
| `FIRST_SUPERADMIN_EMAIL` | — | Seeded on first startup (default `admin@example.com`) |
| `FIRST_SUPERADMIN_PASSWORD` | — | Seeded superadmin password |
| `NEXT_PUBLIC_API_URL` | — | Backend URL the frontend calls (default `http://localhost:8000`) |
| `BACKEND_CORS_ORIGINS` | — | Comma-separated allowed origins (default `http://localhost:3000`) |

> ⚠️ `.env` is gitignored — never commit real secrets. The values baked into
> `docker-compose.dev.yml` are throwaway local-dev defaults only.

---

## Connecting to the bundled emulator

`make dev` starts a local Floci emulator. Add it as an instance in the console:

| Field | Value |
|-------|-------|
| Endpoint URL | `http://localhost:4566` |
| Region | `us-east-1` |
| Access Key ID | `test` |
| Secret Access Key | `test` |
| Account ID | `000000000000` |
| TLS verify | off |

Full per-service walkthroughs with verified example inputs live in
**[`docs/usage/`](docs/usage/README.md)**.

---

## Common commands

```bash
make dev              # dev environment with hot-reload (+ bundled emulator)
make build            # build production images
make up               # start production (detached)
make down             # stop all containers
make logs             # tail logs
make migrate          # run DB migrations (alembic upgrade head)
make migrate-create msg="add_x_table"   # create a new migration
make test             # run backend tests (in container)
make lint             # lint backend + frontend
make gen-jwt-secret   # generate a JWT_SECRET
make gen-encryption-key  # generate an ENCRYPTION_KEY
make help             # list all targets
```

---

## Production

```bash
# Set real secrets in .env first (JWT_SECRET, ENCRYPTION_KEY, strong superadmin password)
make build
make up
```

Production uses the multi-stage `frontend/Dockerfile` (standalone Next.js server) and
`backend/Dockerfile`, without dev hot-reload. Run `make migrate` once the stack is up.

---

## Project structure

```
.
├── frontend/                 # Next.js console (App Router)
│   └── app/(dashboard)/[instanceId]/resources/   # per-service browser pages
├── backend/                  # FastAPI app
│   └── app/routers/resources/                     # per-service boto3 proxies
├── docs/usage/               # per-service usage guide with verified inputs
├── docker-compose.yml        # base (production)
├── docker-compose.dev.yml    # dev overrides (hot-reload)
├── docker-compose.floci.yml  # bundled Floci emulator
└── Makefile                  # all dev/ops commands
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `sh: next: not found` in frontend | Stale node_modules volume — `make down` then `docker compose ... up --build`, or remove the anonymous volume |
| CORS error on login | Ensure `BACKEND_CORS_ORIGINS` in `.env` includes your frontend origin (e.g. `http://localhost:3000`), then recreate the backend |
| Blank page after first login | Hard-refresh once (⌘/Ctrl+Shift+R) |
| `JWT_SECRET is required` on start | You skipped setting it in `.env` |

---

## License

Released under the [MIT License](LICENSE).
