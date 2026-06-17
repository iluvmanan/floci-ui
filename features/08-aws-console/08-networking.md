# 08-08: Route 53, CloudFront, ELB v2, ACM

---

## Route 53

**boto3 service:** `"route53"`
**Backend file:** `backend/app/routers/resources/route53.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/route53/page.tsx`
**Nav entry:** `{ label: "Route 53", href: "route53", icon: Map }` under Networking group

### Backend Tasks
- [ ] `GET /hosted-zones` — `list_hosted_zones` → `[{ id, name, config: { comment, private_zone }, resource_record_set_count }]`
- [ ] `POST /hosted-zones` — `create_hosted_zone` body: `{ name, private_zone?: false, vpc_id? (required if private), comment? }` → `{ id, name, nameservers[] }`
- [ ] `DELETE /hosted-zones/{id}` — `delete_hosted_zone` (must delete all non-NS/SOA records first)
- [ ] `GET /hosted-zones/{id}/record-sets` — `list_resource_record_sets` → `[{ name, type, ttl, records[], alias_target? }]`
- [ ] `POST /hosted-zones/{id}/record-sets` — `change_resource_record_sets(Action=CREATE)` body: `{ name, type: A|AAAA|CNAME|MX|TXT|NS|PTR|SRV, ttl, records: string[] }` → `{ change_id, status }`
- [ ] `PUT /hosted-zones/{id}/record-sets` — `change_resource_record_sets(Action=UPSERT)` body: same as above
- [ ] `DELETE /hosted-zones/{id}/record-sets` — `change_resource_record_sets(Action=DELETE)` body: `{ name, type, ttl, records }`

### Frontend Tasks
- [ ] Create `route53/page.tsx`: two-pane (zone list left, record set browser right)
- [ ] Zone list: name, Public/Private badge, record count + "Create Hosted Zone" dialog (name, type radio, comment)
- [ ] Click zone → record sets table: Name, Type (badge), TTL, Value(s), Actions
- [ ] "Create Record" dialog: name, type dropdown, TTL, records (multi-line textarea), alias toggle
- [ ] "Edit Record" dialog: same fields, pre-populated
- [ ] "Delete Record" button per row (confirm)
- [ ] Nameservers display for public zones (shown in zone detail header)
- [ ] Delete zone button (warns if records exist)
- [ ] Add API methods: `listHostedZones`, `createHostedZone`, `deleteHostedZone`, `listRecordSets`, `createRecord`, `upsertRecord`, `deleteRecord`

---

## CloudFront

**boto3 service:** `"cloudfront"`
**Backend file:** `backend/app/routers/resources/cloudfront.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/cloudfront/page.tsx`
**Nav entry:** `{ label: "CloudFront", href: "cloudfront", icon: Globe2 }` under Networking group

### Backend Tasks
- [ ] `GET /distributions` — `list_distributions` → `[{ id, domain_name, status, origins[], default_cache_behavior, price_class, enabled, last_modified_time, aliases }]`
- [ ] `POST /distributions` — `create_distribution` body: `{ origins: [{ id, domain_name, s3_origin_config? }], default_cache_behavior: { target_origin_id, viewer_protocol_policy, allowed_methods?, compress?: true }, price_class?: PriceClass_All|PriceClass_200|PriceClass_100, enabled?: true, comment?, aliases?: [] }` → `{ id, domain_name, status }`
- [ ] `GET /distributions/{id}` — `get_distribution` → full config + ETag header
- [ ] `PUT /distributions/{id}` — `update_distribution` body: same as create + `if_match (ETag)` → updated config
- [ ] `DELETE /distributions/{id}` — first disable (PUT with enabled=false), then `delete_distribution` with ETag
- [ ] `POST /distributions/{id}/invalidations` — `create_invalidation` body: `{ paths: ["/path1", "/path2"], caller_reference }` → `{ id, status, create_time }`
- [ ] `GET /distributions/{id}/invalidations` — `list_invalidations` → `[{ id, status, create_time }]`

### Frontend Tasks
- [ ] Create `cloudfront/page.tsx`: distribution list + detail panel
- [ ] Distribution table: ID, Domain Name (with copy/open buttons), Status (badge: Deployed=green/InProgress=yellow), Origins, Enabled badge
- [ ] "Create Distribution" dialog: origin domain name, origin ID, viewer protocol policy dropdown, price class, aliases (comma-separated)
- [ ] Click distribution → detail panel with tabs:
  - [ ] Overview: domain name, status, price class, origins list
  - [ ] Behaviors: cache behaviors list
  - [ ] Invalidations tab: history table (ID, status, created) + "Create Invalidation" dialog (paths textarea, one per line)
- [ ] "Disable/Enable" toggle button per distribution
- [ ] "Delete" button (only works when disabled)
- [ ] Add API methods: `listDistributions`, `createDistribution`, `getDistribution`, `updateDistribution`, `deleteDistribution`, `createInvalidation`, `listInvalidations`

---

## ELB v2 (Elastic Load Balancing)

**boto3 service:** `"elbv2"`
**Backend file:** `backend/app/routers/resources/elbv2.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/elbv2/page.tsx`
**Nav entry:** `{ label: "Load Balancers", href: "elbv2", icon: SplitSquareHorizontal }` under Networking group

### Backend Tasks
- [ ] `GET /load-balancers` — `describe_load_balancers` → `[{ load_balancer_arn, load_balancer_name, dns_name, scheme, type, state, availability_zones, created_time }]`
- [ ] `POST /load-balancers` — `create_load_balancer` body: `{ name, subnets[], type?: application|network|gateway, scheme?: internet-facing|internal, security_groups[]? (ALB only), tags? }` → `{ load_balancer_arn, dns_name, state }`
- [ ] `DELETE /load-balancers/{arn:path}` — `delete_load_balancer`
- [ ] `GET /target-groups` — `describe_target_groups` → `[{ target_group_arn, target_group_name, protocol, port, vpc_id, target_type, health_check_path, health_check_protocol }]`
- [ ] `POST /target-groups` — `create_target_group` body: `{ name, protocol: HTTP|HTTPS|TCP|UDP, port, vpc_id?, target_type: instance|ip|lambda, health_check_path?, health_check_protocol? }` → target group object
- [ ] `DELETE /target-groups/{arn:path}` — `delete_target_group`
- [ ] `POST /target-groups/{arn:path}/register` — `register_targets` body: `{ targets: [{ id, port? }] }` → 200
- [ ] `POST /target-groups/{arn:path}/deregister` — `deregister_targets` body: `{ targets: [{ id }] }`
- [ ] `GET /target-groups/{arn:path}/health` — `describe_target_health` → `[{ target_id, target_port, health_state, health_reason }]`
- [ ] `GET /load-balancers/{arn:path}/listeners` — `describe_listeners` → `[{ listener_arn, port, protocol, ssl_policy?, certificates?, default_actions }]`
- [ ] `POST /load-balancers/{arn:path}/listeners` — `create_listener` body: `{ protocol, port, default_actions: [{ type: forward, target_group_arn }] }` → listener object
- [ ] `DELETE /listeners/{arn:path}` — `delete_listener`

### Frontend Tasks
- [ ] Create `elbv2/page.tsx` with tabs: Load Balancers | Target Groups
- [ ] Load Balancers tab:
  - [ ] Table: Name, DNS name (with copy), Type badge, Scheme badge, State, Created
  - [ ] "Create Load Balancer" wizard: type selector (ALB/NLB), name, scheme, subnets, security groups (ALB)
  - [ ] Click LB → detail panel: DNS name, AZs, listeners list + "Add Listener" dialog (protocol, port, target group dropdown) + delete listener
  - [ ] Delete LB button
- [ ] Target Groups tab:
  - [ ] Table: Name, Protocol, Port, Target Type, VPC ID, Health Check Path
  - [ ] "Create Target Group" dialog: name, protocol, port, target type, VPC, health check
  - [ ] Click TG → targets panel: list registered targets with health status (Healthy=green/Unhealthy=red/Initial=grey) + "Register Targets" dialog (ID + port) + deregister button
  - [ ] Delete TG button
- [ ] Add API methods: `listLoadBalancers`, `createLoadBalancer`, `deleteLoadBalancer`, `listTargetGroups`, `createTargetGroup`, `deleteTargetGroup`, `registerTargets`, `deregisterTargets`, `getTargetHealth`, `listListeners`, `createListener`, `deleteListener`

---

## ACM (AWS Certificate Manager)

**boto3 service:** `"acm"`
**Backend file:** `backend/app/routers/resources/acm.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/acm/page.tsx`
**Nav entry:** `{ label: "ACM", href: "acm", icon: BadgeCheck }` under Security group

### Backend Tasks
- [ ] `GET /certificates` — `list_certificates` + `describe_certificate` (batch) → `[{ certificate_arn, domain_name, status, type, in_use_by[], not_after, subject_alternative_names, created_at, issued_at }]`
- [ ] `POST /certificates` — `request_certificate` body: `{ domain_name, validation_method: DNS|EMAIL, subject_alternative_names[]?, tags? }` → `{ certificate_arn }`
- [ ] `DELETE /certificates/{arn:path}` — `delete_certificate`
- [ ] `GET /certificates/{arn:path}` — `describe_certificate` → full details including DNS validation records
- [ ] `POST /certificates/{arn:path}/resend-validation` — `resend_validation_email` body: `{ domain, validation_domain }`

### Frontend Tasks
- [ ] Create `acm/page.tsx`: certificate list
- [ ] Table: Domain, SANs count, Status (badge: Issued=green/PendingValidation=yellow/Failed=red), Type, Expiry, In Use By count
- [ ] "Request Certificate" dialog: primary domain, validation method radio (DNS/Email), additional SANs (multi-input), tags
- [ ] Click certificate → detail panel:
  - [ ] Domain + SANs list
  - [ ] DNS validation records table (for DNS validation: CNAME name + value to add to Route53) with copy buttons
  - [ ] "Resend Validation Email" button (for Email validation)
  - [ ] Expiry date with warning if < 30 days
  - [ ] In Use By: list of ARNs that reference this cert
- [ ] Delete certificate button (only works if not in use)
- [ ] Add API methods: `listCertificates`, `requestCertificate`, `deleteCertificate`, `describeCertificate`, `resendValidationEmail`
