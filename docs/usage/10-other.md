# 10 — Other

SSM · STS · SES · Transfer Family · Cloud Map · AWS Config · Resource Groups

All paths under `Resources → Other`.

---

## SSM (Parameter Store)

**Location:** `Resources → Other → SSM`

### Create a parameter
**Create Parameter**

| Field | Example value |
|-------|---------------|
| Name | `/demo/app/url` |
| Type | `String` (also `StringList`, `SecureString`) |
| Value | `https://example.com` |

A SecureString example: name `/demo/app/key`, type `SecureString`, value `abc123`.

Left pane is a path tree (`/demo/app/...`). **Reveal value** unmasks SecureString;
**Edit** / **Delete** per parameter.

---

## STS

**Location:** `Resources → Other → STS`

- **Caller identity** panel shows Account `000000000000`, User ID, ARN.
- **Assume role**:

  | Field | Example value |
  |-------|---------------|
  | Role ARN | `arn:aws:iam::000000000000:role/demo-role` |
  | Session name | `demo-session` |
  | Duration (s) | `3600` |

  Returns temporary credentials (shown once — copy them).

---

## SES

**Location:** `Resources → Other → SES`
Tabbed page: **Identities · Templates · Send Email · Statistics**.

### Verify an identity
Identities tab → **Verify Email**

| Field | Example value |
|-------|---------------|
| Email address | `sender@example.com` |

(or **Verify Domain** → `example.com`.)

### Create a template
Templates tab → **Create Template**

| Field | Example value |
|-------|---------------|
| Name | `welcome` |
| Subject | `Welcome, {{name}}` |
| HTML body | `<h1>Hi {{name}}</h1>` |
| Text body | `Hi {{name}}` |

### Send a test email
Send Email tab

| Field | Example value |
|-------|---------------|
| Source | `sender@example.com` (must be verified) |
| To | `recipient@example.com` |
| Subject | `Hello` |
| Body | `This is a test.` |

**Statistics** tab shows send quota and 24-hour data points.

---

## Transfer Family

**Location:** `Resources → Other → Transfer Family`

### Create a server
**Create Server**

| Field | Example value |
|-------|---------------|
| Protocols | `SFTP` (also `FTP`, `FTPS`) |
| Endpoint type | `PUBLIC` |
| Identity provider | `SERVICE_MANAGED` |

Open a server → **Users** → **Create user**: name `demo-user`, role
`arn:aws:iam::000000000000:role/demo-role`, home directory `/demo-bucket`, SSH
public key body. Row actions: **Start / Stop** server.

---

## Cloud Map

**Location:** `Resources → Other → Cloud Map`

### Create a namespace
**HTTP** (simplest) or **DNS**:

| Field | Example value |
|-------|---------------|
| Name (HTTP) | `demo-namespace` |
| Name (private DNS) | `demo.local` + VPC `vpc-default` |

Then (open a namespace):
- **Create service** → name `demo-service`, routing policy `MULTIVALUE`.
- Open a service → **Register instance** → instance id `inst-1`, attributes
  `AWS_INSTANCE_IPV4` = `10.0.0.1`.

---

## AWS Config

**Location:** `Resources → Other → AWS Config`
Tabbed page: **Recorder · Rules · Resource Inventory**.

### Set up the recorder
Recorder tab → **Configure Recorder**

| Field | Example value |
|-------|---------------|
| Name | `default` |
| Role ARN | `arn:aws:iam::000000000000:role/demo-role` |
| Recording group | all resources |

### Add a rule
Rules tab → **Create Rule**

| Field | Example value |
|-------|---------------|
| Name | `s3-bucket-versioning` |
| Source | managed rule `S3_BUCKET_VERSIONING_ENABLED` |

Compliance badge (`COMPLIANT` / `NON_COMPLIANT`) shows per rule. **Resource
Inventory** tab lists discovered resources by type.

---

## Resource Groups (Tagging)

**Location:** `Resources → Other → Resource Groups`

### Find & tag resources
| Field | Example value |
|-------|---------------|
| Tag key | `env` |
| Tag value | `dev` |
| Resource type filter | `s3` (or `ec2:instance`, comma-separated) |

Click **Search** → matching resources (ARN, type, tags). Select rows → **bulk tag
editor** to add/remove tags, e.g. add `team` = `platform`.

Example to tag the demo bucket: ARN `arn:aws:s3:::demo-bucket`, tag `env` = `dev`.
