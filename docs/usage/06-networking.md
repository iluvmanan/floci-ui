# 06 — Networking

API Gateway · API Gateway v2 · CloudFront · Load Balancers (ELB v2) · Route 53

All paths under `Resources → Networking`.

---

## API Gateway (REST / v1)

**Location:** `Resources → Networking → API Gateway`

### Create a REST API
**Create REST API**

| Field | Example value |
|-------|---------------|
| Name | `demo-api` |
| Description (optional) | `demo rest api` |
| Endpoint type | `REGIONAL` |

Open an API:
- **Resources** tree → **Create resource** → parent `/`, path part `items`.
- **Deploy** → stage name `dev`.
- **Stages** tab lists deployed stages.

### API keys
API Keys tab → **Create API Key** → name `demo-key`, enabled.

---

## API Gateway v2 (HTTP / WebSocket)

**Location:** `Resources → Networking → API Gateway v2`

### Create an API
**Create API**

| Field | Example value |
|-------|---------------|
| Name | `demo-http-api` |
| Protocol type | `HTTP` (or `WEBSOCKET`) |
| Route key (optional) | `GET /items` |

Open an API → **Routes** (`GET /items`), **Integrations** (type `HTTP_PROXY`,
URI `https://example.com`, method `GET`), **Deploy**.

---

## CloudFront

**Location:** `Resources → Networking → CloudFront`

### Create a distribution
**Create Distribution**

| Field | Example value |
|-------|---------------|
| Origin domain | `demo-bucket.s3.amazonaws.com` |
| Default root object | `index.html` |
| Price class | `PriceClass_100` |
| Viewer protocol policy | `allow-all` |

Open a distribution → **Create invalidation** → paths `/*`. Invalidation history
is listed below.

---

## Load Balancers (ELB v2)

**Location:** `Resources → Networking → Load Balancers`
Tabbed page: **Load Balancers · Target Groups**.

> ⚠️ **Emulator constraint:** you must use real subnet IDs. Made-up IDs fail with
> `SubnetNotFound`.

### Create a load balancer
Load Balancers tab → **Create Load Balancer**

| Field | Example value |
|-------|---------------|
| Name | `demo-lb` |
| Type | `application` (or `network`) |
| Scheme | `internet-facing` |
| Subnets | `subnet-default-a`, `subnet-default-b` |

Open an LB → **Listeners** → create protocol `HTTP`, port `80`.

### Create a target group
Target Groups tab → **Create Target Group**

| Field | Example value |
|-------|---------------|
| Name | `demo-tg` |
| Protocol / Port | `HTTP` / `80` |
| VPC | `vpc-default` |
| Target type | `instance` |

Open a TG → **Register targets** → instance id + port `80`.

---

## Route 53

**Location:** `Resources → Networking → Route 53`

### Create a hosted zone
**Create Hosted Zone**

| Field | Example value |
|-------|---------------|
| Domain name | `example.com` |
| Type | Public (leave "private" off) |

### Add a record (open a zone → Record Sets)
**Create Record**

| Field | Example value |
|-------|---------------|
| Action | `UPSERT` |
| Name | `www.example.com` |
| Type | `A` |
| TTL | `300` |
| Value | `1.2.3.4` |

A `CNAME` example: type `CNAME`, value `example.com`.
