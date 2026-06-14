"""Static catalog of all 54 Floci services with metadata."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ServiceDef:
    name: str
    display_name: str
    category: str
    description: str
    operation_count: int
    env_key: str


SERVICE_CATALOG: list[ServiceDef] = [
    # Compute
    ServiceDef("lambda", "Lambda", "compute", "Serverless function execution", 30, "FLOCI_LAMBDA_ENABLED"),
    ServiceDef("ecs", "ECS", "compute", "Elastic Container Service", 58, "FLOCI_ECS_ENABLED"),
    ServiceDef("ecr", "ECR", "compute", "Elastic Container Registry", 17, "FLOCI_ECR_ENABLED"),
    ServiceDef("eks", "EKS", "compute", "Elastic Kubernetes Service", 7, "FLOCI_EKS_ENABLED"),
    ServiceDef("ec2", "EC2", "compute", "Elastic Compute Cloud", 78, "FLOCI_EC2_ENABLED"),
    ServiceDef("codebuild", "CodeBuild", "compute", "Build and test code", 20, "FLOCI_CODEBUILD_ENABLED"),
    ServiceDef("codedeploy", "CodeDeploy", "compute", "Automate code deployments", 30, "FLOCI_CODEDEPLOY_ENABLED"),
    # Storage
    ServiceDef("s3", "S3", "storage", "Simple Storage Service", 58, "FLOCI_S3_ENABLED"),
    ServiceDef("dynamodb", "DynamoDB", "storage", "Managed NoSQL database", 32, "FLOCI_DYNAMODB_ENABLED"),
    ServiceDef("rds", "RDS", "storage", "Relational Database Service", 14, "FLOCI_RDS_ENABLED"),
    ServiceDef("rds-data", "RDS Data", "storage", "RDS Data API", 4, "FLOCI_RDSDATA_ENABLED"),
    ServiceDef("elasticache", "ElastiCache", "storage", "In-memory caching", 8, "FLOCI_ELASTICACHE_ENABLED"),
    ServiceDef("opensearch", "OpenSearch", "storage", "Search and analytics", 24, "FLOCI_OPENSEARCH_ENABLED"),
    ServiceDef("backup", "Backup", "storage", "Centralized backup service", 20, "FLOCI_BACKUP_ENABLED"),
    # Messaging
    ServiceDef("sqs", "SQS", "messaging", "Simple Queue Service", 20, "FLOCI_SQS_ENABLED"),
    ServiceDef("sns", "SNS", "messaging", "Simple Notification Service", 17, "FLOCI_SNS_ENABLED"),
    ServiceDef("kinesis", "Kinesis", "messaging", "Real-time data streaming", 24, "FLOCI_KINESIS_ENABLED"),
    ServiceDef("msk", "MSK", "messaging", "Managed Kafka streaming", 8, "FLOCI_MSK_ENABLED"),
    ServiceDef("eventbridge", "EventBridge", "messaging", "Serverless event bus", 16, "FLOCI_EVENTBRIDGE_ENABLED"),
    ServiceDef("pipes", "EventBridge Pipes", "messaging", "Event-driven integrations", 7, "FLOCI_PIPES_ENABLED"),
    ServiceDef("scheduler", "EventBridge Scheduler", "messaging", "Scheduled event delivery", 12, "FLOCI_SCHEDULER_ENABLED"),
    ServiceDef("firehose", "Firehose", "messaging", "Delivery stream to S3/Redshift", 6, "FLOCI_FIREHOSE_ENABLED"),
    ServiceDef("ses", "SES", "messaging", "Simple Email Service", 16, "FLOCI_SES_ENABLED"),
    ServiceDef("ses-v2", "SES v2", "messaging", "SES API version 2", 10, "FLOCI_SESV2_ENABLED"),
    # Security & Identity
    ServiceDef("cognito", "Cognito", "security", "User authentication & authorization", 43, "FLOCI_COGNITO_ENABLED"),
    ServiceDef("iam", "IAM", "security", "Identity and Access Management", 68, "FLOCI_IAM_ENABLED"),
    ServiceDef("sts", "STS", "security", "Security Token Service", 7, "FLOCI_STS_ENABLED"),
    ServiceDef("kms", "KMS", "security", "Key Management Service", 34, "FLOCI_KMS_ENABLED"),
    ServiceDef("secretsmanager", "Secrets Manager", "security", "Manage and rotate secrets", 16, "FLOCI_SECRETSMANAGER_ENABLED"),
    ServiceDef("acm", "ACM", "security", "Certificate Manager", 12, "FLOCI_ACM_ENABLED"),
    ServiceDef("ssm", "SSM", "security", "Parameter Store & Systems Manager", 2, "FLOCI_SSM_ENABLED"),
    # Analytics
    ServiceDef("cloudwatch-logs", "CloudWatch Logs", "analytics", "Log storage and monitoring", 17, "FLOCI_CLOUDWATCHLOGS_ENABLED"),
    ServiceDef("cloudwatch-metrics", "CloudWatch Metrics", "analytics", "Metrics and alarms", 11, "FLOCI_CLOUDWATCHMETRICS_ENABLED"),
    ServiceDef("athena", "Athena", "analytics", "Interactive SQL query service", 4, "FLOCI_ATHENA_ENABLED"),
    ServiceDef("glue", "Glue", "analytics", "ETL and data catalog", 38, "FLOCI_GLUE_ENABLED"),
    # Infrastructure
    ServiceDef("cloudformation", "CloudFormation", "infrastructure", "Infrastructure as code", 19, "FLOCI_CLOUDFORMATION_ENABLED"),
    ServiceDef("stepfunctions", "Step Functions", "infrastructure", "Visual workflow orchestration", 19, "FLOCI_STEPFUNCTIONS_ENABLED"),
    ServiceDef("route53", "Route 53", "infrastructure", "DNS and routing", 17, "FLOCI_ROUTE53_ENABLED"),
    ServiceDef("cloudmap", "Cloud Map", "infrastructure", "Service discovery", 22, "FLOCI_CLOUDMAP_ENABLED"),
    ServiceDef("cloudfront", "CloudFront", "infrastructure", "Content delivery network", 50, "FLOCI_CLOUDFRONT_ENABLED"),
    ServiceDef("elbv2", "ELB v2", "infrastructure", "Application and Network Load Balancer", 34, "FLOCI_ELBV2_ENABLED"),
    ServiceDef("autoscaling", "Auto Scaling", "infrastructure", "Automatic capacity scaling", 33, "FLOCI_AUTOSCALING_ENABLED"),
    ServiceDef("apigw", "API Gateway", "infrastructure", "REST and HTTP API management", 64, "FLOCI_APIGATEWAY_ENABLED"),
    ServiceDef("apigw-v2", "API Gateway v2", "infrastructure", "HTTP and WebSocket APIs", 48, "FLOCI_APIGATEWAYV2_ENABLED"),
    ServiceDef("appsync", "AppSync", "infrastructure", "Managed GraphQL service", 33, "FLOCI_APPSYNC_ENABLED"),
    ServiceDef("appconfig", "AppConfig", "infrastructure", "Feature flag and config management", 16, "FLOCI_APPCONFIG_ENABLED"),
    ServiceDef("neptune", "Neptune", "infrastructure", "Managed graph database", 8, "FLOCI_NEPTUNE_ENABLED"),
    ServiceDef("transfer", "Transfer Family", "infrastructure", "SFTP/FTP file transfer", 17, "FLOCI_TRANSFER_ENABLED"),
    ServiceDef("bedrock", "Bedrock", "infrastructure", "Foundation AI model API", 2, "FLOCI_BEDROCKRUNTIME_ENABLED"),
    ServiceDef("pricing", "Pricing", "infrastructure", "AWS pricing API", 5, "FLOCI_PRICING_ENABLED"),
    ServiceDef("cost-explorer", "Cost Explorer", "infrastructure", "Cost and usage reports", 9, "FLOCI_COSTEXPLORER_ENABLED"),
    ServiceDef("cur", "CUR", "infrastructure", "Cost and Usage Reports", 6, "FLOCI_CUR_ENABLED"),
    ServiceDef("bcm", "BCM", "infrastructure", "Billing and Cost Management", 7, "FLOCI_BCM_ENABLED"),
    ServiceDef("textract", "Textract", "infrastructure", "Extract text from documents", 6, "FLOCI_TEXTRACT_ENABLED"),
    ServiceDef("transcribe", "Transcribe", "infrastructure", "Speech-to-text service", 8, "FLOCI_TRANSCRIBE_ENABLED"),
    ServiceDef("config", "Config", "infrastructure", "Resource inventory and compliance", 20, "FLOCI_CONFIG_ENABLED"),
]

_BY_NAME: dict[str, ServiceDef] = {s.name: s for s in SERVICE_CATALOG}


def get_service(name: str) -> ServiceDef | None:
    return _BY_NAME.get(name)
