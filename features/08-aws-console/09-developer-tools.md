# 08-09: CloudFormation, Step Functions, AppSync, AppConfig, CodeBuild, CodeDeploy, Backup, Transfer Family

---

## CloudFormation

**boto3 service:** `"cloudformation"`
**Backend file:** `backend/app/routers/resources/cfn.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/cfn/page.tsx`
**Nav entry:** `{ label: "CloudFormation", href: "cfn", icon: Layers2 }` under Developer group

### Backend Tasks
- [ ] `GET /stacks` — `list_stacks(StackStatusFilter=[all except DELETE_COMPLETE])` + `describe_stacks` → `[{ stack_name, stack_id, stack_status, creation_time, last_updated_time, description, outputs[], parameters[], tags }]`
- [ ] `POST /stacks` — `create_stack` body: `{ stack_name, template_body?: string, template_url?: string, parameters?: [{key,value}], capabilities?: [CAPABILITY_IAM,CAPABILITY_NAMED_IAM], tags? }` → `{ stack_id }`
- [ ] `PUT /stacks/{name}` — `update_stack` body: `{ template_body?, template_url?, parameters?, capabilities? }` → `{ stack_id }`
- [ ] `DELETE /stacks/{name}` — `delete_stack`
- [ ] `GET /stacks/{name}` — `describe_stacks` → full stack details (outputs, params, status reason)
- [ ] `GET /stacks/{name}/events` — `describe_stack_events` → `[{ event_id, resource_type, logical_resource_id, physical_resource_id, resource_status, resource_status_reason, timestamp }]`
- [ ] `GET /stacks/{name}/resources` — `list_stack_resources` → `[{ logical_resource_id, physical_resource_id, resource_type, resource_status, last_updated_timestamp }]`
- [ ] `GET /stacks/{name}/template` — `get_template` → `{ template_body: string }`

### Frontend Tasks
- [ ] Create `cfn/page.tsx`: stack list + detail panel
- [ ] Table: Name, Status (badge with color per status group), Creation Time, Updated, Description
- [ ] "Create Stack" dialog with tabs:
  - [ ] Template: paste YAML/JSON or S3 URL radio
  - [ ] Parameters: dynamic form generated from template `Parameters` section
  - [ ] Options: stack name, tags, capabilities checkboxes
- [ ] "Update Stack" dialog: same structure, pre-populated
- [ ] "Delete Stack" button (confirm stack name)
- [ ] Click stack → detail panel with tabs:
  - [ ] Overview: status, parameters list, outputs table (key/value/export name)
  - [ ] Events tab: chronological event table with colored status badges, auto-refresh during IN_PROGRESS states
  - [ ] Resources tab: table (logical ID, physical ID, type, status)
  - [ ] Template tab: read-only syntax-highlighted template viewer
- [ ] Status color map: `*_COMPLETE`=green, `*_IN_PROGRESS`=yellow, `*_FAILED`=red, `*_ROLLBACK*`=orange
- [ ] Add API methods: `listStacks`, `createStack`, `updateStack`, `deleteStack`, `describeStack`, `getStackEvents`, `getStackResources`, `getStackTemplate`

---

## Step Functions

**boto3 service:** `"stepfunctions"`
**Backend file:** `backend/app/routers/resources/stepfunctions.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/stepfunctions/page.tsx`
**Nav entry:** `{ label: "Step Functions", href: "stepfunctions", icon: GitMerge }` under Developer group

### Backend Tasks
- [ ] `GET /state-machines` — `list_state_machines` → `[{ state_machine_arn, name, type, creation_date }]`
- [ ] `POST /state-machines` — `create_state_machine` body: `{ name, definition (JSON string), role_arn, type?: STANDARD|EXPRESS, logging_configuration?, tracing_configuration? }` → `{ state_machine_arn, creation_date }`
- [ ] `DELETE /state-machines/{arn:path}` — `delete_state_machine`
- [ ] `GET /state-machines/{arn:path}` — `describe_state_machine` → `{ definition (JSON string), role_arn, status, type, creation_date, logging }`
- [ ] `PUT /state-machines/{arn:path}` — `update_state_machine` body: `{ definition?, role_arn? }` → `{ update_date }`
- [ ] `GET /state-machines/{arn:path}/executions` — `list_executions` → `[{ execution_arn, name, status, start_date, stop_date }]`
- [ ] `POST /state-machines/{arn:path}/executions` — `start_execution` body: `{ input?: string (JSON), name? }` → `{ execution_arn, start_date }`
- [ ] `POST /executions/{arn:path}/stop` — `stop_execution` body: `{ cause?, error? }` → `{ stop_date }`
- [ ] `GET /executions/{arn:path}` — `describe_execution` → `{ status, input, output, start_date, stop_date, input_details, output_details }`

### Frontend Tasks
- [ ] Create `stepfunctions/page.tsx`: state machine list + detail panel
- [ ] Table: Name, Type badge (STANDARD/EXPRESS), ARN, Created
- [ ] "Create State Machine" dialog: name, type radio, role ARN, ASL definition JSON editor with syntax validation
- [ ] "Edit Definition" dialog: same JSON editor, pre-populated
- [ ] "Delete" button (confirm)
- [ ] Click state machine → detail panel with tabs:
  - [ ] Definition tab: read-only ASL JSON viewer
  - [ ] Executions tab: table (execution name, status badge, started, stopped) + "Start Execution" button (input JSON editor + optional name) + "Stop" button per in-progress execution
  - [ ] Execution Detail: click execution → show input/output side-by-side, status timeline
- [ ] Add API methods: `listStateMachines`, `createStateMachine`, `deleteStateMachine`, `describeStateMachine`, `updateStateMachine`, `listExecutions`, `startExecution`, `stopExecution`, `describeExecution`

---

## AppSync

**boto3 service:** `"appsync"`
**Backend file:** `backend/app/routers/resources/appsync.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/appsync/page.tsx`
**Nav entry:** `{ label: "AppSync", href: "appsync", icon: Webhook }` under Developer group

### Backend Tasks
- [ ] `GET /apis` — `list_graphql_apis` → `[{ api_id, name, authentication_type, uris, arn, tags }]`
- [ ] `POST /apis` — `create_graphql_api` body: `{ name, authentication_type: API_KEY|AWS_IAM|AMAZON_COGNITO_USER_POOLS|OPENID_CONNECT, user_pool_config?, open_id_connect_config?, tags? }` → api object
- [ ] `DELETE /apis/{api_id}` — `delete_graphql_api`
- [ ] `GET /apis/{api_id}/schema` — `get_introspection_schema(format=SDL)` → schema SDL string
- [ ] `GET /apis/{api_id}/datasources` — `list_data_sources` → `[{ name, type, description, service_role_arn, dynamodb_config?, lambda_config?, elasticsearch_config? }]`
- [ ] `POST /apis/{api_id}/datasources` — `create_data_source` body: `{ name, type: AMAZON_DYNAMODB|AWS_LAMBDA|AMAZON_OPENSEARCH|HTTP|NONE, description?, dynamodb_config?, lambda_config?, service_role_arn? }` → data source object
- [ ] `DELETE /apis/{api_id}/datasources/{name}` — `delete_data_source`
- [ ] `GET /apis/{api_id}/types` — `list_types(format=SDL)` → `[{ name, definition }]`

### Frontend Tasks
- [ ] Create `appsync/page.tsx`: API list + detail panel
- [ ] Table: Name, Auth Type badge, GraphQL URL, API ID
- [ ] "Create API" dialog: name, auth type dropdown
- [ ] Click API → detail panel with tabs:
  - [ ] Schema tab: SDL schema viewer (read-only monospace with syntax highlighting)
  - [ ] Data Sources tab: list + "Create Data Source" dialog (name, type, config per type) + delete
  - [ ] Types tab: list of GraphQL types from schema
  - [ ] Settings: endpoint URL with copy button, auth config
- [ ] Add API methods: `listAppSyncAPIs`, `createAppSyncAPI`, `deleteAppSyncAPI`, `getAppSyncSchema`, `listDataSources`, `createDataSource`, `deleteDataSource`

---

## AppConfig

**boto3 service:** `"appconfig"` + `"appconfigdata"`
**Backend file:** `backend/app/routers/resources/appconfig.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/appconfig/page.tsx`
**Nav entry:** `{ label: "AppConfig", href: "appconfig", icon: Settings2 }` under Developer group

### Backend Tasks
- [ ] `GET /applications` — `list_applications` → `[{ id, name, description }]`
- [ ] `POST /applications` — `create_application` body: `{ name, description? }` → app object
- [ ] `DELETE /applications/{id}` — `delete_application`
- [ ] `GET /applications/{id}/environments` — `list_environments` → `[{ id, application_id, name, state, description }]`
- [ ] `POST /applications/{id}/environments` — `create_environment` body: `{ name, description? }` → env object
- [ ] `DELETE /applications/{id}/environments/{env_id}` — `delete_environment`
- [ ] `GET /applications/{id}/configurationprofiles` — `list_configuration_profiles` → `[{ id, application_id, name, location_uri, validator_types }]`
- [ ] `POST /applications/{id}/configurationprofiles` — `create_configuration_profile` body: `{ name, location_uri: hosted, validator_types[]? }` → profile object
- [ ] `POST /applications/{id}/deployments` — `start_deployment` body: `{ environment_id, configuration_profile_id, deployment_strategy_id?, configuration_version? }` → `{ deployment_number, state }`
- [ ] `GET /applications/{id}/environments/{env_id}/deployments` — `list_deployments` → `[{ deployment_number, state, configuration_profile_id, deployment_strategy_id, started_at, completed_at }]`

### Frontend Tasks
- [ ] Create `appconfig/page.tsx` with tabs: Applications | Environments | Profiles | Deployments
- [ ] Applications tab: list + create dialog + delete
- [ ] Environments tab (filtered by selected application): list (name, state badge) + create + delete
- [ ] Configuration Profiles tab: list + create dialog (name, location URI type)
- [ ] Deployments tab: list per app+env (deployment number, state badge, profile, started) + "Start Deployment" dialog (select environment, profile, version)
- [ ] Add API methods: `listAppConfigApps`, `createAppConfigApp`, `deleteAppConfigApp`, `listAppConfigEnvs`, `createAppConfigEnv`, `deleteAppConfigEnv`, `listConfigProfiles`, `createConfigProfile`, `startDeployment`, `listDeployments`

---

## CodeBuild

**boto3 service:** `"codebuild"`
**Backend file:** `backend/app/routers/resources/codebuild.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/codebuild/page.tsx`
**Nav entry:** `{ label: "CodeBuild", href: "codebuild", icon: Hammer }` under Developer group

### Backend Tasks
- [ ] `GET /projects` — `list_projects` + `batch_get_projects` → `[{ name, arn, description, source_type, source_location, environment_type, environment_image, compute_type, service_role, created, last_modified }]`
- [ ] `POST /projects` — `create_project` body: `{ name, source: { type: GITHUB|S3|CODECOMMIT|BITBUCKET|NO_SOURCE, location? }, environment: { type: LINUX_CONTAINER, image, compute_type }, artifacts: { type: NO_ARTIFACTS|S3 }, service_role }` → project object
- [ ] `DELETE /projects/{name}` — `delete_project`
- [ ] `POST /projects/{name}/build` — `start_build` body: `{ environment_variables_override?: [{name,value,type}], source_version? }` → `{ build_id, build_status, start_time }`
- [ ] `GET /projects/{name}/builds` — `list_builds_for_project` → build IDs → `batch_get_builds` → `[{ id, build_status, start_time, end_time, current_phase, duration_in_seconds, initiator, logs }]`
- [ ] `GET /builds/{id}` — `batch_get_builds` → full build details (phases, logs location, artifacts)

### Frontend Tasks
- [ ] Create `codebuild/page.tsx`: project list + build history per project
- [ ] Table: Name, Source Type badge, Compute Type, Last Build Status badge, Last Modified
- [ ] "Create Project" dialog: name, source type, source location, environment (type + image + compute type), artifacts, IAM role
- [ ] "Start Build" button per project → optional env var overrides dialog
- [ ] Click project → build history table (ID, status badge, started, duration, initiator) + "View Logs" link (CloudWatch URL)
- [ ] Delete project button
- [ ] Add API methods: `listCodeBuildProjects`, `createCodeBuildProject`, `deleteCodeBuildProject`, `startBuild`, `listBuilds`, `getBuild`

---

## CodeDeploy

**boto3 service:** `"codedeploy"`
**Backend file:** `backend/app/routers/resources/codedeploy.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/codedeploy/page.tsx`
**Nav entry:** `{ label: "CodeDeploy", href: "codedeploy", icon: Rocket }` under Developer group

### Backend Tasks
- [ ] `GET /applications` — `list_applications` + `get_application` (batch) → `[{ application_id, application_name, compute_platform, linked_to_github, create_time }]`
- [ ] `POST /applications` — `create_application` body: `{ application_name, compute_platform?: Server|Lambda|ECS }` → `{ application_id }`
- [ ] `DELETE /applications/{name}` — `delete_application`
- [ ] `GET /applications/{name}/groups` — `list_deployment_groups` + `get_deployment_group` (batch) → `[{ deployment_group_id, deployment_group_name, deployment_config_name, target_revision }]`
- [ ] `POST /applications/{name}/groups` — `create_deployment_group` body: `{ deployment_group_name, service_role_arn, deployment_config_name?, ec2_tag_filters[]?, auto_scaling_groups[]? }` → `{ deployment_group_id }`
- [ ] `POST /deployments` — `create_deployment` body: `{ application_name, deployment_group_name, revision: { revision_type: S3|GitHub, s3_location?: {bucket,key,bundle_type} }, description? }` → `{ deployment_id }`
- [ ] `GET /applications/{name}/deployments` — `list_deployments(applicationName, deploymentGroupName?)` → deployment IDs → `batch_get_deployments` → `[{ deployment_id, status, deployment_group_name, deployment_config_name, created_at, complete_at, description }]`
- [ ] `GET /deployments/{id}` — `get_deployment` → full details (instance summary, errors, lifecycle events)

### Frontend Tasks
- [ ] Create `codedeploy/page.tsx`: app list + detail panel
- [ ] Table: Name, Platform badge, Created
- [ ] "Create Application" dialog: name, compute platform radio
- [ ] Click app → detail panel with tabs:
  - [ ] Deployment Groups tab: list + "Create Group" dialog (name, role, config, EC2 tag filters)
  - [ ] Deployments tab: list (ID, group, status badge, created, completed) + "Create Deployment" dialog (group selector, revision location S3 bucket+key) + click to see deployment details (instance count, lifecycle events)
- [ ] Add API methods: `listCodeDeployApps`, `createCodeDeployApp`, `deleteCodeDeployApp`, `listDeploymentGroups`, `createDeploymentGroup`, `createDeployment`, `listDeployments`, `getDeployment`

---

## AWS Backup

**boto3 service:** `"backup"`
**Backend file:** `backend/app/routers/resources/backup.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/backup/page.tsx`
**Nav entry:** `{ label: "Backup", href: "backup", icon: Archive }` under Storage group

### Backend Tasks
- [ ] `GET /vaults` — `list_backup_vaults` → `[{ backup_vault_name, backup_vault_arn, creation_date, number_of_recovery_points, encryption_key_arn }]`
- [ ] `POST /vaults` — `create_backup_vault` body: `{ backup_vault_name, encryption_key_arn? (KMS), tags? }` → `{ backup_vault_name, backup_vault_arn }`
- [ ] `DELETE /vaults/{name}` — `delete_backup_vault`
- [ ] `GET /plans` — `list_backup_plans` → `[{ backup_plan_id, backup_plan_name, creation_date, last_execution_date, rules_count }]`
- [ ] `POST /plans` — `create_backup_plan` body: `{ backup_plan_name, rules: [{ rule_name, target_vault_name, schedule_expression?, start_window_minutes?, completion_window_minutes?, lifecycle: { delete_after_days } }] }` → `{ backup_plan_id, backup_plan_arn }`
- [ ] `DELETE /plans/{id}` — `delete_backup_plan`
- [ ] `GET /jobs/backup` — `list_backup_jobs(ByState?)` → `[{ backup_job_id, resource_arn, resource_type, backup_vault_name, state, percent_done, start_by, creation_date, completion_date }]`
- [ ] `POST /jobs/backup` — `start_backup_job` body: `{ backup_vault_name, resource_arn, iam_role_arn, start_window_minutes?, lifecycle? }` → `{ backup_job_id, creation_date }`
- [ ] `GET /vaults/{name}/recovery-points` — `list_recovery_points_by_backup_vault` → `[{ recovery_point_arn, resource_arn, resource_type, creation_date, status, backup_size_in_bytes }]`

### Frontend Tasks
- [ ] Create `backup/page.tsx` with tabs: Vaults | Backup Plans | Jobs | Recovery Points
- [ ] Vaults tab: list (name, ARN, recovery point count, created) + create dialog (name, KMS key optional) + delete
- [ ] Backup Plans tab: list (name, created, last run, rules count) + create dialog (name + rule builder: vault selector, cron schedule, retention days) + delete
- [ ] Jobs tab: list (job ID, resource ARN, type, vault, status badge, progress %, created) + "Start Backup Job" dialog (vault selector, resource ARN, IAM role)
- [ ] Recovery Points tab: select vault from dropdown → list recovery points (ARN, resource, type, created, size, status)
- [ ] Add API methods: `listBackupVaults`, `createBackupVault`, `deleteBackupVault`, `listBackupPlans`, `createBackupPlan`, `deleteBackupPlan`, `listBackupJobs`, `startBackupJob`, `listRecoveryPoints`

---

## Transfer Family

**boto3 service:** `"transfer"`
**Backend file:** `backend/app/routers/resources/transfer.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/transfer/page.tsx`
**Nav entry:** `{ label: "Transfer Family", href: "transfer", icon: ArrowRightLeft }` under Other group

### Backend Tasks
- [ ] `GET /servers` — `list_servers` + `describe_server` (batch) → `[{ server_id, arn, protocols[], endpoint_type, state, user_count, identity_provider_type, endpoint }]`
- [ ] `POST /servers` — `create_server` body: `{ protocols: [SFTP|FTP|FTPS], endpoint_type?: PUBLIC|VPC, identity_provider_type?: SERVICE_MANAGED|API_GATEWAY, tags? }` → `{ server_id }`
- [ ] `DELETE /servers/{id}` — `delete_server`
- [ ] `POST /servers/{id}/start` — `start_server`
- [ ] `POST /servers/{id}/stop` — `stop_server`
- [ ] `GET /servers/{id}/users` — `list_users` + `describe_user` (batch) → `[{ user_name, role, home_directory, home_directory_type, ssh_public_key_count }]`
- [ ] `POST /servers/{id}/users` — `create_user` body: `{ user_name, role, home_directory?: /bucket/prefix, ssh_public_key_body? }` → `{ server_id, user_name }`
- [ ] `DELETE /servers/{id}/users/{username}` — `delete_user`

### Frontend Tasks
- [ ] Create `transfer/page.tsx`: server list + users panel
- [ ] Server table: ID, Protocols badges, Endpoint Type, State (badge: ONLINE=green/OFFLINE=grey/STARTING=yellow), User Count
- [ ] "Create Server" dialog: protocols multi-select, endpoint type, identity provider
- [ ] Server actions: Start / Stop / Delete
- [ ] Click server → Users panel:
  - [ ] Table: Username, Home Directory, Role, SSH Keys count
  - [ ] "Create User" dialog: username, IAM role ARN, home directory, paste SSH public key
  - [ ] Delete user button
- [ ] Add API methods: `listTransferServers`, `createTransferServer`, `deleteTransferServer`, `startTransferServer`, `stopTransferServer`, `listTransferUsers`, `createTransferUser`, `deleteTransferUser`
