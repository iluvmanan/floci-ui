# 08-07: ECS, EKS, ECR, Auto Scaling

---

## ECS (Elastic Container Service)

**boto3 service:** `"ecs"`
**Backend file:** `backend/app/routers/resources/ecs.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/ecs/page.tsx`
**Nav entry:** `{ label: "ECS", href: "ecs", icon: Container }` under Compute group

### Backend Tasks

**Clusters:**
- [ ] `GET /clusters` — `list_clusters` + `describe_clusters(include=["STATISTICS","SETTINGS","TAGS"])` → `[{ cluster_arn, cluster_name, status, running_tasks_count, pending_tasks_count, active_services_count, registered_container_instances_count }]`
- [ ] `POST /clusters` — `create_cluster` body: `{ cluster_name, capacity_providers[]?, tags? }` → cluster object
- [ ] `DELETE /clusters/{name}` — `delete_cluster`

**Services:**
- [ ] `GET /clusters/{name}/services` — `list_services(cluster)` + `describe_services` → `[{ service_name, service_arn, status, desired_count, running_count, pending_count, task_definition, launch_type, created_at }]`
- [ ] `POST /clusters/{name}/services` — `create_service` body: `{ service_name, task_definition, desired_count, launch_type?: FARGATE|EC2, network_configuration? }` → service object
- [ ] `PUT /clusters/{name}/services/{svc}` — `update_service` body: `{ desired_count?, task_definition? }` → updated service
- [ ] `DELETE /clusters/{name}/services/{svc}` — `update_service(desiredCount=0)` then `delete_service`

**Tasks:**
- [ ] `GET /clusters/{name}/tasks` — `list_tasks(cluster)` + `describe_tasks` → `[{ task_arn, task_definition_arn, last_status, desired_status, started_at, stopped_at, stop_code, stopped_reason, containers }]`
- [ ] `POST /clusters/{name}/tasks/run` — `run_task` body: `{ task_definition, count?: 1, launch_type?: FARGATE|EC2, network_configuration? }` → `[{ task_arn, last_status }]`
- [ ] `POST /clusters/{name}/tasks/{arn:path}/stop` — `stop_task` body: `{ reason? }` → task object

**Task Definitions:**
- [ ] `GET /task-definitions` — `list_task_definitions(status=ACTIVE)` → grouped by family → `[{ family, revisions[], latest_arn }]`
- [ ] `GET /task-definitions/{family}` — `describe_task_definition` → full task def (containers, volumes, CPU, memory, network mode)
- [ ] `POST /task-definitions` — `register_task_definition` body: `{ family, container_definitions[], requires_compatibilities[]?, cpu?, memory?, network_mode?, task_role_arn?, execution_role_arn? }` → `{ family, revision, task_definition_arn }`
- [ ] `DELETE /task-definitions/{family}/{revision}` — `deregister_task_definition`

### Frontend Tasks
- [ ] Create `ecs/page.tsx`: left pane cluster list, right pane tabbed detail
- [ ] Cluster list: name, status badge, running tasks, active services + "Create Cluster" dialog (name, capacity providers)
- [ ] Cluster detail tabs: Services | Tasks | Settings
  - [ ] Services tab: table (name, desired/running/pending counts, task def, launch type) + "Create Service" dialog (task def dropdown from task definitions, desired count, launch type) + "Update" dialog (desired count, new task def) + "Delete" (sets desired=0 then deletes)
  - [ ] Tasks tab: table (task ARN short, status badge, task def, started/stopped) + "Run Task" dialog (task def, count, launch type) + "Stop Task" button
- [ ] Task Definitions panel (global, not per cluster): family list → click to see revisions → click revision → full JSON viewer + "Register New Revision" dialog (JSON editor for container definitions with validation)
- [ ] Add API methods: `listECSClusters`, `createECSCluster`, `deleteECSCluster`, `listECSServices`, `createECSService`, `updateECSService`, `deleteECSService`, `listECSTasks`, `runECSTask`, `stopECSTask`, `listTaskDefinitions`, `describeTaskDefinition`, `registerTaskDefinition`, `deregisterTaskDefinition`

---

## EKS (Elastic Kubernetes Service)

**boto3 service:** `"eks"`
**Backend file:** `backend/app/routers/resources/eks.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/eks/page.tsx`
**Nav entry:** `{ label: "EKS", href: "eks", icon: Layers }` under Compute group

### Backend Tasks
- [ ] `GET /clusters` — `list_clusters` + `describe_cluster` (batch) → `[{ name, arn, status, kubernetes_version, endpoint, role_arn, resources_vpc_config, created_at, tags }]`
- [ ] `POST /clusters` — `create_cluster` body: `{ name, version, role_arn, resources_vpc_config: { subnet_ids[], security_group_ids[]?, endpoint_public_access?, endpoint_private_access? } }` → `{ name, status }`
- [ ] `DELETE /clusters/{name}` — `delete_cluster`
- [ ] `GET /clusters/{name}` — `describe_cluster` → full details
- [ ] `GET /clusters/{name}/nodegroups` — `list_nodegroups` + `describe_nodegroup` (batch) → `[{ nodegroup_name, status, capacity_type, instance_types[], scaling_config, ami_type, disk_size, created_at }]`
- [ ] `POST /clusters/{name}/nodegroups` — `create_nodegroup` body: `{ nodegroup_name, node_role, subnets[], instance_types[]?, scaling_config: { min_size, max_size, desired_size }, ami_type?: AL2_x86_64, disk_size?: 20, capacity_type?: ON_DEMAND|SPOT }` → `{ nodegroup_name, status }`
- [ ] `DELETE /clusters/{name}/nodegroups/{ng}` — `delete_nodegroup`
- [ ] `PUT /clusters/{name}/nodegroups/{ng}` — `update_nodegroup_config` body: `{ scaling_config: { min_size, max_size, desired_size } }` → `{ update: { id, status } }`

### Frontend Tasks
- [ ] Create `eks/page.tsx`: cluster list + cluster detail panel
- [ ] Cluster table: Name, Status badge, K8s Version, Endpoint, Created
- [ ] "Create Cluster" dialog: name, Kubernetes version dropdown, IAM role ARN, subnet IDs (comma-separated), security group IDs, endpoint access toggles
- [ ] Click cluster → detail with tabs: Overview | Node Groups
  - [ ] Overview: endpoint with copy button, Kubernetes version, VPC config, IAM role
  - [ ] Node Groups tab: table (name, status, instance types, desired/min/max nodes, capacity type) + "Add Node Group" dialog + "Scale" dialog (update desired/min/max) + "Delete" button
- [ ] Delete cluster button (confirm cluster name)
- [ ] Add API methods: `listEKSClusters`, `createEKSCluster`, `deleteEKSCluster`, `getEKSCluster`, `listNodeGroups`, `createNodeGroup`, `deleteNodeGroup`, `updateNodeGroupScaling`

---

## ECR (Elastic Container Registry)

**boto3 service:** `"ecr"`
**Backend file:** `backend/app/routers/resources/ecr.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/ecr/page.tsx`
**Nav entry:** `{ label: "ECR", href: "ecr", icon: Box }` under Storage group

### Backend Tasks
- [ ] `GET /repositories` — `describe_repositories` → `[{ repository_name, repository_uri, registry_id, created_at, image_tag_mutability, image_scanning_configuration }]`
- [ ] `POST /repositories` — `create_repository` body: `{ repository_name, image_tag_mutability?: MUTABLE|IMMUTABLE, scan_on_push?: false, tags? }` → repo object
- [ ] `DELETE /repositories/{name}` — `delete_repository(force=True)`
- [ ] `GET /repositories/{name}/images` — `describe_images(repositoryName)` → `[{ image_digest, image_tags[], image_size_in_bytes, image_pushed_at, image_scan_status }]`
- [ ] `DELETE /repositories/{name}/images` — `batch_delete_image` body: `{ image_ids: [{ imageTag? | imageDigest? }] }`
- [ ] `GET /repositories/{name}/policy` — `get_repository_policy` → `{ policy_text }`
- [ ] `PUT /repositories/{name}/policy` — `set_repository_policy` body: `{ policy_text (JSON string) }`
- [ ] `DELETE /repositories/{name}/policy` — `delete_repository_policy`
- [ ] `GET /auth-token` — `get_authorization_token` → `{ authorization_token (base64 user:pass), proxy_endpoint, expires_at }` + decoded docker login command

### Frontend Tasks
- [ ] Create `ecr/page.tsx`: two-pane layout (repo list left, image browser right)
- [ ] Repo list: name, URI (truncated), image count, scan-on-push badge, mutability badge + "Create Repository" dialog + delete
- [ ] Click repo → image browser:
  - [ ] Table: Tags (comma-separated), Digest (truncated), Size (MB), Pushed At, Scan Status
  - [ ] Delete image button per row (confirm)
  - [ ] "Repository Policy" button → JSON editor dialog
- [ ] "Docker Login Command" button → dialog showing `docker login` command with copy button (uses auth-token endpoint)
- [ ] Add API methods: `listECRRepos`, `createECRRepo`, `deleteECRRepo`, `listECRImages`, `deleteECRImages`, `getECRPolicy`, `setECRPolicy`, `deleteECRPolicy`, `getECRAuthToken`

---

## Auto Scaling

**boto3 service:** `"autoscaling"`
**Backend file:** `backend/app/routers/resources/autoscaling.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/autoscaling/page.tsx`
**Nav entry:** `{ label: "Auto Scaling", href: "autoscaling", icon: TrendingUp }` under Compute group

### Backend Tasks
- [ ] `GET /groups` — `describe_auto_scaling_groups` → `[{ auto_scaling_group_name, min_size, max_size, desired_capacity, instances[], availability_zones, load_balancer_names, launch_template, launch_configuration_name, health_check_type, created_time }]`
- [ ] `POST /groups` — `create_auto_scaling_group` body: `{ auto_scaling_group_name, min_size, max_size, desired_capacity, availability_zones[], launch_template_id?, launch_template_version?: $Latest, launch_configuration_name? }` → 200
- [ ] `PUT /groups/{name}` — `update_auto_scaling_group` body: `{ min_size?, max_size?, desired_capacity? }` → 200
- [ ] `DELETE /groups/{name}` — `delete_auto_scaling_group(ForceDelete=True)`
- [ ] `POST /groups/{name}/capacity` — `set_desired_capacity` body: `{ desired_capacity }` → 200
- [ ] `GET /groups/{name}/activities` — `describe_scaling_activities(AutoScalingGroupName)` → `[{ activity_id, description, status_code, status_message, start_time, end_time, progress }]`
- [ ] `GET /policies` — `describe_policies(AutoScalingGroupName?)` → `[{ policy_name, policy_arn, policy_type, scaling_adjustment, adjustment_type, cooldown, estimated_instance_warmup }]`
- [ ] `POST /policies` — `put_scaling_policy` body: `{ policy_name, auto_scaling_group_name, policy_type?: SimpleScaling|TargetTrackingScaling, adjustment_type?: ChangeInCapacity|ExactCapacity|PercentChangeInCapacity, scaling_adjustment? }` → `{ policy_arn }`
- [ ] `DELETE /policies/{policy_name}` — `delete_policy`

### Frontend Tasks
- [ ] Create `autoscaling/page.tsx`: ASG list + detail panel
- [ ] Table: Name, Min/Desired/Max (compact "2/3/5" display), Running Instances, Health Check, Created
- [ ] "Create ASG" dialog: name, min/max/desired inputs, AZs multi-select, launch template ID + version
- [ ] Row actions: "Set Desired" quick dialog (single number input), "Edit" dialog (min/max/desired), "Delete" (with confirm)
- [ ] Click row → detail panel with tabs:
  - [ ] Instances tab: list running instances (instance ID, AZ, health status, lifecycle state)
  - [ ] Activity tab: scaling activity log table (description, status, start/end time, progress bar)
  - [ ] Scaling Policies tab: list policies + "Add Policy" dialog (type, adjustment type, scaling adjustment) + delete policy
- [ ] Add API methods: `listASGs`, `createASG`, `updateASG`, `deleteASG`, `setASGDesiredCapacity`, `getASGActivities`, `listScalingPolicies`, `createScalingPolicy`, `deleteScalingPolicy`
