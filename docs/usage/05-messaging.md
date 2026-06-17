# 05 — Messaging

SQS · SNS · Kinesis · MSK · EventBridge · Data Firehose

All paths under `Resources → Messaging`.

---

## SQS

**Location:** `Resources → Messaging → SQS`

### Create a queue
**Create Queue**

| Field | Example value |
|-------|---------------|
| Queue name | `demo-queue` (append `.fifo` for FIFO) |

### Manage (open a queue)
- **Attributes** panel: visibility timeout `30`s, delay `0`s, retention `345600`s (4 days), DLQ ARN.
- **Edit attributes** to change them.

---

## SNS

**Location:** `Resources → Messaging → SNS`

### Create a topic
**Create Topic**

| Field | Example value |
|-------|---------------|
| Topic name | `demo-topic` |

### Subscriptions (open a topic → Subscriptions tab)
**Subscribe**

| Field | Example value |
|-------|---------------|
| Protocol | `email` (or `sqs`, `http`, `lambda`) |
| Endpoint | `you@example.com` (for `sqs`: a queue ARN) |

Row action: **Unsubscribe**.

---

## Kinesis

**Location:** `Resources → Messaging → Kinesis`

### Create a stream
**Create Stream**

| Field | Example value |
|-------|---------------|
| Stream name | `demo-stream` |
| Shard count | `1` |

### Manage (open a stream)
- Detail panel: shard count, ARN, retention, status.
- **Put record** → partition key `pk1`, data `{"event":"click"}`.
- **Shards** tab lists shard ids.

---

## MSK

**Location:** `Resources → Messaging → MSK`

### Create a cluster
**Create Cluster**

| Field | Example value |
|-------|---------------|
| Cluster name | `demo-kafka` |
| Cluster type | `SERVERLESS` (simplest; `PROVISIONED` also works) |
| Subnets (serverless) | `subnet-default-a` |

Open a cluster → **Bootstrap brokers** shows the broker endpoint string.

---

## EventBridge

**Location:** `Resources → Messaging → EventBridge`

### Create a rule (open the `default` bus → Rules tab)
**Create Rule**

| Field | Example value |
|-------|---------------|
| Name | `demo-rule` |
| Schedule expression | `rate(5 minutes)` (or `cron(0 12 * * ? *)`) |
| — or — Event pattern (JSON) | `{"source":["my.app"]}` |
| State | `ENABLED` |

Then add a **target** to the rule (e.g. an SNS topic / Lambda ARN).

### Put a test event (bus → Put Event)
| Field | Example value |
|-------|---------------|
| Source | `my.app` |
| Detail-type | `user.signup` |
| Detail (JSON) | `{"userId":"123"}` |

---

## Data Firehose

**Location:** `Resources → Messaging → Data Firehose`

### Create a delivery stream
**Create Delivery Stream**

| Field | Example value |
|-------|---------------|
| Stream name | `demo-firehose` |
| Destination | `S3` |
| S3 bucket ARN | `arn:aws:s3:::demo-bucket` |
| IAM role ARN | `arn:aws:iam::000000000000:role/demo-role` |

Test panel: **Put record** → data `hello firehose`.
