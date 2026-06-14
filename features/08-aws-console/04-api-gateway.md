# 08-04: API Gateway v1 + v2

## API Gateway v1 (REST APIs)

**boto3 service:** `"apigateway"`
**Backend file:** `backend/app/routers/resources/apigw.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/apigw/page.tsx`
**Nav entry:** `{ label: "API Gateway", href: "apigw", icon: Globe }` under Networking group

### Backend Tasks
- [ ] `GET /rest-apis` — `get_rest_apis` → `[{ id, name, description, endpoint_configuration, created_date, tags }]`
- [ ] `POST /rest-apis` — `create_rest_api` body: `{ name, description?, endpoint_type?: REGIONAL|EDGE|PRIVATE }` → `{ id, name, ... }`
- [ ] `DELETE /rest-apis/{api_id}` — `delete_rest_api`
- [ ] `GET /rest-apis/{api_id}` — `get_rest_api` → full API details
- [ ] `GET /rest-apis/{api_id}/resources` — `get_resources` → `[{ id, parent_id, path_part, path, resource_methods }]`
- [ ] `POST /rest-apis/{api_id}/resources` — `create_resource` body: `{ parent_id, path_part }` → created resource
- [ ] `DELETE /rest-apis/{api_id}/resources/{resource_id}` — `delete_resource`
- [ ] `GET /rest-apis/{api_id}/stages` — `get_stages` → `[{ stage_name, deployment_id, description, created_date, last_updated_date, variables }]`
- [ ] `DELETE /rest-apis/{api_id}/stages/{stage_name}` — `delete_stage`
- [ ] `POST /rest-apis/{api_id}/deployments` — `create_deployment` body: `{ stage_name, description? }` → `{ id, created_date, description }`
- [ ] `GET /rest-apis/{api_id}/deployments` — `get_deployments` → `[{ id, created_date, description }]`
- [ ] `GET /api-keys` — `get_api_keys(includeValues=True)` → `[{ id, name, value, enabled, created_date }]`
- [ ] `POST /api-keys` — `create_api_key` body: `{ name, enabled?: true }` → `{ id, name, value }`
- [ ] `DELETE /api-keys/{key_id}` — `delete_api_key`
- [ ] `PUT /api-keys/{key_id}` — `update_api_key` body: `{ enabled: bool }` (enable/disable)

### Frontend Tasks
- [ ] Create `apigw/page.tsx` with tabbed layout: REST APIs | API Keys
- [ ] REST APIs tab: table (ID, name, endpoint type, created) + Create dialog
- [ ] Click API → detail panel with sub-tabs:
  - [ ] Resources tab: tree view of resource paths (expandable), create resource dialog (parent + path part)
  - [ ] Stages tab: list stages (name, deployment ID, last updated) + deploy dialog (stage name) + delete stage
  - [ ] Deployments tab: list past deployments with dates + create deployment button
- [ ] API Keys tab: table (name, value masked → reveal button, enabled badge) + create dialog + enable/disable toggle + delete
- [ ] Add API methods: `listRestAPIs`, `createRestAPI`, `deleteRestAPI`, `listAPIResources`, `createAPIResource`, `deleteAPIResource`, `listStages`, `deleteStage`, `createDeployment`, `listDeployments`, `listAPIKeys`, `createAPIKey`, `deleteAPIKey`, `updateAPIKey`

---

## API Gateway v2 (HTTP + WebSocket APIs)

**boto3 service:** `"apigatewayv2"`
**Backend file:** `backend/app/routers/resources/apigwv2.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/apigwv2/page.tsx`
**Nav entry:** `{ label: "API Gateway v2", href: "apigwv2", icon: Zap }` under Networking group

### Backend Tasks
- [ ] `GET /apis` — `get_apis` → `[{ api_id, name, protocol_type, api_endpoint, created_date, tags }]`
- [ ] `POST /apis` — `create_api` body: `{ name, protocol_type: HTTP|WEBSOCKET, route_key?, target? }` → created API
- [ ] `DELETE /apis/{api_id}` — `delete_api`
- [ ] `GET /apis/{api_id}` — `get_api` → full details
- [ ] `GET /apis/{api_id}/routes` — `get_routes` → `[{ route_id, route_key, target, authorization_type }]`
- [ ] `POST /apis/{api_id}/routes` — `create_route` body: `{ route_key, target?, authorization_type? }` → created route
- [ ] `DELETE /apis/{api_id}/routes/{route_id}` — `delete_route`
- [ ] `GET /apis/{api_id}/integrations` — `get_integrations` → `[{ integration_id, integration_type, integration_uri, integration_method }]`
- [ ] `POST /apis/{api_id}/integrations` — `create_integration` body: `{ integration_type: AWS_PROXY|HTTP_PROXY|MOCK, integration_uri?, integration_method?, payload_format_version? }` → created integration
- [ ] `DELETE /apis/{api_id}/integrations/{integration_id}` — `delete_integration`
- [ ] `GET /apis/{api_id}/stages` — `get_stages` → `[{ stage_name, deployment_id, auto_deploy, created_date }]`
- [ ] `POST /apis/{api_id}/stages` — `create_stage` body: `{ stage_name, auto_deploy?: true }` → created stage
- [ ] `POST /apis/{api_id}/deployments` — `create_deployment` body: `{ stage_name?, description? }` → `{ deployment_id, deployment_status }`

### Frontend Tasks
- [ ] Create `apigwv2/page.tsx`: API list with protocol type badge (HTTP=blue, WebSocket=purple)
- [ ] "Create API" dialog: name, protocol type radio, for HTTP: route key + target Lambda ARN (optional quick setup)
- [ ] Click API → detail panel with tabs: Routes | Integrations | Stages
  - [ ] Routes tab: list (route key, target) + create route dialog + delete
  - [ ] Integrations tab: list (type, URI, method) + create integration dialog + delete
  - [ ] Stages tab: list (name, auto-deploy badge, deployment ID) + create stage + create deployment
- [ ] API endpoint URL displayed prominently in detail panel header with copy button
- [ ] Add API methods: `listV2APIs`, `createV2API`, `deleteV2API`, `listV2Routes`, `createV2Route`, `deleteV2Route`, `listV2Integrations`, `createV2Integration`, `deleteV2Integration`, `listV2Stages`, `createV2Stage`, `createV2Deployment`
