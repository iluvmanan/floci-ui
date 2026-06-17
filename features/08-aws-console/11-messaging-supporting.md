# 08-11: SES, MSK, Cloud Map, AWS Config, Resource Groups Tagging, Cost Explorer, Pricing

---

## SES (Simple Email Service)

**boto3 service:** `"ses"` (v1) + `"sesv2"` for SES v2 endpoints
**Backend file:** `backend/app/routers/resources/ses.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/ses/page.tsx`
**Nav entry:** `{ label: "SES", href: "ses", icon: Mail }` under Other group

### Backend Tasks
- [ ] `GET /identities` — `list_identities(IdentityType=EmailAddress|Domain)` + `get_identity_verification_attributes` → `[{ identity, verification_status, verification_token? }]`
- [ ] `POST /identities/email` — `verify_email_identity` body: `{ email_address }` → 200 (sends verification email)
- [ ] `POST /identities/domain` — `verify_domain_identity` body: `{ domain }` → `{ verification_token }` (add as TXT record)
- [ ] `DELETE /identities/{identity}` — `delete_identity`
- [ ] `GET /templates` — `list_templates` + `get_template` (batch) → `[{ name, subject_part, html_part, text_part }]`
- [ ] `POST /templates` — `create_template` body: `{ name, subject_part, html_part?, text_part?, description? }` → 200
- [ ] `DELETE /templates/{name}` — `delete_template`
- [ ] `POST /send` — `send_email` body: `{ source, destinations: [string], subject, body_text?, body_html? }` → `{ message_id }`
- [ ] `POST /send-template` — `send_templated_email` body: `{ source, destinations, template, template_data (JSON string of vars) }` → `{ message_id }`
- [ ] `GET /statistics` — `get_send_statistics` → `[{ timestamp, delivery_attempts, bounces, complaints, rejects }]`
- [ ] `GET /quota` — `get_send_quota` → `{ max_24_hour_send, max_send_rate, sent_last_24_hours }`

### Frontend Tasks
- [ ] Create `ses/page.tsx` with tabs: Identities | Templates | Send Email | Statistics
- [ ] Identities tab:
  - [ ] Table: Identity, Type badge (Email/Domain), Verification Status badge (Success=green/Pending=yellow/Failed=red)
  - [ ] "Verify Email" dialog: email address input (sends verification email)
  - [ ] "Verify Domain" dialog: domain input → show TXT record to add in DNS with copy button
  - [ ] Delete identity button
- [ ] Templates tab:
  - [ ] Table: Name, Subject preview
  - [ ] "Create Template" dialog: name, subject, HTML body (textarea), text body (textarea)
  - [ ] Click template → preview (HTML rendered in iframe)
  - [ ] Delete button
- [ ] Send Email tab:
  - [ ] Source (from verified identity dropdown), To (multi-email input), Subject, Body (text/HTML toggle)
  - [ ] Template picker alternative (select template + JSON data vars)
  - [ ] "Send" button → shows Message ID on success
- [ ] Statistics tab: simple bar chart (delivery/bounce/complaint counts per day, last 14 days) + Quota display (sent / max 24hr)
- [ ] Add API methods: `listSESIdentities`, `verifySESEmail`, `verifySESDomain`, `deleteSESIdentity`, `listSESTemplates`, `createSESTemplate`, `deleteSESTemplate`, `sendSESEmail`, `sendSESTemplatedEmail`, `getSESStatistics`, `getSESQuota`

---

## MSK (Managed Streaming for Kafka)

**boto3 service:** `"kafka"`
**Backend file:** `backend/app/routers/resources/msk.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/msk/page.tsx`
**Nav entry:** `{ label: "MSK", href: "msk", icon: Layers }` under Messaging group

### Backend Tasks
- [ ] `GET /clusters` — `list_clusters_v2` + `describe_cluster_v2` (batch) → `[{ cluster_arn, cluster_name, cluster_type, state, current_version, created_at, cluster_info }]`
- [ ] `POST /clusters` — `create_cluster_v2` body: `{ cluster_name, cluster_type?: PROVISIONED|SERVERLESS, provisioned?: { broker_node_group_info: { instance_type, client_subnets[], storage_info }, kafka_version, number_of_broker_nodes }, serverless?: { vpc_configs: [{ subnet_ids, security_group_ids }] } }` → `{ cluster_arn, state }`
- [ ] `DELETE /clusters/{arn:path}` — `delete_cluster`
- [ ] `GET /clusters/{arn:path}` — `describe_cluster_v2` → full details
- [ ] `GET /clusters/{arn:path}/bootstrap-brokers` — `get_bootstrap_brokers` → `{ bootstrap_broker_string, bootstrap_broker_string_tls?, bootstrap_broker_string_sasl_iam? }`

### Frontend Tasks
- [ ] Create `msk/page.tsx`: cluster list
- [ ] Table: Name, Type badge (Provisioned/Serverless), State badge, Created
- [ ] "Create Cluster" dialog:
  - [ ] Cluster type radio: Provisioned / Serverless
  - [ ] Provisioned: name, Kafka version, instance type, broker count, subnet IDs
  - [ ] Serverless: name, VPC subnet IDs, security group IDs
- [ ] Click cluster → detail panel:
  - [ ] Bootstrap brokers (plaintext + TLS + SASL) with copy buttons
  - [ ] Cluster info: version, brokers, storage, state
- [ ] Delete cluster button
- [ ] Add API methods: `listMSKClusters`, `createMSKCluster`, `deleteMSKCluster`, `getMSKCluster`, `getMSKBootstrapBrokers`

---

## Cloud Map (Service Discovery)

**boto3 service:** `"servicediscovery"`
**Backend file:** `backend/app/routers/resources/cloudmap.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/cloudmap/page.tsx`
**Nav entry:** `{ label: "Cloud Map", href: "cloudmap", icon: Network }` under Other group

### Backend Tasks
- [ ] `GET /namespaces` — `list_namespaces` → `[{ id, name, type: DNS_PRIVATE|DNS_PUBLIC|HTTP, description, create_date, properties }]`
- [ ] `POST /namespaces/http` — `create_http_namespace` body: `{ name, description? }` → `{ operation_id }`
- [ ] `POST /namespaces/dns-private` — `create_private_dns_namespace` body: `{ name, vpc, description? }` → `{ operation_id }`
- [ ] `DELETE /namespaces/{id}` — `delete_namespace` → `{ operation_id }`
- [ ] `GET /services` — `list_services(Filters=[{Name:NAMESPACE_ID,Values:[id]}]?)` → `[{ id, name, namespace_id, description, instance_count, create_date, routing_policy }]`
- [ ] `POST /services` — `create_service` body: `{ name, namespace_id, description?, routing_policy?: MULTIVALUE|WEIGHTED, dns_config?: { dns_records: [{type:A|AAAA|CNAME|SRV,ttl}] }, health_check_config? }` → service object
- [ ] `DELETE /services/{id}` — `delete_service`
- [ ] `GET /services/{id}/instances` — `list_instances` → `[{ id, attributes: {} }]`
- [ ] `POST /services/{id}/instances/{instance_id}` — `register_instance` body: `{ attributes: { AWS_IPV4_ADDRESS?, AWS_PORT?, etc. } }` → `{ operation_id }`
- [ ] `DELETE /services/{id}/instances/{instance_id}` — `deregister_instance`

### Frontend Tasks
- [ ] Create `cloudmap/page.tsx` with three-pane layout: Namespaces | Services | Instances
- [ ] Namespaces: list (name, type badge, description) + "Create HTTP Namespace" dialog + "Create Private DNS Namespace" dialog (needs VPC ID) + delete
- [ ] Services: filtered by selected namespace (name, instance count, routing policy) + "Create Service" dialog (name, routing policy, DNS record type + TTL) + delete
- [ ] Instances: for selected service, table (instance ID, IP, port, attributes JSON) + "Register Instance" dialog (instance ID, IP, port, custom attributes) + deregister
- [ ] Add API methods: `listCloudMapNamespaces`, `createHTTPNamespace`, `createPrivateDNSNamespace`, `deleteNamespace`, `listCloudMapServices`, `createCloudMapService`, `deleteCloudMapService`, `listServiceInstances`, `registerInstance`, `deregisterInstance`

---

## AWS Config

**boto3 service:** `"config"`
**Backend file:** `backend/app/routers/resources/awsconfig.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/awsconfig/page.tsx`
**Nav entry:** `{ label: "AWS Config", href: "awsconfig", icon: ClipboardCheck }` under Other group

### Backend Tasks
- [ ] `GET /recorders` — `describe_configuration_recorders` + `describe_configuration_recorder_status` → `[{ name, role_arn, all_supported, include_global_resource_types, recording: bool, last_status, last_error_code, last_status_change_time }]`
- [ ] `POST /recorders` — `put_configuration_recorder` body: `{ name, role_arn, recording_group: { all_supported?: true, include_global_resource_types?: true, resource_types[]? } }` → 200
- [ ] `POST /recorders/{name}/start` — `start_configuration_recorder`
- [ ] `POST /recorders/{name}/stop` — `stop_configuration_recorder`
- [ ] `GET /rules` — `describe_config_rules` → `[{ config_rule_name, config_rule_arn, config_rule_state, description, source: { owner, source_identifier } }]`
- [ ] `POST /rules` — `put_config_rule` body: `{ config_rule_name, description?, scope?, source: { owner: AWS|CUSTOM_LAMBDA, source_identifier (managed rule name or Lambda ARN) }, input_parameters? }` → 200
- [ ] `DELETE /rules/{name}` — `delete_config_rule`
- [ ] `GET /compliance` — `describe_compliance_by_config_rule(ConfigRuleNames[]?)` → `[{ config_rule_name, compliance: { compliance_type: COMPLIANT|NON_COMPLIANT|NOT_APPLICABLE|INSUFFICIENT_DATA, compliance_contributor_count } }]`
- [ ] `GET /resources` — `list_discovered_resources` body: `resource_type?: string` → `[{ resource_type, resource_id, resource_name }]`

### Frontend Tasks
- [ ] Create `awsconfig/page.tsx` with tabs: Recorder | Rules | Resource Inventory
- [ ] Recorder tab: recorder status (recording badge green/grey) + start/stop button + IAM role + scope config form
- [ ] Rules tab:
  - [ ] Table: Rule Name, Source (AWS Managed / Custom Lambda), State badge, Compliance (badge: COMPLIANT=green/NON_COMPLIANT=red/INSUFFICIENT_DATA=grey)
  - [ ] "Add Rule" dialog: rule name, type (Managed: searchable rule list from AWS built-ins / Custom: Lambda ARN), description
  - [ ] "Delete" button per rule
- [ ] Resource Inventory tab: resource type filter dropdown + resource table (type, ID, name)
- [ ] Add API methods: `listConfigRecorders`, `putConfigRecorder`, `startConfigRecorder`, `stopConfigRecorder`, `listConfigRules`, `putConfigRule`, `deleteConfigRule`, `getConfigCompliance`, `listDiscoveredResources`

---

## Resource Groups Tagging

**boto3 service:** `"resourcegroupstaggingapi"`
**Backend file:** `backend/app/routers/resources/tagging.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/tagging/page.tsx`
**Nav entry:** `{ label: "Resource Tagging", href: "tagging", icon: Tag }` under Other group

### Backend Tasks
- [ ] `GET /resources` — `get_resources(TagFilters[]?, ResourceTypeFilters[]?)` → `[{ resource_arn, tags: [{Key,Value}] }]`
- [ ] `GET /tag-keys` — `get_tag_keys` → `[string]`
- [ ] `GET /tag-values/{key}` — `get_tag_values(Key)` → `[string]`
- [ ] `POST /resources/tag` — `tag_resources` body: `{ resource_arns: [], tags: {Key:Value} }` → `{ failed_resources_map: {} }`
- [ ] `POST /resources/untag` — `untag_resources` body: `{ resource_arns: [], tag_keys: [] }` → `{ failed_resources_map: {} }`

### Frontend Tasks
- [ ] Create `tagging/page.tsx`:
  - [ ] Filter bar: tag key dropdown (from getTagKeys) + tag value dropdown (from getTagValues, filtered by key) + resource type multi-select + "Search" button
  - [ ] Results table: Resource ARN (truncated, copy button), Resource Type badge, Tags (pill list with key=value)
  - [ ] Row selection checkboxes for bulk operations
  - [ ] "Add Tags" button (to selected resources): key-value pair inputs + apply
  - [ ] "Remove Tags" button (to selected resources): tag key multi-select + apply
  - [ ] "Clear Filters" button
- [ ] Add API methods: `getTaggedResources`, `getTagKeys`, `getTagValues`, `tagResources`, `untagResources`

---

## Cost Explorer

**boto3 service:** `"ce"` (Note: Floci implements this endpoint)
**Backend file:** `backend/app/routers/resources/costexplorer.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/costexplorer/page.tsx`
**Nav entry:** `{ label: "Cost Explorer", href: "costexplorer", icon: DollarSign }` under Analytics group

### Backend Tasks
- [ ] `POST /cost-and-usage` — `get_cost_and_usage` body: `{ time_period: { start, end }, granularity: DAILY|MONTHLY|HOURLY, group_by: [{type: DIMENSION|TAG, key: SERVICE|USAGE_TYPE|LINKED_ACCOUNT|TAG_KEY}]?, filter?, metrics: [UnblendedCost|BlendedCost|UsageQuantity] }` → `{ results_by_time: [{ time_period, total, groups[] }] }`
- [ ] `POST /cost-forecast` — `get_cost_forecast` body: `{ time_period: { start, end }, granularity, metric }` → `{ total, forecast_results_by_time[] }`
- [ ] `GET /tags` — `list_cost_allocation_tags(Status=Active)` → `[{ tag_key, status }]`

### Frontend Tasks
- [ ] Create `costexplorer/page.tsx`:
  - [ ] Controls bar: date range picker (start/end), granularity radio (Daily/Monthly), group by dropdown (Service/Usage Type/Account), metric selector
  - [ ] "Get Cost Data" button → bar chart (recharts BarChart, already used in monitoring) showing cost per period, colored per group-by value
  - [ ] Data table below chart: period | group | cost (USD) | unit
  - [ ] "Forecast" section: date range for future period → line chart showing forecasted cost with confidence interval
  - [ ] Cost Allocation Tags tab: list of active tags
- [ ] Add API methods: `getCostAndUsage`, `getCostForecast`, `listCostAllocationTags`

---

## Pricing

**boto3 service:** `"pricing"` (must use us-east-1 endpoint for real AWS; Floci may expose this)
**Backend file:** `backend/app/routers/resources/pricing.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/pricing/page.tsx`
**Nav entry:** `{ label: "Pricing", href: "pricing", icon: PieChart }` under Analytics group

### Backend Tasks
- [ ] `GET /services` — `describe_services(FormatVersion=aws_v1)` → `[{ service_code, attribute_names[] }]`
- [ ] `GET /services/{code}/attribute-values/{attr}` — `get_attribute_values(ServiceCode, AttributeName)` → `[string]` (for filter dropdowns)
- [ ] `POST /products` — `get_products` body: `{ service_code, filters: [{type:TERM_MATCH, field, value}]?, format_version?: aws_v1, max_results?: 20 }` → parsed price list `[{ sku, product_family, attributes: {}, terms: { on_demand: {price_per_unit, unit, description} } }]`

### Frontend Tasks
- [ ] Create `pricing/page.tsx`:
  - [ ] Service selector dropdown (from describe_services)
  - [ ] Dynamic attribute filters: once service selected, show key attribute filter inputs (instance type, region, OS, etc.)
  - [ ] "Search Prices" button → results table (SKU, Product Family, Description, Price per Unit, Unit)
  - [ ] Export to CSV button for results
- [ ] Add API methods: `listPricingServices`, `getPricingAttributeValues`, `searchPriceList`
