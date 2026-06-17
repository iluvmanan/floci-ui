# 04 — Database

DynamoDB · RDS · ElastiCache · Neptune

All paths under `Resources → Database`.

---

## DynamoDB

**Location:** `Resources → Database → DynamoDB`

### Create a table
**Create Table**

| Field | Example value |
|-------|---------------|
| Table name | `demo-table` |
| Partition key (name / type) | `id` / `S` (String) |
| Sort key (optional) | leave blank |
| Billing mode | `PAY_PER_REQUEST` (on-demand) |

### Work with items (open a table)
- **Scan** tab — lists items.
- **Query** tab — key condition, e.g. partition key `id` = `123`; optional filter expression.
- **Put / Edit item** — JSON, e.g. `{"id": "123", "name": "Alice"}`.
- **Get item** / **Delete item** — by key `{"id": "123"}`.
- **Settings** — switch billing mode or set provisioned capacity.

The detail panel shows item count, indexes (GSI/LSI), stream ARN, billing mode.

---

## RDS

**Location:** `Resources → Database → RDS`

### Create a DB instance
**Create Instance**

| Field | Example value |
|-------|---------------|
| DB identifier | `demo-db` |
| Engine | `postgres` (also `mysql`, `mariadb`) |
| Instance class | `db.t3.micro` |
| Allocated storage (GiB) | `20` |
| Master username | `admin` |
| Master password | `Password123!` |
| Initial DB name (optional) | `appdb` |

Row actions: **Start · Stop · Delete** (deletes with skip-final-snapshot),
**Create snapshot** (snapshot id `demo-db-snap-1`). Snapshots/Clusters have their
own tabs.

---

## ElastiCache

**Location:** `Resources → Database → ElastiCache`
Tabbed page: **Cache Clusters · Replication Groups**.

> ⚠️ **Emulator constraint:** only `memcached` is accepted. Choosing `redis` fails
> with `InvalidParameterValue`.

### Create a cache cluster
Cache Clusters tab → **Create Cluster**

| Field | Example value |
|-------|---------------|
| Cluster id | `demo-cache` |
| Engine | `memcached` |
| Node type | `cache.t3.micro` |
| Number of nodes | `1` |

Row action: **Reboot** (node ids).

---

## Neptune

**Location:** `Resources → Database → Neptune`

### Create a cluster
**Create Cluster**

| Field | Example value |
|-------|---------------|
| Cluster identifier | `demo-neptune` |
| Engine | `neptune` |
| Engine version (optional) | leave default |

### Add an instance (open a cluster)
| Field | Example value |
|-------|---------------|
| Instance identifier | `demo-neptune-1` |
| Instance class | `db.t3.medium` |
| Cluster | `demo-neptune` |
