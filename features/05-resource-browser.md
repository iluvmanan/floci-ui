# Feature 05: Resource Browser

## Overview
Browse and manage actual AWS resources running inside Floci instances. All API calls proxied through FastAPI backend using boto3.

## RBAC
- viewer: list + get operations only
- operator: list + get + create + delete + invoke

## Supported Services
S3, DynamoDB, Lambda, SQS, SNS, Cognito, Kinesis, EventBridge

## API Contracts

### S3
```
GET    /api/instances/{id}/resources/s3/buckets
POST   /api/instances/{id}/resources/s3/buckets              { bucket_name, region? }
DELETE /api/instances/{id}/resources/s3/buckets/{bucket}
GET    /api/instances/{id}/resources/s3/buckets/{bucket}/objects    ?prefix=&delimiter=&max_keys=100&continuation_token=
DELETE /api/instances/{id}/resources/s3/buckets/{bucket}/objects/{key}
GET    /api/instances/{id}/resources/s3/buckets/{bucket}/objects/{key}/download  → presigned URL
PUT    /api/instances/{id}/resources/s3/buckets/{bucket}/upload-url   { key, content_type } → presigned POST URL
```

### DynamoDB
```
GET    /api/instances/{id}/resources/dynamodb/tables
POST   /api/instances/{id}/resources/dynamodb/tables
         { table_name, hash_key, hash_type, range_key?, range_type?, billing_mode }
DELETE /api/instances/{id}/resources/dynamodb/tables/{table}
POST   /api/instances/{id}/resources/dynamodb/tables/{table}/scan
         { filter_expression?, expression_values?, limit?, last_key? }
POST   /api/instances/{id}/resources/dynamodb/tables/{table}/query
         { key_condition, expression_values, index_name?, limit?, last_key? }
PUT    /api/instances/{id}/resources/dynamodb/tables/{table}/items    { item: {} }
DELETE /api/instances/{id}/resources/dynamodb/tables/{table}/items    { key: {} }
```

### Lambda
```
GET    /api/instances/{id}/resources/lambda/functions
POST   /api/instances/{id}/resources/lambda/functions
         { function_name, runtime, handler, role, code_zip_base64 }
DELETE /api/instances/{id}/resources/lambda/functions/{name}
POST   /api/instances/{id}/resources/lambda/functions/{name}/invoke   { payload: {} }
         → { status_code, result, log_tail, duration_ms }
GET    /api/instances/{id}/resources/lambda/functions/{name}/logs     → last 100 lines
```

### SQS
```
GET    /api/instances/{id}/resources/sqs/queues
POST   /api/instances/{id}/resources/sqs/queues             { queue_name, fifo?, visibility_timeout? }
DELETE /api/instances/{id}/resources/sqs/queues/{name}
POST   /api/instances/{id}/resources/sqs/queues/{name}/send   { message_body, delay_seconds?, attributes? }
GET    /api/instances/{id}/resources/sqs/queues/{name}/receive  ?count=10&wait_seconds=0
DELETE /api/instances/{id}/resources/sqs/queues/{name}/purge
```

### SNS
```
GET    /api/instances/{id}/resources/sns/topics
POST   /api/instances/{id}/resources/sns/topics              { topic_name, fifo? }
DELETE /api/instances/{id}/resources/sns/topics/{arn}
POST   /api/instances/{id}/resources/sns/topics/{arn}/publish  { message, subject?, attributes? }
GET    /api/instances/{id}/resources/sns/topics/{arn}/subscriptions
```

### Cognito
```
GET    /api/instances/{id}/resources/cognito/user-pools
GET    /api/instances/{id}/resources/cognito/user-pools/{pool_id}/users   ?limit=60&token=
POST   /api/instances/{id}/resources/cognito/user-pools/{pool_id}/users   { username, email, temp_password }
DELETE /api/instances/{id}/resources/cognito/user-pools/{pool_id}/users/{username}
```

### Kinesis
```
GET    /api/instances/{id}/resources/kinesis/streams
POST   /api/instances/{id}/resources/kinesis/streams         { stream_name, shard_count }
DELETE /api/instances/{id}/resources/kinesis/streams/{name}
POST   /api/instances/{id}/resources/kinesis/streams/{name}/records  { data_b64, partition_key }
```

### EventBridge
```
GET    /api/instances/{id}/resources/eventbridge/buses
POST   /api/instances/{id}/resources/eventbridge/buses        { bus_name }
DELETE /api/instances/{id}/resources/eventbridge/buses/{name}
POST   /api/instances/{id}/resources/eventbridge/buses/{name}/events  { source, detail_type, detail }
GET    /api/instances/{id}/resources/eventbridge/buses/{name}/rules
```

## Frontend Pages

### S3 Browser
- Left: bucket list (DataTable: name, creation date, actions)
- Right: object explorer with breadcrumb path, file/folder icons
- Toolbar: Upload, Create Folder, Refresh, Delete Selected

### DynamoDB Browser
- Table list → click to open item explorer
- Item explorer: Scan / Query toggle, filter builder, paginated item table (JSON mode)
- Create Table dialog: primary key type, sort key optional, billing mode

### Lambda Browser  
- Function list: name, runtime, memory, timeout
- Invoke panel: split view — JSON input editor (left), response + logs (right)
- Duration badge, function version indicator

### SQS Browser
- Queue list with approximate message count badge
- Message panel: Send (text editor), Receive (card list of messages with receipt handle)
- Purge confirmation dialog with queue name confirmation input

### SNS Browser
- Topic list + ARN display
- Subscription list expandable per topic
- Publish Message modal with attributes key-value builder

## Shared Components
- `ResourceTable` — paginated DataTable with search, sort, selection
- `JsonViewer` — collapsible tree viewer for JSON blobs
- `CodeEditor` — CodeMirror with JSON mode for payload editing
- `ConfirmDeleteDialog` — requires typing resource name to confirm destructive ops
- `EmptyResourceState` — per-service empty state with CTA to create first resource
