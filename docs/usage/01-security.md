# 01 — Security

IAM · KMS · ACM · Secrets Manager · Cognito

All paths are under `Resources → Security` inside an instance. Values below are
verified against the emulator.

---

## IAM

**Location:** `Resources → Security → IAM`
Tabbed page: **Users · Roles · Policies · Groups**.

### Create a user
Users tab → **Create User**

| Field | Example value |
|-------|---------------|
| User name | `demo-user` |

After creation, expand the user row for sub-actions:
- **Attach policy** → paste a managed policy ARN, e.g. `arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess`
- **Create access key** → returns an Access Key ID + Secret (the secret is shown **once** — copy it immediately).

### Create a role
Roles tab → **Create Role**

| Field | Example value |
|-------|---------------|
| Role name | `demo-role` |
| Trust policy (JSON) | see below |

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ec2.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

> For a Lambda execution role, change `"Service"` to `"lambda.amazonaws.com"`.
> The resulting ARN is `arn:aws:iam::000000000000:role/demo-role` — reused by ECS,
> EKS, CodeBuild, Step Functions, etc.

### Create a policy
Policies tab → **Create Policy**

| Field | Example value |
|-------|---------------|
| Policy name | `demo-policy` |
| Policy document (JSON) | see below |

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "*" }
  ]
}
```

### Create a group
Groups tab → **Create Group**

| Field | Example value |
|-------|---------------|
| Group name | `demo-group` |

Then **Add user** → `demo-user`.

---

## KMS

**Location:** `Resources → Security → KMS`

### Create a key
**Create Key**

| Field | Example value |
|-------|---------------|
| Description | `demo key` |
| Key usage | `ENCRYPT_DECRYPT` |
| Key spec | `SYMMETRIC_DEFAULT` |

Row actions: **Enable / Disable**, **Schedule deletion** (pending window `7` days),
**Cancel deletion**.

### Create an alias
Aliases tab → **Create Alias**

| Field | Example value |
|-------|---------------|
| Alias name | `alias/demo-key` (the `alias/` prefix is required) |
| Target key | select the key created above |

### Test encrypt / decrypt
Open a key → **Encrypt/Decrypt** panel:
- **Plaintext** → `hello world` → **Encrypt** → produces base64 ciphertext.
- Paste the ciphertext → **Decrypt** → returns `hello world`.

---

## Secrets Manager

**Location:** `Resources → Security → Secrets Manager`

### Create a secret
**Create Secret**

| Field | Example value |
|-------|---------------|
| Name | `demo-secret` |
| Secret value (string) | `{"username":"admin","password":"s3cr3t"}` |
| Description | `demo credentials` |

Row actions:
- **Reveal value** — masked by default; click the eye icon to fetch & show.
- **Update value** — paste a new string.
- **Delete** — force-deletes without recovery window.

---

## ACM

**Location:** `Resources → Security → ACM`

### Request a certificate
**Request Certificate**

| Field | Example value |
|-------|---------------|
| Domain name | `example.com` |
| Validation method | `DNS` |
| Subject alternative names (optional) | `www.example.com` |

The cert appears with status `PENDING_VALIDATION` (the emulator does not
auto-validate). Row action **Resend validation email** is available for `EMAIL`
validation.

---

## Cognito

**Location:** `Resources → Security → Cognito`

### Create a user pool
**Create User Pool**

| Field | Example value |
|-------|---------------|
| Pool name | `demo-pool` |

### Manage users (open a pool)
- **Create user** → username `jane`, temp password `Temp#1234`, email `jane@example.com`
- Row actions: **Enable / Disable user**, **Reset password**, **Edit attributes**.

### App clients (open a pool → App Clients tab)
- **Create app client** → name `demo-web-client`.
