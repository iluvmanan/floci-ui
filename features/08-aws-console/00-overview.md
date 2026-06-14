# Feature 08: Full AWS Console — 53 Services Overview

## Goal
Expand the Floci management console from 8 basic resource browsers to full AWS-console-depth coverage of all 53 Floci-supported services.

## Architecture Pattern (All Services Follow This)

### Backend (per service)
- File: `backend/app/routers/resources/{service}.py`
- Router prefix: `/instances/{instance_id}/resources/{service}`
- Auth: `RequireViewer` on GET, `RequireOperator` on mutations
- Client: `get_client(inst, "boto3-service-name")` from `app.routers.resources.base`
- Register in: `backend/app/main.py`

### Frontend (per service)
- File: `frontend/app/(dashboard)/[instanceId]/resources/{service}/page.tsx`
- API client methods: `frontend/lib/api/instances.ts`
- Nav entry: `frontend/app/(dashboard)/[instanceId]/resources/layout.tsx`
- Pattern: `useQuery` / `useMutation` + shadcn/ui Table + Dialog + Sonner toast

## Service Index

| # | File | Services Covered |
|---|------|-----------------|
| 01 | `01-nav-and-enhancements.md` | Navigation restructure + enhance 8 existing services |
| 02 | `02-ec2.md` | EC2 |
| 03 | `03-iam.md` | IAM |
| 04 | `04-api-gateway.md` | API Gateway v1 + v2 |
| 05 | `05-rds-databases.md` | RDS, ElastiCache, Neptune |
| 06 | `06-secrets-ssm-kms-sts.md` | Secrets Manager, SSM, KMS, STS |
| 07 | `07-containers.md` | ECS, EKS, ECR, Auto Scaling |
| 08 | `08-networking.md` | Route 53, CloudFront, ELB v2, ACM |
| 09 | `09-developer-tools.md` | CloudFormation, Step Functions, AppSync, AppConfig, CodeBuild, CodeDeploy, Backup, Transfer Family |
| 10 | `10-analytics-ai.md` | Athena, Glue, Data Firehose, OpenSearch, Bedrock, Textract, Transcribe |
| 11 | `11-messaging-supporting.md` | SES, MSK, Cloud Map, AWS Config, Resource Groups Tagging, Cost Explorer, Pricing |

## Navigation Restructure (Do First)

Replace flat `services[]` in `layout.tsx` with grouped categories + search input:

```
Compute    → EC2, Lambda, ECS, EKS, Auto Scaling
Storage    → S3, ECR, Backup
Database   → DynamoDB, RDS, ElastiCache, Neptune
Messaging  → SQS, SNS, Kinesis, MSK, EventBridge, Data Firehose
Networking → API Gateway, API Gateway v2, CloudFront, ELB v2, Route 53
Security   → IAM, KMS, ACM, Secrets Manager, Cognito
Developer  → CloudFormation, Step Functions, AppSync, AppConfig, CodeBuild, CodeDeploy
Analytics  → Athena, Glue, OpenSearch, Cost Explorer, Pricing
AI / ML    → Bedrock, Textract, Transcribe
Other      → SSM, STS, SES, Transfer Family, Cloud Map, AWS Config, Resource Groups, MSK
```

## RBAC
- `viewer` role: all GET endpoints only
- `operator`/`admin`/`superadmin`: full CRUD
- Frontend guard: `canMutate = ["admin", "operator", "superadmin"].includes(user.role)`
