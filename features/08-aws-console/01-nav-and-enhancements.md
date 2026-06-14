# 08-01: Navigation Restructure + Enhance 8 Existing Services

## Navigation Restructure

**File:** `frontend/app/(dashboard)/[instanceId]/resources/layout.tsx`

### Tasks
- [ ] Replace `services[]` array with `serviceGroups[]` typed as `{ label: string, services: { label, href, icon }[] }[]`
- [ ] Add `<Input placeholder="Filter services..." />` at the top that filters matching service names in real time
- [ ] Render each group with a section header label (uppercase, muted, small font)
- [ ] Add collapse/expand toggle per group (default: all expanded)
- [ ] Add icons for all new services (lucide-react): `Server` (EC2), `Shield` (IAM), `Globe` (API GW), `Database` (RDS), `Lock` (KMS), `Container` (ECS), etc.
- [ ] Ensure active state highlight still works across all grouped items

---

## S3 Enhancements

**Backend file:** `backend/app/routers/resources/s3.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/s3/page.tsx`

### Backend Tasks
- [ ] `GET /buckets/{bucket}/versioning` — `get_bucket_versioning` → `{ status: "Enabled"|"Suspended"|"Off" }`
- [ ] `PUT /buckets/{bucket}/versioning` — `put_bucket_versioning` body: `{ enabled: bool }`
- [ ] `GET /buckets/{bucket}/policy` — `get_bucket_policy` → `{ policy: string }` (404 if none)
- [ ] `PUT /buckets/{bucket}/policy` — `put_bucket_policy` body: `{ policy: string (JSON) }`
- [ ] `DELETE /buckets/{bucket}/policy` — `delete_bucket_policy`
- [ ] `GET /buckets/{bucket}/cors` — `get_bucket_cors` → `{ rules: [] }`
- [ ] `PUT /buckets/{bucket}/cors` — `put_bucket_cors` body: `{ rules: [] }`
- [ ] `GET /buckets/{bucket}/tagging` — `get_bucket_tagging` → `{ tags: [{Key,Value}] }`
- [ ] `PUT /buckets/{bucket}/tagging` — `put_bucket_tagging` body: `{ tags: [{Key,Value}] }`

### Frontend Tasks
- [ ] Add "Upload" button to object browser toolbar — calls existing presigned POST endpoint, opens file picker
- [ ] Add "Download" button per object row — calls existing presigned GET endpoint, triggers browser download
- [ ] Add "Settings" button per bucket row → opens Bucket Settings dialog with tabs:
  - [ ] Versioning tab: toggle + current status display
  - [ ] Policy tab: JSON textarea editor with format/validate button
  - [ ] CORS tab: JSON array editor
  - [ ] Tags tab: key-value pair list editor
- [ ] Add API methods to `instances.ts`: `getBucketVersioning`, `setBucketVersioning`, `getBucketPolicy`, `setBucketPolicy`, `deleteBucketPolicy`, `getBucketCors`, `setBucketCors`, `getBucketTags`, `setBucketTags`

---

## DynamoDB Enhancements

**Backend file:** `backend/app/routers/resources/dynamodb.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/dynamodb/page.tsx`

### Backend Tasks
- [ ] `GET /tables/{table}` — `describe_table` → `{ name, status, item_count, size_bytes, billing_mode, key_schema, attribute_definitions, gsi[], lsi[], stream_arn, created_at }`
- [ ] `POST /tables/{table}/get-item` — `get_item` body: `{ key: {} }` → `{ item: {} | null }`
- [ ] `DELETE /tables/{table}/items` — `delete_item` body: `{ key: {} }` (already exists in backend, confirm working)
- [ ] `PUT /tables/{table}/settings` — `update_table` body: `{ billing_mode?, read_capacity?, write_capacity? }`

### Frontend Tasks
- [ ] Add "Describe" side panel per selected table: item count, billing mode, indexes (GSI/LSI list), stream ARN
- [ ] Add "Query" tab alongside existing "Scan" tab: KeyConditionExpression + ExpressionAttributeValues inputs
- [ ] Add "Delete Item" button per table row (requires key input dialog)
- [ ] Add "Get Item" button in toolbar → key input dialog → show result in JSON viewer
- [ ] Add "Settings" dialog per table: change billing mode, update provisioned capacity
- [ ] Add API methods: `describeTable`, `getItem`, `updateTableSettings`

---

## Lambda Enhancements

**Backend file:** `backend/app/routers/resources/lambda_.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/lambda/page.tsx`

### Backend Tasks
- [ ] `GET /functions/{name}` — `get_function` → full config (env vars, VPC, layers, role, dead letter, tracing, tags)
- [ ] `PUT /functions/{name}/code` — `update_function_code` body: `{ zip_base64: string }` → updated function metadata
- [ ] `PUT /functions/{name}/config` — `update_function_configuration` body: `{ handler?, memory_size?, timeout?, environment?: {Variables:{}}, description? }`
- [ ] Ensure `POST /functions` accepts `env_vars: {}`, `layers: []`, `vpc_config: {}` in body
- [ ] `GET /functions/{name}/aliases` — `list_aliases` → `[{ name, function_version, description }]`
- [ ] `POST /functions/{name}/aliases` — `create_alias` body: `{ name, function_version, description? }`

### Frontend Tasks
- [ ] Add "Create Function" dialog (was missing): runtime dropdown (nodejs20.x/python3.12/java21/go1.x/dotnet8), handler, role ARN, memory (128-10240), timeout (1-900), description, env vars (key-value list), zip file upload (→ base64)
- [ ] Add "Edit Config" dialog per function: env vars editor, memory/timeout/handler fields
- [ ] Add "Update Code" dialog: zip file upload → replace code
- [ ] Add function detail panel (click row): shows env vars, VPC config, layers, role ARN
- [ ] Add Aliases tab per function
- [ ] Add API methods: `getFunction`, `updateFunctionCode`, `updateFunctionConfig`, `listAliases`, `createAlias`

---

## SQS Enhancements

**Backend file:** `backend/app/routers/resources/sqs.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/sqs/page.tsx`

### Backend Tasks
- [ ] `GET /queues/{name}/attributes` — `get_queue_attributes(AttributeNames=["All"])` → `{ visibility_timeout, delay_seconds, receive_wait_time, max_message_size, retention_period, arn, approximate_message_count, dlq_arn?, redrive_max_receive_count? }`
- [ ] `PUT /queues/{name}/attributes` — `set_queue_attributes` body: `{ visibility_timeout?, delay_seconds?, receive_wait_time?, redrive_policy? }`

### Frontend Tasks
- [ ] Add "Attributes" expandable panel per selected queue: display all attributes as labeled values
- [ ] Add "Edit Attributes" dialog: visibility timeout, delay seconds, receive wait time, DLQ ARN + max receive count fields
- [ ] Add API methods: `getQueueAttributes`, `setQueueAttributes`

---

## SNS Enhancements

**Backend file:** `backend/app/routers/resources/sns.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/sns/page.tsx`

### Backend Tasks
- [ ] `POST /topics/{arn:path}/subscribe` — `subscribe` body: `{ protocol: email|sqs|http|https|lambda|sms, endpoint: string }` → `{ subscription_arn }`
- [ ] `DELETE /subscriptions/{arn:path}` — `unsubscribe`
- [ ] `GET /subscriptions` — `list_subscriptions` → `[{ arn, protocol, endpoint, topic_arn, owner }]`
- [ ] `GET /topics/{arn:path}/attributes` — `get_topic_attributes` → `{ arn, name, owner, subscriptions_confirmed, subscriptions_pending, ... }`

### Frontend Tasks
- [ ] Add Subscriptions panel per selected topic: list with protocol/endpoint + unsubscribe button
- [ ] Add "Subscribe" dialog: protocol dropdown + endpoint input
- [ ] Add topic attributes panel: confirmed/pending subscriber count, policy
- [ ] Add API methods: `subscribeToTopic`, `unsubscribe`, `listSubscriptions`, `getTopicAttributes`

---

## Kinesis Enhancements

**Backend file:** `backend/app/routers/resources/kinesis.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/kinesis/page.tsx`

### Backend Tasks
- [ ] `GET /streams/{name}` — `describe_stream_summary` → `{ name, arn, status, shard_count, retention_hours, enhanced_monitoring, stream_creation_timestamp }`
- [ ] `GET /streams/{name}/shards` — `list_shards` → `[{ shard_id, hash_key_range, sequence_number_range }]`

### Frontend Tasks
- [ ] Add stream detail panel (click row): ARN, status, shard count, retention, creation time
- [ ] Add "Put Record" dialog (backend endpoint exists): partition key input + data textarea (text/JSON toggle)
- [ ] Add Shards tab per stream: list shards with hash key range
- [ ] Add API methods: `describeStream`, `listShards`, `putRecord` (already in backend, add to instances.ts)

---

## EventBridge Enhancements

**Backend file:** `backend/app/routers/resources/eventbridge.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/eventbridge/page.tsx`

### Backend Tasks
- [ ] `POST /buses/{name}/rules` — `put_rule` body: `{ name, event_pattern?: string (JSON), schedule_expression?: string, state: ENABLED|DISABLED, description? }` → `{ rule_arn }`
- [ ] `DELETE /buses/{name}/rules/{rule}` — `remove_targets` (first) then `delete_rule`
- [ ] `GET /buses/{name}/rules/{rule}/targets` — `list_targets_by_rule` → `[{ id, arn, input?, input_path? }]`
- [ ] `POST /buses/{name}/rules/{rule}/targets` — `put_targets` body: `{ targets: [{ id, arn, input? }] }`
- [ ] Wire up `POST /buses/{name}/events` in frontend (endpoint already exists in backend)

### Frontend Tasks
- [ ] Add Rules tab per bus: list rules with event pattern / schedule expression display + enabled/disabled badge
- [ ] Add "Create Rule" dialog: name, pattern type (event pattern JSON | schedule expression), state toggle
- [ ] Add "Delete Rule" button per rule
- [ ] Add Targets panel per rule: list targets (ARN, ID) + add target dialog (target ARN + optional input JSON)
- [ ] Add "Put Event" dialog in bus detail: source, detail-type, detail JSON textarea
- [ ] Add API methods: `createRule`, `deleteRule`, `listRuleTargets`, `putRuleTargets`, `putEvent`

---

## Cognito Enhancements

**Backend file:** `backend/app/routers/resources/cognito.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/cognito/page.tsx`

### Backend Tasks
- [ ] `GET /user-pools/{pool_id}` — `describe_user_pool` → `{ id, name, status, mfa_configuration, schema[], policies, creation_date, estimated_number_of_users }`
- [ ] `POST /user-pools/{pool_id}/users/{username}/enable` — `admin_enable_user`
- [ ] `POST /user-pools/{pool_id}/users/{username}/disable` — `admin_disable_user`
- [ ] `POST /user-pools/{pool_id}/users/{username}/reset-password` — `admin_reset_user_password`
- [ ] `PUT /user-pools/{pool_id}/users/{username}` — `admin_update_user_attributes` body: `{ attributes: [{Name,Value}] }`
- [ ] `GET /user-pools/{pool_id}/app-clients` — `list_user_pool_clients` → `[{ client_id, client_name }]`
- [ ] `POST /user-pools/{pool_id}/app-clients` — `create_user_pool_client` body: `{ client_name, generate_secret?, explicit_auth_flows? }`

### Frontend Tasks
- [ ] Add user row actions: Enable / Disable / Reset Password buttons (role-gated)
- [ ] Add "Edit Attributes" dialog per user: key-value attribute list
- [ ] Add Pool Settings panel (click pool): MFA config, schema attributes, estimated user count
- [ ] Add App Clients tab per pool: list client ID + name, create client dialog
- [ ] Add API methods: `describeUserPool`, `enableUser`, `disableUser`, `resetUserPassword`, `updateUserAttributes`, `listAppClients`, `createAppClient`
