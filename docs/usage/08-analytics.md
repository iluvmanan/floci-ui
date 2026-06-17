# 08 — Analytics

Athena · Glue · OpenSearch · Cost Explorer · Pricing

All paths under `Resources → Analytics`.

---

## Athena

**Location:** `Resources → Analytics → Athena`

A `primary` workgroup already exists in the emulator.

### Create a workgroup
**Create Workgroup**

| Field | Example value |
|-------|---------------|
| Name | `demo-wg` |
| Output location | `s3://demo-bucket/athena-results/` |

### Run a query
- Select workgroup `primary`.
- SQL editor → e.g. `SHOW DATABASES;` or `SELECT 1;` → **Run**.
- Status polls automatically; results appear in the table; past runs are in the
  **Query History** tab.

---

## Glue

**Location:** `Resources → Analytics → Glue`
Tabbed page: **Databases · Crawlers · Jobs**.

### Create a database
Databases tab → **Create Database**

| Field | Example value |
|-------|---------------|
| Name | `demo_db` (underscores ok; avoid dashes) |
| Description (optional) | `demo glue db` |

Expand a database to list its tables.

### Create a crawler
Crawlers tab → **Create Crawler**

| Field | Example value |
|-------|---------------|
| Name | `demo-crawler` |
| IAM role | `arn:aws:iam::000000000000:role/demo-role` |
| Target (S3 path) | `s3://demo-bucket/data/` |
| Database | `demo_db` |

Row actions: **Start / Stop**.

### Create a job
Jobs tab → **Create Job**

| Field | Example value |
|-------|---------------|
| Name | `demo-job` |
| IAM role | `arn:aws:iam::000000000000:role/demo-role` |
| Command name | `glueetl` |
| Worker type | `G.1X` |

Run history is shown per job.

---

## OpenSearch

**Location:** `Resources → Analytics → OpenSearch`

> ⚠️ **Emulator note:** creating a domain succeeds but takes ~30s. Submit once and
> wait; don't double-click.

### Create a domain
**Create Domain**

| Field | Example value |
|-------|---------------|
| Domain name | `demo-os` |
| Engine version | `OpenSearch_2.11` |
| Instance type | `t3.small.search` |
| Instance count | `1` |
| EBS volume size (GB) | `10` |

Open a domain for endpoint, cluster config, EBS options, access policies, plus a
Dashboards link.

---

## Cost Explorer

**Location:** `Resources → Analytics → Cost Explorer`
Tabbed page: **Cost & Usage · Forecast · Cost Allocation Tags**.

### Get cost & usage
| Field | Example value |
|-------|---------------|
| Start date | `2026-05-01` |
| End date | `2026-06-01` |
| Granularity | `MONTHLY` (or `DAILY`) |
| Group by | `SERVICE` |

Click **Get Cost Data** → renders a bar chart. (Emulator returns synthetic/empty
cost figures.)

---

## Pricing

**Location:** `Resources → Analytics → Pricing`

> Always queried from the Pricing API in `us-east-1` regardless of the instance's
> region (handled automatically).

### Look up prices
| Field | Example value |
|-------|---------------|
| Service | select one from the dropdown (e.g. `AmazonEC2`) |

Click **Search Prices** → price-list table. Attribute filters narrow results.
