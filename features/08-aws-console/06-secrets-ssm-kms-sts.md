# 08-06: Secrets Manager, SSM Parameter Store, KMS, STS

---

## Secrets Manager

**boto3 service:** `"secretsmanager"`
**Backend file:** `backend/app/routers/resources/secrets.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/secrets/page.tsx`
**Nav entry:** `{ label: "Secrets Manager", href: "secrets", icon: Lock }` under Security group

### Backend Tasks
- [ ] `GET /secrets` — `list_secrets` → `[{ arn, name, description, last_rotated_date, rotation_enabled, created_date, last_changed_date, tags }]`
- [ ] `POST /secrets` — `create_secret` body: `{ name, secret_string?: string, secret_binary_base64?: string, description?, kms_key_id?, tags? }` → `{ arn, name }`
- [ ] `GET /secrets/{name}` — `describe_secret` → full metadata (rotation config, tags, replication, version IDs)
- [ ] `GET /secrets/{name}/value` — `get_secret_value` → `{ secret_string?, secret_binary_base64?, version_id, created_date }`
- [ ] `PUT /secrets/{name}` — `update_secret` body: `{ secret_string?, description? }` → `{ arn, name, version_id }`
- [ ] `DELETE /secrets/{name}` — `delete_secret(ForceDeleteWithoutRecovery=True)`
- [ ] `POST /secrets/{name}/rotate` — `rotate_secret` body: `{ rotation_lambda_arn?, rotation_rules?: { automatically_after_days } }` → `{ arn, name }`

### Frontend Tasks
- [ ] Create `secrets/page.tsx`: secret list table
- [ ] Table: Name, Description, Last Rotated (or "Never"), Rotation Enabled badge, Created
- [ ] "Create Secret" dialog:
  - [ ] Secret type: Plain text / JSON key-value pairs
  - [ ] Value input: textarea for plain text, JSON key-value editor for structured secrets
  - [ ] Name, description, optional KMS key ID, tags
- [ ] Click row → Secret detail side panel:
  - [ ] "Retrieve Secret Value" button → shows value in masked field with reveal/copy button
  - [ ] Update Value button → opens edit dialog
  - [ ] Rotation section: enabled status + "Enable Rotation" button (Lambda ARN + schedule)
  - [ ] Tags tab
  - [ ] Versions tab
- [ ] Delete button (with confirmation warning about non-recoverable deletion)
- [ ] Add API methods: `listSecrets`, `createSecret`, `describeSecret`, `getSecretValue`, `updateSecret`, `deleteSecret`, `rotateSecret`

---

## SSM Parameter Store

**boto3 service:** `"ssm"`
**Backend file:** `backend/app/routers/resources/ssm.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/ssm/page.tsx`
**Nav entry:** `{ label: "Parameter Store", href: "ssm", icon: Settings }` under Other group

### Backend Tasks
- [ ] `GET /parameters` — `describe_parameters(MaxResults=50)` → `[{ name, type, last_modified_date, description, version, tier }]`
- [ ] `GET /parameters/by-path` — `get_parameters_by_path(Path, Recursive=True, WithDecryption=True)` → `[{ name, type, value, version, last_modified_date }]`
- [ ] `POST /parameters` — `put_parameter` body: `{ name, value, type: String|StringList|SecureString, description?, overwrite?: false, tier?: Standard|Advanced }` → `{ version, tier }`
- [ ] `GET /parameters/{name:path}/value` — `get_parameter(Name, WithDecryption=True)` → `{ name, type, value, version, last_modified_date }`
- [ ] `PUT /parameters/{name:path}` — `put_parameter(Overwrite=True)` body: `{ value, description? }` → `{ version }`
- [ ] `DELETE /parameters/{name:path}` — `delete_parameter`

### Frontend Tasks
- [ ] Create `ssm/page.tsx` with two-pane layout:
  - [ ] Left pane: path tree browser (group by "/" prefix hierarchy, expandable) + search input
  - [ ] Right pane: parameter table for selected path (name, type badge, last modified, version)
- [ ] "Create Parameter" dialog: full name (with path hierarchy helper), type radio (String/StringList/SecureString), value textarea, description, tier
- [ ] Click parameter row → value viewer (SecureString values masked by default) with reveal + copy button
- [ ] "Edit" button: value textarea + save
- [ ] "Delete" button with confirmation
- [ ] SecureString type shown with lock icon
- [ ] Add API methods: `listParameters`, `getParametersByPath`, `createParameter`, `getParameterValue`, `updateParameter`, `deleteParameter`

---

## KMS (Key Management Service)

**boto3 service:** `"kms"`
**Backend file:** `backend/app/routers/resources/kms.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/kms/page.tsx`
**Nav entry:** `{ label: "KMS", href: "kms", icon: Key }` under Security group

### Backend Tasks
- [ ] `GET /keys` — `list_keys` then batch `describe_key` for each → `[{ key_id, arn, description, key_usage, key_state, creation_date, enabled, aliases }]`
- [ ] `POST /keys` — `create_key` body: `{ description?, key_usage?: ENCRYPT_DECRYPT|SIGN_VERIFY, key_spec?: SYMMETRIC_DEFAULT|RSA_2048|RSA_4096|ECC_NIST_P256, tags? }` → `{ key_id, arn, key_state }`
- [ ] `POST /keys/{key_id}/enable` — `enable_key`
- [ ] `POST /keys/{key_id}/disable` — `disable_key`
- [ ] `POST /keys/{key_id}/schedule-deletion` — `schedule_key_deletion` body: `{ pending_window_in_days: 7-30 }` → `{ key_id, deletion_date }`
- [ ] `POST /keys/{key_id}/cancel-deletion` — `cancel_key_deletion`
- [ ] `GET /aliases` — `list_aliases` → `[{ alias_name, alias_arn, target_key_id, creation_date, last_updated_date }]`
- [ ] `POST /aliases` — `create_alias` body: `{ alias_name, target_key_id }` → 200
- [ ] `DELETE /aliases/{alias_name}` — `delete_alias`
- [ ] `POST /keys/{key_id}/encrypt` — `encrypt` body: `{ plaintext_base64: string }` → `{ ciphertext_base64: string, key_id }`
- [ ] `POST /keys/{key_id}/decrypt` — `decrypt` body: `{ ciphertext_base64: string }` → `{ plaintext_base64: string, key_id }`

### Frontend Tasks
- [ ] Create `kms/page.tsx` with tabs: Keys | Aliases
- [ ] Keys tab:
  - [ ] Table: Key ID (mono, truncated), Description, Usage, State (badge: Enabled=green/Disabled=grey/Pending Deletion=red), Created
  - [ ] "Create Key" dialog: usage radio, key spec dropdown, description, tags
  - [ ] Row actions: Enable / Disable / Schedule Deletion (with pending days input) / Cancel Deletion (if pending)
  - [ ] Click row → Key detail panel:
    - [ ] Key ARN with copy button
    - [ ] Aliases for this key
    - [ ] Test Encrypt/Decrypt panel: plaintext input → encrypt → ciphertext display; or ciphertext input → decrypt → plaintext display
- [ ] Aliases tab: table (alias name, target key ID) + create alias dialog + delete
- [ ] Add API methods: `listKMSKeys`, `createKMSKey`, `enableKMSKey`, `disableKMSKey`, `scheduleKeyDeletion`, `cancelKeyDeletion`, `listKMSAliases`, `createKMSAlias`, `deleteKMSAlias`, `kmsEncrypt`, `kmsDecrypt`

---

## STS (Security Token Service)

**boto3 service:** `"sts"`
**Backend file:** `backend/app/routers/resources/sts.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/sts/page.tsx`
**Nav entry:** `{ label: "STS", href: "sts", icon: UserCheck }` under Other group

### Backend Tasks
- [ ] `GET /caller-identity` — `get_caller_identity` → `{ account, user_id, arn }`
- [ ] `POST /assume-role` — `assume_role` body: `{ role_arn, role_session_name, duration_seconds?: 3600, external_id?, policy? }` → `{ access_key_id, secret_access_key, session_token, expiration }`
- [ ] `POST /federation-token` — `get_federation_token` body: `{ name, duration_seconds?: 3600, policy? }` → `{ access_key_id, secret_access_key, session_token, expiration, federated_user_arn }`

### Frontend Tasks
- [ ] Create `sts/page.tsx`:
  - [ ] Identity panel at top: Account ID, User ID, ARN (auto-fetched on load)
  - [ ] "Assume Role" section: role ARN input, session name, duration slider (900-43200s), external ID (optional), policy JSON (optional) → credentials display (all three values with copy buttons, show expiration, warn "shown once")
  - [ ] "Get Federation Token" section: name, duration, policy → same credentials display
- [ ] Add API methods: `getCallerIdentity`, `assumeRole`, `getFederationToken`
