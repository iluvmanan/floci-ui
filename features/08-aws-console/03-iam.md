# 08-03: IAM (Identity and Access Management)

**boto3 service:** `"iam"`
**Backend file:** `backend/app/routers/resources/iam.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/iam/page.tsx`
**Nav entry:** `{ label: "IAM", href: "iam", icon: Shield }` under Security group

---

## Backend Tasks

### Users
- [ ] `GET /users` — `list_users` → `[{ username, user_id, arn, create_date, path }]`
- [ ] `POST /users` — `create_user` body: `{ username, path?, tags? }` → created user object
- [ ] `DELETE /users/{username}` — `delete_user` (detach policies + delete access keys first)
- [ ] `GET /users/{username}/policies` — `list_attached_user_policies` → `[{ policy_name, policy_arn }]`
- [ ] `POST /users/{username}/policies` — `attach_user_policy` body: `{ policy_arn }` → 200
- [ ] `DELETE /users/{username}/policies/{arn:path}` — `detach_user_policy`
- [ ] `GET /users/{username}/access-keys` — `list_access_keys` → `[{ access_key_id, status, create_date }]`
- [ ] `POST /users/{username}/access-keys` — `create_access_key` → `{ access_key_id, secret_access_key }` ⚠️ secret shown once
- [ ] `DELETE /users/{username}/access-keys/{key_id}` — `delete_access_key`
- [ ] `PUT /users/{username}/access-keys/{key_id}` — `update_access_key` body: `{ status: Active|Inactive }`

### Roles
- [ ] `GET /roles` — `list_roles` → `[{ role_name, role_id, arn, create_date, description, assume_role_policy_document }]`
- [ ] `POST /roles` — `create_role` body: `{ role_name, assume_role_policy_document (JSON string), description?, path?, tags? }` → created role
- [ ] `DELETE /roles/{name}` — `delete_role` (detach policies first)
- [ ] `GET /roles/{name}/policies` — `list_attached_role_policies` → `[{ policy_name, policy_arn }]`
- [ ] `POST /roles/{name}/policies` — `attach_role_policy` body: `{ policy_arn }`
- [ ] `DELETE /roles/{name}/policies/{arn:path}` — `detach_role_policy`
- [ ] `GET /roles/{name}` — `get_role` → full role details including trust policy

### Policies
- [ ] `GET /policies` — `list_policies(Scope="Local")` → `[{ policy_name, policy_id, arn, create_date, update_date, attachment_count }]`
- [ ] `GET /policies/aws` — `list_policies(Scope="AWS", MaxItems=100)` → AWS managed policies (for attach dropdowns)
- [ ] `POST /policies` — `create_policy` body: `{ policy_name, policy_document (JSON string), description?, path? }` → created policy
- [ ] `DELETE /policies/{arn:path}` — `delete_policy`
- [ ] `GET /policies/{arn:path}/version` — `get_policy_version` (default version) → `{ document (decoded JSON) }`

### Groups
- [ ] `GET /groups` — `list_groups` → `[{ group_name, group_id, arn, create_date, path }]`
- [ ] `POST /groups` — `create_group` body: `{ group_name, path? }` → created group
- [ ] `DELETE /groups/{name}` — `delete_group`
- [ ] `GET /groups/{name}/users` — `get_group` → `{ users: [{ username, user_id, arn }], group: { ... } }`
- [ ] `POST /groups/{name}/users` — `add_user_to_group` body: `{ username }`
- [ ] `DELETE /groups/{name}/users/{username}` — `remove_user_from_group`
- [ ] `GET /groups/{name}/policies` — `list_attached_group_policies` → `[{ policy_name, policy_arn }]`
- [ ] `POST /groups/{name}/policies` — `attach_group_policy` body: `{ policy_arn }`

---

## Frontend Tasks

### Page Structure
- [ ] Create `frontend/app/(dashboard)/[instanceId]/resources/iam/page.tsx`
- [ ] Implement tabbed layout: Users | Roles | Policies | Groups

### Users Tab
- [ ] Table: Username, User ID, ARN (truncated), Created
- [ ] "Create User" dialog: username, optional path, optional tags (key-value)
- [ ] Click row → User detail side panel with sub-tabs:
  - [ ] Permissions tab: attached policies list + "Attach Policy" button (search/select from policy list) + detach button per policy
  - [ ] Access Keys tab: list (key ID, status, created) + "Create Access Key" button → show secret once with copy button + "Deactivate"/"Delete" per key
  - [ ] Groups tab: groups this user belongs to
- [ ] Delete user button (with confirmation, warns about existing access keys/policies)

### Roles Tab
- [ ] Table: Role Name, ARN, Created, Description
- [ ] "Create Role" dialog: role name, trust policy JSON editor (with pre-filled templates: Lambda/EC2/ECS trust policies as quick-select buttons), description
- [ ] Click row → Role detail panel:
  - [ ] Trust Policy tab: JSON viewer (pretty-printed)
  - [ ] Permissions tab: attached policies list + attach/detach
- [ ] Delete role button

### Policies Tab
- [ ] Table: Policy Name, ARN, Created, Updated, Attachments count
- [ ] Toggle: "Customer Managed" / "AWS Managed" (AWS managed are read-only, used for attach)
- [ ] "Create Policy" dialog: name, policy document JSON editor with validate button, description
- [ ] Click row → Policy document viewer (JSON pretty-printed)
- [ ] Delete button (customer managed only)

### Groups Tab
- [ ] Table: Group Name, ARN, Created, Members count
- [ ] "Create Group" dialog: group name
- [ ] Click row → Group detail panel:
  - [ ] Members tab: list users + "Add User" button (username input) + remove button
  - [ ] Permissions tab: attached policies + attach/detach

---

## API Client Tasks (`frontend/lib/api/instances.ts`)
- [ ] `listIAMUsers`, `createIAMUser`, `deleteIAMUser`
- [ ] `listUserPolicies(id, username)`, `attachUserPolicy(id, username, policyArn)`, `detachUserPolicy(id, username, policyArn)`
- [ ] `listAccessKeys(id, username)`, `createAccessKey(id, username)`, `deleteAccessKey(id, username, keyId)`, `updateAccessKey(id, username, keyId, status)`
- [ ] `listIAMRoles`, `createIAMRole`, `deleteIAMRole`, `getIAMRole`
- [ ] `listRolePolicies(id, roleName)`, `attachRolePolicy`, `detachRolePolicy`
- [ ] `listIAMPolicies(id, scope)`, `createIAMPolicy`, `deleteIAMPolicy`, `getPolicyDocument`
- [ ] `listIAMGroups`, `createIAMGroup`, `deleteIAMGroup`
- [ ] `getGroupUsers(id, groupName)`, `addUserToGroup`, `removeUserFromGroup`
- [ ] `listGroupPolicies(id, groupName)`, `attachGroupPolicy`, `detachGroupPolicy`
