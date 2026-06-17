# 03 — Compute

EC2 · Lambda · ECS · EKS · Auto Scaling

All paths under `Resources → Compute`. See the
[emulator-wide facts](README.md#emulator-wide-facts) for AMI IDs and subnet IDs.

---

## EC2

**Location:** `Resources → Compute → EC2`
Tabbed page: **Instances · Key Pairs · Security Groups · Volumes · Elastic IPs**.

### Launch an instance
Instances tab → **Launch Instance**

| Field | Example value |
|-------|---------------|
| AMI ID | `ami-ubuntu2204` |
| Instance type | `t3.micro` |
| Key pair (optional) | `demo-key` (create it first, see below) |
| Security group (optional) | `demo-sg` |
| Subnet (optional) | `subnet-default-a` |
| Min / Max count | `1` / `1` |

Row actions per instance: **Start · Stop · Reboot · Terminate · Connect**
(Connect shows the public IP / key name / sample SSH command).

> arm64 AMIs (`ami-ubuntu2404-arm64`) require an arm instance type such as `t4g.micro`.

### Create a key pair
Key Pairs tab → **Create Key Pair**

| Field | Example value |
|-------|---------------|
| Key name | `demo-key` |

Downloads a `.pem` once. (Or **Import** an existing public key body.)

### Create a security group
Security Groups tab → **Create Security Group**

| Field | Example value |
|-------|---------------|
| Name | `demo-sg` |
| Description | `demo sg` |
| VPC ID | `vpc-default` |

Then **Add inbound rule**: protocol `tcp`, port `22`, source `0.0.0.0/0`.

### Create a volume
Volumes tab → **Create Volume**

| Field | Example value |
|-------|---------------|
| Size (GiB) | `8` |
| Type | `gp3` |
| Availability zone | `us-east-1a` |

Row actions: **Attach** (instance + device `/dev/sdf`), **Detach**, **Delete**.

### Elastic IPs
Elastic IPs tab → **Allocate** → then **Associate** to an instance / **Release**.

---

## Lambda

**Location:** `Resources → Compute → Lambda`

### Create a function
**Create Function**

| Field | Example value |
|-------|---------------|
| Function name | `demo-fn` |
| Runtime | `python3.12` |
| Handler | `index.handler` |
| Role ARN | `arn:aws:iam::000000000000:role/demo-role` (trust = `lambda.amazonaws.com`) |
| Code | upload a `.zip` containing `index.py` with a `handler(event, context)` function |
| Memory (MB) / Timeout (s) | `128` / `3` |
| Env vars (optional) | key `STAGE` = `dev` |

Minimal `index.py` to zip:
```python
def handler(event, context):
    return {"ok": True}
```

Detail view → **Update code**, **Update config** (env vars / memory / timeout),
**Aliases** tab (create alias `live` → version `$LATEST`).

---

## ECS

**Location:** `Resources → Compute → ECS`
Left pane: clusters. Right pane tabs: **Services · Tasks · Task Definitions**.

### Create a cluster
**Create Cluster**

| Field | Example value |
|-------|---------------|
| Cluster name | `demo-cluster` |

### Register a task definition
Task Definitions tab → **Register**

| Field | Example value |
|-------|---------------|
| Family | `demo-task` |
| Network mode | `awsvpc` |
| CPU / Memory | `256` / `512` |
| Container definitions (JSON) | see below |

```json
[
  { "name": "web", "image": "nginx:latest", "essential": true,
    "portMappings": [{ "containerPort": 80 }] }
]
```

### Run a task / create a service
- Tasks tab → **Run Task** → task definition `demo-task`, count `1`, launch type `FARGATE`.
- Services tab → **Create Service** → task definition `demo-task`, desired count `1`.

---

## EKS

**Location:** `Resources → Compute → EKS`

### Create a cluster
**Create Cluster**

| Field | Example value |
|-------|---------------|
| Name | `demo-eks` |
| Kubernetes version | `1.29` |
| Role ARN | `arn:aws:iam::000000000000:role/demo-role` |
| Subnets | `subnet-default-a`, `subnet-default-b` |

### Add a node group (open a cluster → Node Groups)
| Field | Example value |
|-------|---------------|
| Name | `demo-ng` |
| Node role ARN | `arn:aws:iam::000000000000:role/demo-role` |
| Subnets | `subnet-default-a`, `subnet-default-b` |
| Instance types | `t3.medium` |
| Desired / Min / Max | `2` / `1` / `3` |

---

## Auto Scaling

**Location:** `Resources → Compute → Auto Scaling`

### Create an Auto Scaling group
**Create Group**

| Field | Example value |
|-------|---------------|
| Name | `demo-asg` |
| Launch template / config | reference an existing one, or leave per UI hint |
| Min / Max / Desired | `1` / `3` / `2` |
| Subnets | `subnet-default-a`, `subnet-default-b` |

Row actions: **Update capacity** (set desired = `2`), **Scaling policies** tab
(policy `scale-out`, type `SimpleScaling`, adjustment `+1`), **Activity** history.
