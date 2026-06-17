# 08-05: RDS, ElastiCache, Neptune

---

## RDS (Relational Database Service)

**boto3 service:** `"rds"`
**Backend file:** `backend/app/routers/resources/rds.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/rds/page.tsx`
**Nav entry:** `{ label: "RDS", href: "rds", icon: Database }` under Database group

### Backend Tasks
- [ ] `GET /instances` — `describe_db_instances` → `[{ db_instance_identifier, db_instance_class, engine, engine_version, db_instance_status, master_username, endpoint_address, endpoint_port, allocated_storage, multi_az, publicly_accessible, storage_type, db_name, availability_zone, create_time }]`
- [ ] `POST /instances` — `create_db_instance` body: `{ db_instance_identifier, db_instance_class, engine: mysql|postgres|mariadb, engine_version?, master_username, master_user_password, db_name?, allocated_storage, storage_type?: gp2|gp3|io1, multi_az?: false, publicly_accessible?: true, availability_zone?, db_subnet_group_name? }` → `{ db_instance_identifier, db_instance_status }`
- [ ] `POST /instances/{id}/start` — `start_db_instance`
- [ ] `POST /instances/{id}/stop` — `stop_db_instance`
- [ ] `POST /instances/{id}/reboot` — `reboot_db_instance`
- [ ] `DELETE /instances/{id}` — `delete_db_instance(SkipFinalSnapshot=True)` → `{ db_instance_identifier, db_instance_status }`
- [ ] `GET /instances/{id}` — `describe_db_instances(DBInstanceIdentifier=id)` → full instance details
- [ ] `GET /snapshots` — `describe_db_snapshots` → `[{ db_snapshot_identifier, db_instance_identifier, snapshot_create_time, status, allocated_storage, engine }]`
- [ ] `POST /instances/{id}/snapshots` — `create_db_snapshot` body: `{ db_snapshot_identifier }` → `{ db_snapshot_identifier, status }`
- [ ] `DELETE /snapshots/{snapshot_id}` — `delete_db_snapshot`
- [ ] `GET /clusters` — `describe_db_clusters` → `[{ db_cluster_identifier, status, engine, engine_version, endpoint, reader_endpoint, database_name, master_username, availability_zones, allocated_storage }]`
- [ ] `GET /parameter-groups` — `describe_db_parameter_groups` → list
- [ ] `GET /subnet-groups` — `describe_db_subnet_groups` → list

### Frontend Tasks
- [ ] Create `rds/page.tsx` with tabs: DB Instances | Snapshots | Clusters
- [ ] DB Instances tab:
  - [ ] Table: ID, Engine (badge with logo color), Status (badge), Class, Endpoint:Port, Storage, Created
  - [ ] "Create DB Instance" wizard dialog:
    - [ ] Engine selection: MySQL / PostgreSQL / MariaDB (cards with logos)
    - [ ] Configuration: instance class dropdown, storage size/type, DB name
    - [ ] Credentials: master username + password (with show/hide)
    - [ ] Connectivity: multi-AZ toggle, publicly accessible toggle, AZ
  - [ ] Row actions: Start / Stop / Reboot / Take Snapshot / Delete
  - [ ] Click row → detail panel: endpoint with copy button, engine version, storage, AZ
- [ ] Snapshots tab: table (ID, source instance, created, status, storage) + create snapshot (from instance) + delete
- [ ] Clusters tab: table (ID, engine, status, endpoint) — read only list

### API Client Tasks
- [ ] `listRDSInstances`, `createRDSInstance`, `startRDSInstance`, `stopRDSInstance`, `rebootRDSInstance`, `deleteRDSInstance`, `getRDSInstance`
- [ ] `listDBSnapshots`, `createDBSnapshot`, `deleteDBSnapshot`
- [ ] `listDBClusters`

---

## ElastiCache

**boto3 service:** `"elasticache"`
**Backend file:** `backend/app/routers/resources/elasticache.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/elasticache/page.tsx`
**Nav entry:** `{ label: "ElastiCache", href: "elasticache", icon: Cpu }` under Database group

### Backend Tasks
- [ ] `GET /clusters` — `describe_cache_clusters(ShowCacheNodeInfo=True)` → `[{ cache_cluster_id, cache_node_type, engine, engine_version, cache_cluster_status, num_cache_nodes, configuration_endpoint_address, configuration_endpoint_port, preferred_availability_zone, cache_nodes }]`
- [ ] `POST /clusters` — `create_cache_cluster` body: `{ cache_cluster_id, engine: redis|memcached, cache_node_type, num_cache_nodes?: 1, engine_version?, preferred_availability_zone?, port? }` → `{ cache_cluster_id, cache_cluster_status }`
- [ ] `DELETE /clusters/{id}` — `delete_cache_cluster`
- [ ] `POST /clusters/{id}/reboot` — `reboot_cache_cluster` body: `{ node_ids?: [] }`
- [ ] `GET /replication-groups` — `describe_replication_groups` → `[{ replication_group_id, description, status, member_clusters, primary_endpoint_address, primary_endpoint_port, node_groups }]`
- [ ] `POST /replication-groups` — `create_replication_group` body: `{ replication_group_id, description, num_clusters?: 1, cache_node_type, engine_version?, multi_az_enabled?: false, automatic_failover_enabled?: false }` → `{ replication_group_id, status }`
- [ ] `DELETE /replication-groups/{id}` — `delete_replication_group`

### Frontend Tasks
- [ ] Create `elasticache/page.tsx` with tabs: Cache Clusters | Replication Groups
- [ ] Cache Clusters tab:
  - [ ] Table: Cluster ID, Engine (Redis=red/Memcached=blue badge), Status, Node Type, Nodes, Endpoint, AZ
  - [ ] "Create Cluster" dialog: engine selector, cluster ID, node type dropdown, engine version, node count (memcached)
  - [ ] Actions: Reboot / Delete
  - [ ] Click row → node list with status
- [ ] Replication Groups tab:
  - [ ] Table: ID, Description, Status, Primary Endpoint, Member Clusters
  - [ ] "Create Replication Group" dialog: ID, description, node type, primary cluster count
  - [ ] Delete button
- [ ] Endpoint display with copy button

### API Client Tasks
- [ ] `listCacheClusters`, `createCacheCluster`, `deleteCacheCluster`, `rebootCacheCluster`
- [ ] `listReplicationGroups`, `createReplicationGroup`, `deleteReplicationGroup`

---

## Neptune

**boto3 service:** `"neptune"`
**Backend file:** `backend/app/routers/resources/neptune.py`
**Frontend file:** `frontend/app/(dashboard)/[instanceId]/resources/neptune/page.tsx`
**Nav entry:** `{ label: "Neptune", href: "neptune", icon: GitBranch }` under Database group

### Backend Tasks
- [ ] `GET /clusters` — `describe_db_clusters(Filters=[{Name:"engine",Values:["neptune"]}])` → `[{ db_cluster_identifier, status, engine, engine_version, endpoint, reader_endpoint, availability_zones, database_name }]`
- [ ] `POST /clusters` — `create_db_cluster` body: `{ db_cluster_identifier, engine: "neptune", engine_version?, availability_zones[], db_subnet_group_name? }` → `{ db_cluster_identifier, status }`
- [ ] `DELETE /clusters/{id}` — `delete_db_cluster(SkipFinalSnapshot=True)`
- [ ] `GET /instances` — `describe_db_instances(Filters=[{Name:"engine",Values:["neptune"]}])` → `[{ db_instance_identifier, db_cluster_identifier, db_instance_status, db_instance_class, availability_zone }]`
- [ ] `POST /instances` — `create_db_instance` body: `{ db_instance_identifier, db_instance_class, engine: "neptune", db_cluster_identifier }` → instance object
- [ ] `DELETE /instances/{id}` — `delete_db_instance`

### Frontend Tasks
- [ ] Create `neptune/page.tsx` with tabs: Clusters | Instances
- [ ] Clusters tab: table (ID, status, endpoint, engine version) + create dialog + delete
- [ ] Instances tab: table (ID, cluster, status, class, AZ) + create dialog (cluster dropdown, class, ID) + delete
- [ ] Cluster endpoint with copy button + reader endpoint

### API Client Tasks
- [ ] `listNeptuneClusters`, `createNeptuneCluster`, `deleteNeptuneCluster`
- [ ] `listNeptuneInstances`, `createNeptuneInstance`, `deleteNeptuneInstance`
