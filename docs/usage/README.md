# Floci Console — Feature Usage Guide

A hands-on reference for every resource browser in the console, with **exact input
values that are verified to work against the bundled Floci emulator**
(`floci/floci:latest`, region `us-east-1`, account `000000000000`).

Every "Example value" in these docs was run against a live emulator. Where the
emulator rejects a value that real AWS would accept, it's called out explicitly.

## Contents

1. [Getting started](#getting-started) — log in, add an instance
2. [Conventions used in this guide](#conventions)
3. [Emulator-wide facts & constraints](#emulator-wide-facts) — AMIs, VPC, subnets, gotchas
4. Per-service references:
   - [01 — Security](01-security.md) (IAM, KMS, ACM, Secrets Manager, Cognito)
   - [02 — Storage](02-storage.md) (S3, ECR, Backup)
   - [03 — Compute](03-compute.md) (EC2, Lambda, ECS, EKS, Auto Scaling)
   - [04 — Database](04-database.md) (DynamoDB, RDS, ElastiCache, Neptune)
   - [05 — Messaging](05-messaging.md) (SQS, SNS, Kinesis, MSK, EventBridge, Firehose)
   - [06 — Networking](06-networking.md) (API Gateway v1/v2, CloudFront, ELB v2, Route 53)
   - [07 — Developer tools](07-developer.md) (CloudFormation, Step Functions, AppSync, AppConfig, CodeBuild, CodeDeploy)
   - [08 — Analytics](08-analytics.md) (Athena, Glue, OpenSearch, Cost Explorer, Pricing)
   - [09 — AI / ML](09-ai-ml.md) (Bedrock, Textract, Transcribe)
   - [10 — Other](10-other.md) (SSM, STS, SES, Transfer Family, Cloud Map, AWS Config, Resource Groups)

---

## Getting started

### 1. Start the stack

```bash
make dev     # hot-reload (frontend :3000, backend :8000, emulator :4566)
# or
make build && make up   # production images
```

### 2. Log in

Open <http://localhost:3000>. Sign in with the superadmin seeded by the backend —
the credentials come from your `.env` (or `docker-compose.dev.yml`):

| Field | Where it's defined |
|-------|--------------------|
| Email | `FIRST_SUPERADMIN_EMAIL` (default `admin@example.com`) |
| Password | `FIRST_SUPERADMIN_PASSWORD` |

> The session is a httpOnly JWT cookie. If a page looks blank right after the very
> first login, hard-refresh once (⌘/Ctrl+Shift+R).

### 3. Add the Floci instance

Dashboard → **Add Instance**. These are the exact values for the bundled emulator:

| Field | Example value |
|-------|---------------|
| Name | `Local Floci Dev` |
| Endpoint URL | `http://localhost:4566` |
| Region | `us-east-1` |
| Access Key ID | `test` |
| Secret Access Key | `test` |
| Account ID | `000000000000` |
| TLS verify | **off** (plain http endpoint) |

Save → the card should show a green **Healthy** badge. Click it, then open the
**Resources** tab to reach every service page documented here.

---

## Conventions

- **Location** — the sidebar path inside an instance, e.g. `Resources → Compute → EC2`.
- **Role** — viewers can read; **operator/admin/superadmin** can create/modify/delete.
  Mutation buttons are hidden/disabled for viewers.
- **Example value** — a concrete, verified input. Copy/paste it as-is.
- Tables list only the fields you must or commonly set; optional advanced fields are
  noted in prose.
- Names must be unique per instance — append a suffix (`-2`, your initials) if a name
  is already taken.

---

## Emulator-wide facts

These apply across every service and are referenced throughout the per-service docs.

### Account & region
- **Account ID:** `000000000000`
- **Region:** `us-east-1` (AZs `us-east-1a`, `us-east-1b`, `us-east-1c`)
- **Role ARN pattern:** `arn:aws:iam::000000000000:role/<role-name>`

### Default network (pre-created, use these IDs)
| Resource | ID | Detail |
|----------|-----|--------|
| Default VPC | `vpc-default` | CIDR `172.31.0.0/16` |
| Subnet (AZ a) | `subnet-default-a` | `us-east-1a` |
| Subnet (AZ b) | `subnet-default-b` | `us-east-1b` |
| Subnet (AZ c) | `subnet-default-c` | `us-east-1c` |

### Built-in AMIs (EC2)
| AMI ID | OS | Arch |
|--------|-----|------|
| `ami-0abcdef1234567890` | Amazon Linux 2 | x86_64 |
| `ami-0abcdef1234567891` | Amazon Linux 2023 | x86_64 |
| `ami-0abcdef1234567892` | Ubuntu 20.04 | x86_64 |
| `ami-ubuntu2204` | Ubuntu 22.04 | x86_64 |
| `ami-ubuntu2404-amd64` | Ubuntu 24.04 | x86_64 |
| `ami-ubuntu2404-arm64` | Ubuntu 24.04 | arm64 |
| `ami-debian12` | Debian 12 | x86_64 |
| `ami-alpine` | Alpine | x86_64 |
| `ami-0abcdef1234567893` | Windows Server 2022 | x86_64 |

### Known emulator constraints (differs from real AWS)
| Service | Constraint |
|---------|------------|
| **Bedrock** | Not implemented — `List foundation models` returns HTTP 404. The page loads but stays empty. |
| **ElastiCache** | Only `memcached` engine is accepted; `redis` is rejected with `InvalidParameterValue`. |
| **ELB v2** | `Create load balancer` requires real subnet IDs (`subnet-default-a/b/c`); made-up IDs fail with `SubnetNotFound`. |
| **OpenSearch** | `Create domain` succeeds but is slow (~30s). Be patient; don't double-submit. |
| **Mock resources** | Most "compute" resources (EC2 instances, RDS, ECS tasks, EKS nodes) are recorded and reported as running but no real VM/container boots. Fine for exercising the console. |

### Cleanup

To wipe all emulator data and start fresh:

```bash
docker compose -f docker-compose.yml -f docker-compose.floci.yml down -v
```

(`-v` removes the `floci_data` volume.)
