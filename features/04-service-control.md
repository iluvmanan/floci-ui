# Feature 04: Service Control Panel

## Overview
Visual enable/disable for all 54 Floci AWS services with live health status per service. Services are grouped by category.

## Acceptance Criteria
- [ ] All 54 services displayed in category groups (Compute, Storage, Data, Messaging, Security, Analytics, Infrastructure)
- [ ] Each service card shows: icon, name, operation count, enable/disable toggle, live status indicator
- [ ] Status indicator: pulsing green = healthy, yellow = degraded, gray = disabled, red = unreachable
- [ ] Toggle updates config immediately and shows optimistic UI (debounced save)
- [ ] Bulk actions: "Enable All", "Disable All", "Enable Category"
- [ ] Search/filter by service name
- [ ] Clicking a service card expands to show service-specific config options
- [ ] Operator+ can toggle; viewer can only read

## API Contracts
```
GET  /api/instances/{id}/services              → list of all services with enabled + health status (viewer+)
PUT  /api/instances/{id}/services/{service}    { enabled: bool } (admin+)
PUT  /api/instances/{id}/services/batch        { services: [{name, enabled}] } (admin+)
```

## Service Response Schema
```json
{
  "services": [
    {
      "name": "s3",
      "display_name": "S3",
      "category": "storage",
      "description": "Simple Storage Service — 58 operations",
      "operation_count": 58,
      "env_key": "FLOCI_S3_ENABLED",
      "enabled": true,
      "status": "healthy",
      "status_checked_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Service Catalog (54 services)

### Compute
| Service | Ops | Env Key |
|---------|-----|---------|
| lambda | 30 | FLOCI_LAMBDA_ENABLED |
| ecs | 58 | FLOCI_ECS_ENABLED |
| ecr | 17 | FLOCI_ECR_ENABLED |
| eks | 7 | FLOCI_EKS_ENABLED |
| ec2 | 78 | FLOCI_EC2_ENABLED |
| codebuild | 20 | FLOCI_CODEBUILD_ENABLED |
| codedeploy | 30 | FLOCI_CODEDEPLOY_ENABLED |

### Storage
| Service | Ops | Env Key |
|---------|-----|---------|
| s3 | 58 | FLOCI_S3_ENABLED |
| dynamodb | 32 | FLOCI_DYNAMODB_ENABLED |
| rds | 14 | FLOCI_RDS_ENABLED |
| rds-data | 4 | FLOCI_RDSDATA_ENABLED |
| elasticache | 8 | FLOCI_ELASTICACHE_ENABLED |
| opensearch | 24 | FLOCI_OPENSEARCH_ENABLED |
| backup | 20 | FLOCI_BACKUP_ENABLED |

### Messaging
| Service | Ops | Env Key |
|---------|-----|---------|
| sqs | 20 | FLOCI_SQS_ENABLED |
| sns | 17 | FLOCI_SNS_ENABLED |
| kinesis | 24 | FLOCI_KINESIS_ENABLED |
| msk | 8 | FLOCI_MSK_ENABLED |
| eventbridge | 16 | FLOCI_EVENTBRIDGE_ENABLED |
| pipes | 7 | FLOCI_PIPES_ENABLED |
| scheduler | 12 | FLOCI_SCHEDULER_ENABLED |
| firehose | 6 | FLOCI_FIREHOSE_ENABLED |
| ses | 16 | FLOCI_SES_ENABLED |
| ses-v2 | 10 | FLOCI_SESV2_ENABLED |

### Security & Identity
| Service | Ops | Env Key |
|---------|-----|---------|
| cognito | 43 | FLOCI_COGNITO_ENABLED |
| iam | 68 | FLOCI_IAM_ENABLED |
| sts | 7 | FLOCI_STS_ENABLED |
| kms | 34 | FLOCI_KMS_ENABLED |
| secretsmanager | 16 | FLOCI_SECRETSMANAGER_ENABLED |
| acm | 12 | FLOCI_ACM_ENABLED |
| ssm | 2 | FLOCI_SSM_ENABLED |

### Analytics
| Service | Ops | Env Key |
|---------|-----|---------|
| cloudwatch-logs | 17 | FLOCI_CLOUDWATCHLOGS_ENABLED |
| cloudwatch-metrics | 11 | FLOCI_CLOUDWATCHMETRICS_ENABLED |
| athena | 4 | FLOCI_ATHENA_ENABLED |
| glue | 38 | FLOCI_GLUE_ENABLED |

### Infrastructure
| Service | Ops | Env Key |
|---------|-----|---------|
| cloudformation | 19 | FLOCI_CLOUDFORMATION_ENABLED |
| stepfunctions | 19 | FLOCI_STEPFUNCTIONS_ENABLED |
| route53 | 17 | FLOCI_ROUTE53_ENABLED |
| cloudmap | 22 | FLOCI_CLOUDMAP_ENABLED |
| cloudfront | 50 | FLOCI_CLOUDFRONT_ENABLED |
| elbv2 | 34 | FLOCI_ELBV2_ENABLED |
| autoscaling | 33 | FLOCI_AUTOSCALING_ENABLED |
| apigw | 64 | FLOCI_APIGATEWAY_ENABLED |
| apigw-v2 | 48 | FLOCI_APIGATEWAYV2_ENABLED |
| appsync | 33 | FLOCI_APPSYNC_ENABLED |
| appconfig | 16 | FLOCI_APPCONFIG_ENABLED |
| neptune | 8 | FLOCI_NEPTUNE_ENABLED |
| transfer | 17 | FLOCI_TRANSFER_ENABLED |
| bedrock | 2 | FLOCI_BEDROCKRUNTIME_ENABLED |
| pricing | 5 | FLOCI_PRICING_ENABLED |
| cost-explorer | 9 | FLOCI_COSTEXPLORER_ENABLED |
| cur | 6 | FLOCI_CUR_ENABLED |
| bcm | 7 | FLOCI_BCM_ENABLED |
| textract | 6 | FLOCI_TEXTRACT_ENABLED |
| transcribe | 8 | FLOCI_TRANSCRIBE_ENABLED |
| config | 20 | FLOCI_CONFIG_ENABLED |

## Health Check Per Service
Poll each service with a lightweight describe call (list/describe operation).
Services that don't support list operations (e.g., STS) use `get_caller_identity()`.
Timeout: 3 seconds per service. Batch all checks concurrently with `asyncio.gather()`.
