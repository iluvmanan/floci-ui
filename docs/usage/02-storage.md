# 02 — Storage

S3 · ECR · Backup

All paths under `Resources → Storage`.

---

## S3

**Location:** `Resources → Storage → S3`

### Create a bucket
**Create Bucket**

| Field | Example value |
|-------|---------------|
| Bucket name | `demo-bucket` (lowercase, globally-unique-ish, no underscores) |

### Browse & manage objects (open a bucket)
- **Upload** — pick any local file; uses a presigned POST. Try a small `.txt`.
- **Download** — per-object button (presigned GET).
- **Delete** — per-object.

### Bucket settings (open a bucket → Settings)
| Setting | Example value |
|---------|---------------|
| Versioning | toggle **Enabled** |
| CORS (JSON) | `[{"AllowedOrigins":["*"],"AllowedMethods":["GET"],"AllowedHeaders":["*"]}]` |
| Bucket policy (JSON) | see below |
| Lifecycle | rule id `expire-old`, prefix `logs/`, expiration `30` days |

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::demo-bucket/*"
    }
  ]
}
```

---

## ECR

**Location:** `Resources → Storage → ECR`

### Create a repository
**Create Repository**

| Field | Example value |
|-------|---------------|
| Repository name | `demo-repo` |
| Image tag mutability | `MUTABLE` |
| Scan on push | off (or on) |

Open a repo to see **images** (tag, digest, size, pushed-at) — empty until you push.
**Auth token** button shows a `docker login` command you can copy.
Row action **Delete** force-deletes (removes images too).

---

## Backup

**Location:** `Resources → Storage → Backup`
Tabbed page: **Vaults · Backup Plans · Jobs · Recovery Points**.

### Create a vault
Vaults tab → **Create Vault**

| Field | Example value |
|-------|---------------|
| Vault name | `demo-vault` |
| Encryption key ARN (optional) | leave blank, or a KMS key ARN |

### Create a backup plan
Backup Plans tab → **Create Plan**

| Field | Example value |
|-------|---------------|
| Plan name | `demo-plan` |
| Schedule (cron) | `cron(0 5 * * ? *)` |
| Retention (days) | `30` |
| Start window (min) | `60` |
| Completion window (min) | `120` |

### Start a backup job
Jobs tab → **Start Backup Job**

| Field | Example value |
|-------|---------------|
| Vault name | `demo-vault` |
| Resource ARN | `arn:aws:dynamodb:us-east-1:000000000000:table/demo-table` |
| IAM role ARN | `arn:aws:iam::000000000000:role/demo-role` |
