import { api } from "./client"

export interface Instance {
  id: string
  name: string
  description: string | null
  endpoint: string
  region: string
  access_key: string
  account_id: string
  tls_verify: boolean
  status: "unknown" | "healthy" | "degraded" | "unreachable"
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface InstanceCreate {
  name: string
  description?: string
  endpoint: string
  region?: string
  access_key?: string
  secret_key: string
  account_id?: string
  tls_verify?: boolean
}

export const instancesApi = {
  list: () => api.get<Instance[]>("/instances"),

  get: (id: string) => api.get<Instance>(`/instances/${id}`),

  create: (data: InstanceCreate) => api.post<Instance>("/instances", data),

  update: (id: string, data: Partial<InstanceCreate>) =>
    api.put<Instance>(`/instances/${id}`, data),

  delete: (id: string) => api.delete(`/instances/${id}`),

  healthCheck: (id: string) =>
    api.post<{ status: string; checked_at: string; latency_ms: number; error?: string }>(
      `/instances/${id}/health-check`
    ),

  getConfig: (id: string) => api.get<Record<string, unknown>>(`/instances/${id}/config`),

  updateConfig: (id: string, config: Record<string, unknown>) =>
    api.put(`/instances/${id}/config`, config),

  resetConfig: (id: string) => api.post(`/instances/${id}/config/reset`),

  exportConfig: (id: string, format: "env" | "docker-compose" | "json") =>
    api.get(`/instances/${id}/config/export`, { params: { format } }),

  listServices: (id: string) => api.get(`/instances/${id}/services`),

  updateService: (id: string, service: string, enabled: boolean) =>
    api.put(`/instances/${id}/services/${service}`, { enabled }),

  batchUpdateServices: (id: string, services: { name: string; enabled: boolean }[]) =>
    api.put(`/instances/${id}/services/batch`, { services }),

  // S3
  listBuckets: (id: string) => api.get(`/instances/${id}/resources/s3/buckets`),
  createBucket: (id: string, bucket_name: string) =>
    api.post(`/instances/${id}/resources/s3/buckets`, { bucket_name }),
  deleteBucket: (id: string, bucket: string) =>
    api.delete(`/instances/${id}/resources/s3/buckets/${bucket}`),
  listObjects: (id: string, bucket: string, prefix = "", continuation_token?: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/objects`, {
      params: { prefix, continuation_token },
    }),
  deleteObject: (id: string, bucket: string, key: string) =>
    api.delete(`/instances/${id}/resources/s3/buckets/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(key)}`),
  downloadObject: (id: string, bucket: string, key: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/objects/${encodeURIComponent(key)}/download`),
  uploadUrl: (id: string, bucket: string, key: string) =>
    api.put(`/instances/${id}/resources/s3/buckets/${bucket}/upload-url`, { key }),
  getBucketVersioning: (id: string, bucket: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/versioning`),
  setBucketVersioning: (id: string, bucket: string, enabled: boolean) =>
    api.put(`/instances/${id}/resources/s3/buckets/${bucket}/versioning`, { enabled }),
  getBucketPolicy: (id: string, bucket: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/policy`),
  setBucketPolicy: (id: string, bucket: string, policy: string) =>
    api.put(`/instances/${id}/resources/s3/buckets/${bucket}/policy`, { policy }),
  deleteBucketPolicy: (id: string, bucket: string) =>
    api.delete(`/instances/${id}/resources/s3/buckets/${bucket}/policy`),
  getBucketCors: (id: string, bucket: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/cors`),
  setBucketCors: (id: string, bucket: string, rules: unknown[]) =>
    api.put(`/instances/${id}/resources/s3/buckets/${bucket}/cors`, { rules }),
  getBucketTags: (id: string, bucket: string) =>
    api.get(`/instances/${id}/resources/s3/buckets/${bucket}/tagging`),
  setBucketTags: (id: string, bucket: string, tags: { Key: string; Value: string }[]) =>
    api.put(`/instances/${id}/resources/s3/buckets/${bucket}/tagging`, { tags }),

  // DynamoDB
  listTables: (id: string) => api.get(`/instances/${id}/resources/dynamodb/tables`),
  createTable: (id: string, body: { table_name: string; hash_key: string; hash_type?: string; billing_mode?: string }) =>
    api.post(`/instances/${id}/resources/dynamodb/tables`, body),
  deleteTable: (id: string, table: string) =>
    api.delete(`/instances/${id}/resources/dynamodb/tables/${table}`),
  scanTable: (id: string, table: string, body: object = {}) =>
    api.post(`/instances/${id}/resources/dynamodb/tables/${table}/scan`, body),
  putItem: (id: string, table: string, item: object) =>
    api.put(`/instances/${id}/resources/dynamodb/tables/${table}/items`, { item }),
  queryTable: (id: string, table: string, body: { key_condition: string; expression_values: Record<string, unknown>; index_name?: string; limit?: number }) =>
    api.post(`/instances/${id}/resources/dynamodb/tables/${table}/query`, body),
  deleteItem: (id: string, table: string, key: Record<string, unknown>) =>
    api.delete(`/instances/${id}/resources/dynamodb/tables/${table}/items`, { data: { key } }),
  describeTable: (id: string, table: string) =>
    api.get(`/instances/${id}/resources/dynamodb/tables/${table}`),
  getItem: (id: string, table: string, key: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/dynamodb/tables/${table}/get-item`, { key }),
  updateTableSettings: (id: string, table: string, body: { billing_mode: string; read_capacity?: number; write_capacity?: number }) =>
    api.put(`/instances/${id}/resources/dynamodb/tables/${table}/settings`, body),

  // Lambda
  listFunctions: (id: string) => api.get(`/instances/${id}/resources/lambda/functions`),
  createFunction: (id: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/lambda/functions`, body),
  deleteFunction: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/lambda/functions/${name}`),
  invokeFunction: (id: string, name: string, payload: object) =>
    api.post(`/instances/${id}/resources/lambda/functions/${name}/invoke`, { payload }),
  getFunctionLogs: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/lambda/functions/${name}/logs`),
  getFunction: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/lambda/functions/${name}`),
  updateFunctionCode: (id: string, name: string, zip_base64: string) =>
    api.put(`/instances/${id}/resources/lambda/functions/${name}/code`, { zip_base64 }),
  updateFunctionConfig: (id: string, name: string, body: Record<string, unknown>) =>
    api.put(`/instances/${id}/resources/lambda/functions/${name}/config`, body),
  listAliases: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/lambda/functions/${name}/aliases`),
  createAlias: (id: string, name: string, body: { name: string; function_version: string; description?: string }) =>
    api.post(`/instances/${id}/resources/lambda/functions/${name}/aliases`, body),

  // SQS
  listQueues: (id: string) => api.get(`/instances/${id}/resources/sqs/queues`),
  createQueue: (id: string, queue_name: string, fifo = false) =>
    api.post(`/instances/${id}/resources/sqs/queues`, { queue_name, fifo }),
  deleteQueue: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/sqs/queues/${name}`),
  sendMessage: (id: string, name: string, message_body: string) =>
    api.post(`/instances/${id}/resources/sqs/queues/${name}/send`, { message_body }),
  receiveMessages: (id: string, name: string, count = 10) =>
    api.get(`/instances/${id}/resources/sqs/queues/${name}/receive`, { params: { count } }),
  purgeQueue: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/sqs/queues/${name}/purge`),
  getQueueAttributes: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/sqs/queues/${name}/attributes`),
  setQueueAttributes: (id: string, name: string, body: Record<string, number>) =>
    api.put(`/instances/${id}/resources/sqs/queues/${name}/attributes`, body),

  // SNS
  listTopics: (id: string) => api.get(`/instances/${id}/resources/sns/topics`),
  createTopic: (id: string, topic_name: string, fifo = false) =>
    api.post(`/instances/${id}/resources/sns/topics`, { topic_name, fifo }),
  deleteTopic: (id: string, arn: string) =>
    api.delete(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}`),
  publishMessage: (id: string, arn: string, message: string) =>
    api.post(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}/publish`, { message }),
  subscribeToTopic: (id: string, arn: string, body: { protocol: string; endpoint: string }) =>
    api.post(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}/subscribe`, body),
  unsubscribe: (id: string, subscriptionArn: string) =>
    api.delete(`/instances/${id}/resources/sns/subscriptions/${encodeURIComponent(subscriptionArn)}`),
  listSubscriptions: (id: string) =>
    api.get(`/instances/${id}/resources/sns/subscriptions`),
  getTopicAttributes: (id: string, arn: string) =>
    api.get(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}/attributes`),

  // Kinesis
  listStreams: (id: string) => api.get(`/instances/${id}/resources/kinesis/streams`),
  createStream: (id: string, stream_name: string, shard_count = 1) =>
    api.post(`/instances/${id}/resources/kinesis/streams`, { stream_name, shard_count }),
  deleteStream: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/kinesis/streams/${name}`),
  describeStream: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/kinesis/streams/${name}`),
  listShards: (id: string, name: string) =>
    api.get(`/instances/${id}/resources/kinesis/streams/${name}/shards`),
  putRecord: (id: string, name: string, body: { data_b64: string; partition_key: string }) =>
    api.post(`/instances/${id}/resources/kinesis/streams/${name}/records`, body),

  // EventBridge
  listBuses: (id: string) => api.get(`/instances/${id}/resources/eventbridge/buses`),
  createBus: (id: string, bus_name: string) =>
    api.post(`/instances/${id}/resources/eventbridge/buses`, { bus_name }),
  listRules: (id: string, busName: string) =>
    api.get(`/instances/${id}/resources/eventbridge/buses/${busName}/rules`),
  createEventBridgeRule: (id: string, busName: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/eventbridge/buses/${busName}/rules`, body),
  deleteEventBridgeRule: (id: string, busName: string, ruleName: string) =>
    api.delete(`/instances/${id}/resources/eventbridge/buses/${busName}/rules/${ruleName}`),
  listRuleTargets: (id: string, busName: string, ruleName: string) =>
    api.get(`/instances/${id}/resources/eventbridge/buses/${busName}/rules/${ruleName}/targets`),
  putRuleTargets: (id: string, busName: string, ruleName: string, targets: unknown[]) =>
    api.post(`/instances/${id}/resources/eventbridge/buses/${busName}/rules/${ruleName}/targets`, { targets }),
  putEventBridgeEvent: (id: string, busName: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/eventbridge/buses/${busName}/events`, body),

  // Cognito
  listUserPools: (id: string) => api.get(`/instances/${id}/resources/cognito/user-pools`),
  listUsers: (id: string, pool_id: string) =>
    api.get(`/instances/${id}/resources/cognito/user-pools/${pool_id}/users`),
  createUser: (id: string, pool_id: string, body: { username: string; email: string; temp_password: string }) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${pool_id}/users`, body),
  describeUserPool: (id: string, poolId: string) =>
    api.get(`/instances/${id}/resources/cognito/user-pools/${poolId}`),
  enableUser: (id: string, poolId: string, username: string) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${poolId}/users/${username}/enable`),
  disableUser: (id: string, poolId: string, username: string) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${poolId}/users/${username}/disable`),
  resetUserPassword: (id: string, poolId: string, username: string) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${poolId}/users/${username}/reset-password`),
  updateUserAttributes: (id: string, poolId: string, username: string, attributes: { Name: string; Value: string }[]) =>
    api.put(`/instances/${id}/resources/cognito/user-pools/${poolId}/users/${username}`, { attributes }),
  listAppClients: (id: string, poolId: string) =>
    api.get(`/instances/${id}/resources/cognito/user-pools/${poolId}/app-clients`),
  createAppClient: (id: string, poolId: string, body: { client_name: string; generate_secret: boolean }) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${poolId}/app-clients`, body),

  // EC2
  listEC2Instances: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/instances`),
  launchEC2Instance: (id: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/ec2/instances`, body),
  startEC2Instance: (id: string, instanceId: string) =>
    api.post(`/instances/${id}/resources/ec2/instances/${instanceId}/start`),
  stopEC2Instance: (id: string, instanceId: string) =>
    api.post(`/instances/${id}/resources/ec2/instances/${instanceId}/stop`),
  rebootEC2Instance: (id: string, instanceId: string) =>
    api.post(`/instances/${id}/resources/ec2/instances/${instanceId}/reboot`),
  terminateEC2Instance: (id: string, instanceId: string) =>
    api.post(`/instances/${id}/resources/ec2/instances/${instanceId}/terminate`),
  getEC2ConsoleOutput: (id: string, instanceId: string) =>
    api.get(`/instances/${id}/resources/ec2/instances/${instanceId}/console`),
  getEC2ConnectInfo: (id: string, instanceId: string) =>
    api.get(`/instances/${id}/resources/ec2/instances/${instanceId}/connect`),
  listKeyPairs: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/key-pairs`),
  createKeyPair: (id: string, name: string) =>
    api.post(`/instances/${id}/resources/ec2/key-pairs`, { name }),
  deleteKeyPair: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/ec2/key-pairs/${name}`),
  importKeyPair: (id: string, name: string, publicKey: string) =>
    api.post(`/instances/${id}/resources/ec2/key-pairs/import`, { name, public_key: publicKey }),
  listSecurityGroups: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/security-groups`),
  createSecurityGroup: (id: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/ec2/security-groups`, body),
  deleteSecurityGroup: (id: string, groupId: string) =>
    api.delete(`/instances/${id}/resources/ec2/security-groups/${groupId}`),
  getSecurityGroupRules: (id: string, groupId: string) =>
    api.get(`/instances/${id}/resources/ec2/security-groups/${groupId}/rules`),
  addIngressRule: (id: string, groupId: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/ec2/security-groups/${groupId}/ingress`, body),
  revokeIngressRule: (id: string, groupId: string, body: Record<string, unknown>) =>
    api.delete(`/instances/${id}/resources/ec2/security-groups/${groupId}/ingress`, { data: body }),
  listAMIs: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/amis`),
  listVolumes: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/volumes`),
  createVolume: (id: string, body: Record<string, unknown>) =>
    api.post(`/instances/${id}/resources/ec2/volumes`, body),
  attachVolume: (id: string, volumeId: string, body: { instance_id: string; device: string }) =>
    api.post(`/instances/${id}/resources/ec2/volumes/${volumeId}/attach`, body),
  detachVolume: (id: string, volumeId: string) =>
    api.post(`/instances/${id}/resources/ec2/volumes/${volumeId}/detach`),
  deleteVolume: (id: string, volumeId: string) =>
    api.delete(`/instances/${id}/resources/ec2/volumes/${volumeId}`),
  listElasticIPs: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/elastic-ips`),
  allocateElasticIP: (id: string) =>
    api.post(`/instances/${id}/resources/ec2/elastic-ips`),
  associateElasticIP: (id: string, allocationId: string, instanceId: string) =>
    api.post(`/instances/${id}/resources/ec2/elastic-ips/${allocationId}/associate`, { instance_id: instanceId }),
  disassociateElasticIP: (id: string, allocationId: string) =>
    api.post(`/instances/${id}/resources/ec2/elastic-ips/${allocationId}/disassociate`),
  releaseElasticIP: (id: string, allocationId: string) =>
    api.delete(`/instances/${id}/resources/ec2/elastic-ips/${allocationId}`),
  listVPCs: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/vpcs`),
  listSubnets: (id: string) =>
    api.get(`/instances/${id}/resources/ec2/subnets`),

  // IAM
  listIAMUsers: (id: string) => api.get(`/instances/${id}/resources/iam/users`),
  createIAMUser: (id: string, username: string) => api.post(`/instances/${id}/resources/iam/users`, { username }),
  deleteIAMUser: (id: string, username: string) => api.delete(`/instances/${id}/resources/iam/users/${username}`),
  listUserPolicies: (id: string, username: string) => api.get(`/instances/${id}/resources/iam/users/${username}/policies`),
  attachUserPolicy: (id: string, username: string, policyArn: string) => api.post(`/instances/${id}/resources/iam/users/${username}/policies`, { policy_arn: policyArn }),
  detachUserPolicy: (id: string, username: string, policyArn: string) => api.delete(`/instances/${id}/resources/iam/users/${username}/policies/${encodeURIComponent(policyArn)}`),
  listAccessKeys: (id: string, username: string) => api.get(`/instances/${id}/resources/iam/users/${username}/access-keys`),
  createAccessKey: (id: string, username: string) => api.post(`/instances/${id}/resources/iam/users/${username}/access-keys`),
  deleteAccessKey: (id: string, username: string, keyId: string) => api.delete(`/instances/${id}/resources/iam/users/${username}/access-keys/${keyId}`),
  listIAMRoles: (id: string) => api.get(`/instances/${id}/resources/iam/roles`),
  createIAMRole: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/iam/roles`, body),
  deleteIAMRole: (id: string, name: string) => api.delete(`/instances/${id}/resources/iam/roles/${name}`),
  listRolePolicies: (id: string, name: string) => api.get(`/instances/${id}/resources/iam/roles/${name}/policies`),
  attachRolePolicy: (id: string, name: string, policyArn: string) => api.post(`/instances/${id}/resources/iam/roles/${name}/policies`, { policy_arn: policyArn }),
  detachRolePolicy: (id: string, name: string, policyArn: string) => api.delete(`/instances/${id}/resources/iam/roles/${name}/policies/${encodeURIComponent(policyArn)}`),
  listIAMPolicies: (id: string) => api.get(`/instances/${id}/resources/iam/policies`),
  createIAMPolicy: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/iam/policies`, body),
  deleteIAMPolicy: (id: string, policyArn: string) => api.delete(`/instances/${id}/resources/iam/policies/${encodeURIComponent(policyArn)}`),
  listIAMGroups: (id: string) => api.get(`/instances/${id}/resources/iam/groups`),
  createIAMGroup: (id: string, name: string) => api.post(`/instances/${id}/resources/iam/groups`, { name }),
  deleteIAMGroup: (id: string, name: string) => api.delete(`/instances/${id}/resources/iam/groups/${name}`),
  listGroupMembers: (id: string, name: string) => api.get(`/instances/${id}/resources/iam/groups/${name}/users`),
  addUserToGroup: (id: string, name: string, username: string) => api.post(`/instances/${id}/resources/iam/groups/${name}/users`, { username }),
  removeUserFromGroup: (id: string, name: string, username: string) => api.delete(`/instances/${id}/resources/iam/groups/${name}/users/${username}`),

  // API Gateway v1
  listRestAPIs: (id: string) => api.get(`/instances/${id}/resources/apigw/rest-apis`),
  createRestAPI: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigw/rest-apis`, body),
  deleteRestAPI: (id: string, apiId: string) => api.delete(`/instances/${id}/resources/apigw/rest-apis/${apiId}`),
  listAPIResources: (id: string, apiId: string) => api.get(`/instances/${id}/resources/apigw/rest-apis/${apiId}/resources`),
  createAPIResource: (id: string, apiId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigw/rest-apis/${apiId}/resources`, body),
  createAPIDeployment: (id: string, apiId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigw/rest-apis/${apiId}/deployments`, body),
  listAPIStages: (id: string, apiId: string) => api.get(`/instances/${id}/resources/apigw/rest-apis/${apiId}/stages`),
  listAPIKeys: (id: string) => api.get(`/instances/${id}/resources/apigw/api-keys`),
  createAPIKey: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigw/api-keys`, body),
  deleteAPIKey: (id: string, keyId: string) => api.delete(`/instances/${id}/resources/apigw/api-keys/${keyId}`),

  // API Gateway v2
  listAPIsv2: (id: string) => api.get(`/instances/${id}/resources/apigwv2/apis`),
  createAPIv2: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigwv2/apis`, body),
  deleteAPIv2: (id: string, apiId: string) => api.delete(`/instances/${id}/resources/apigwv2/apis/${apiId}`),
  listRoutesv2: (id: string, apiId: string) => api.get(`/instances/${id}/resources/apigwv2/apis/${apiId}/routes`),
  createRouteV2: (id: string, apiId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigwv2/apis/${apiId}/routes`, body),
  listIntegrationsV2: (id: string, apiId: string) => api.get(`/instances/${id}/resources/apigwv2/apis/${apiId}/integrations`),
  createIntegrationV2: (id: string, apiId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/apigwv2/apis/${apiId}/integrations`, body),
  listStagesV2: (id: string, apiId: string) => api.get(`/instances/${id}/resources/apigwv2/apis/${apiId}/stages`),
  createDeploymentV2: (id: string, apiId: string, stageName: string) => api.post(`/instances/${id}/resources/apigwv2/apis/${apiId}/deployments`, { stage_name: stageName }),

  // RDS
  listRDSInstances: (id: string) => api.get(`/instances/${id}/resources/rds/instances`),
  createRDSInstance: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/rds/instances`, body),
  startRDSInstance: (id: string, dbId: string) => api.post(`/instances/${id}/resources/rds/instances/${dbId}/start`),
  stopRDSInstance: (id: string, dbId: string) => api.post(`/instances/${id}/resources/rds/instances/${dbId}/stop`),
  deleteRDSInstance: (id: string, dbId: string) => api.delete(`/instances/${id}/resources/rds/instances/${dbId}`),
  listRDSSnapshots: (id: string) => api.get(`/instances/${id}/resources/rds/snapshots`),
  createRDSSnapshot: (id: string, dbId: string, snapshotId: string) => api.post(`/instances/${id}/resources/rds/instances/${dbId}/snapshots`, { snapshot_identifier: snapshotId }),
  listRDSClusters: (id: string) => api.get(`/instances/${id}/resources/rds/clusters`),

  // ElastiCache
  listCacheClusters: (id: string) => api.get(`/instances/${id}/resources/elasticache/clusters`),
  createCacheCluster: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elasticache/clusters`, body),
  deleteCacheCluster: (id: string, clusterId: string) => api.delete(`/instances/${id}/resources/elasticache/clusters/${clusterId}`),
  rebootCacheCluster: (id: string, clusterId: string, nodeIds: string[]) => api.post(`/instances/${id}/resources/elasticache/clusters/${clusterId}/reboot`, { node_ids: nodeIds }),
  listReplicationGroups: (id: string) => api.get(`/instances/${id}/resources/elasticache/replication-groups`),
  createReplicationGroup: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elasticache/replication-groups`, body),
  deleteReplicationGroup: (id: string, groupId: string) => api.delete(`/instances/${id}/resources/elasticache/replication-groups/${groupId}`),

  // Neptune
  listNeptuneClusters: (id: string) => api.get(`/instances/${id}/resources/neptune/clusters`),
  createNeptuneCluster: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/neptune/clusters`, body),
  deleteNeptuneCluster: (id: string, clusterId: string) => api.delete(`/instances/${id}/resources/neptune/clusters/${clusterId}`),
  listNeptuneInstances: (id: string) => api.get(`/instances/${id}/resources/neptune/instances`),
  createNeptuneInstance: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/neptune/instances`, body),
  deleteNeptuneInstance: (id: string, instanceId: string) => api.delete(`/instances/${id}/resources/neptune/instances/${instanceId}`),

  // Secrets Manager
  listSecrets: (id: string) => api.get(`/instances/${id}/resources/secrets/secrets`),
  createSecret: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/secrets/secrets`, body),
  describeSecret: (id: string, name: string) => api.get(`/instances/${id}/resources/secrets/secrets/${encodeURIComponent(name)}`),
  getSecretValue: (id: string, name: string) => api.get(`/instances/${id}/resources/secrets/secrets/${encodeURIComponent(name)}/value`),
  updateSecret: (id: string, name: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/secrets/secrets/${encodeURIComponent(name)}`, body),
  deleteSecret: (id: string, name: string) => api.delete(`/instances/${id}/resources/secrets/secrets/${encodeURIComponent(name)}`),
  rotateSecret: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/secrets/secrets/${encodeURIComponent(name)}/rotate`, body),

  // SSM Parameter Store
  listParameters: (id: string) => api.get(`/instances/${id}/resources/ssm/parameters`),
  getParametersByPath: (id: string, path: string) => api.get(`/instances/${id}/resources/ssm/parameters/by-path`, { params: { path } }),
  createParameter: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ssm/parameters`, body),
  getParameterValue: (id: string, name: string) => api.get(`/instances/${id}/resources/ssm/parameters/${encodeURIComponent(name)}/value`),
  updateParameter: (id: string, name: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/ssm/parameters/${encodeURIComponent(name)}`, body),
  deleteParameter: (id: string, name: string) => api.delete(`/instances/${id}/resources/ssm/parameters/${encodeURIComponent(name)}`),

  // KMS
  listKMSKeys: (id: string) => api.get(`/instances/${id}/resources/kms/keys`),
  createKMSKey: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/kms/keys`, body),
  enableKMSKey: (id: string, keyId: string) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/enable`),
  disableKMSKey: (id: string, keyId: string) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/disable`),
  scheduleKeyDeletion: (id: string, keyId: string, days: number) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/schedule-deletion`, { pending_window_in_days: days }),
  cancelKeyDeletion: (id: string, keyId: string) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/cancel-deletion`),
  listKMSAliases: (id: string) => api.get(`/instances/${id}/resources/kms/aliases`),
  createKMSAlias: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/kms/aliases`, body),
  deleteKMSAlias: (id: string, aliasName: string) => api.delete(`/instances/${id}/resources/kms/aliases/${encodeURIComponent(aliasName)}`),
  kmsEncrypt: (id: string, keyId: string, dataBase64: string) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/encrypt`, { data_base64: dataBase64 }),
  kmsDecrypt: (id: string, keyId: string, dataBase64: string) => api.post(`/instances/${id}/resources/kms/keys/${keyId}/decrypt`, { data_base64: dataBase64 }),

  // STS
  getCallerIdentity: (id: string) => api.get(`/instances/${id}/resources/sts/caller-identity`),
  assumeRole: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/sts/assume-role`, body),
  getFederationToken: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/sts/federation-token`, body),

  // ECS
  listECSClusters: (id: string) => api.get(`/instances/${id}/resources/ecs/clusters`),
  createECSCluster: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ecs/clusters`, body),
  deleteECSCluster: (id: string, name: string) => api.delete(`/instances/${id}/resources/ecs/clusters/${name}`),
  listECSServices: (id: string, cluster: string) => api.get(`/instances/${id}/resources/ecs/clusters/${cluster}/services`),
  createECSService: (id: string, cluster: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ecs/clusters/${cluster}/services`, body),
  updateECSService: (id: string, cluster: string, service: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/ecs/clusters/${cluster}/services/${service}`, body),
  deleteECSService: (id: string, cluster: string, service: string) => api.delete(`/instances/${id}/resources/ecs/clusters/${cluster}/services/${service}`),
  listECSTasks: (id: string, cluster: string) => api.get(`/instances/${id}/resources/ecs/clusters/${cluster}/tasks`),
  runECSTask: (id: string, cluster: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ecs/clusters/${cluster}/tasks/run`, body),
  stopECSTask: (id: string, cluster: string, taskArn: string, reason?: string) => api.post(`/instances/${id}/resources/ecs/clusters/${cluster}/tasks/${encodeURIComponent(taskArn)}/stop`, { reason }),
  listTaskDefinitions: (id: string) => api.get(`/instances/${id}/resources/ecs/task-definitions`),
  describeTaskDefinition: (id: string, family: string) => api.get(`/instances/${id}/resources/ecs/task-definitions/${family}`),
  registerTaskDefinition: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ecs/task-definitions`, body),
  deregisterTaskDefinition: (id: string, family: string, revision: number) => api.delete(`/instances/${id}/resources/ecs/task-definitions/${family}/${revision}`),

  // EKS
  listEKSClusters: (id: string) => api.get(`/instances/${id}/resources/eks/clusters`),
  createEKSCluster: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/eks/clusters`, body),
  deleteEKSCluster: (id: string, name: string) => api.delete(`/instances/${id}/resources/eks/clusters/${name}`),
  getEKSCluster: (id: string, name: string) => api.get(`/instances/${id}/resources/eks/clusters/${name}`),
  listNodeGroups: (id: string, cluster: string) => api.get(`/instances/${id}/resources/eks/clusters/${cluster}/nodegroups`),
  createNodeGroup: (id: string, cluster: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/eks/clusters/${cluster}/nodegroups`, body),
  deleteNodeGroup: (id: string, cluster: string, ng: string) => api.delete(`/instances/${id}/resources/eks/clusters/${cluster}/nodegroups/${ng}`),
  updateNodeGroupScaling: (id: string, cluster: string, ng: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/eks/clusters/${cluster}/nodegroups/${ng}`, body),

  // ECR
  listECRRepos: (id: string) => api.get(`/instances/${id}/resources/ecr/repositories`),
  createECRRepo: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/ecr/repositories`, body),
  deleteECRRepo: (id: string, name: string) => api.delete(`/instances/${id}/resources/ecr/repositories/${name}`),
  listECRImages: (id: string, name: string) => api.get(`/instances/${id}/resources/ecr/repositories/${name}/images`),
  deleteECRImages: (id: string, name: string, imageIds: Record<string, unknown>[]) => api.delete(`/instances/${id}/resources/ecr/repositories/${name}/images`, { data: { image_ids: imageIds } }),
  getECRPolicy: (id: string, name: string) => api.get(`/instances/${id}/resources/ecr/repositories/${name}/policy`),
  setECRPolicy: (id: string, name: string, policyText: string) => api.put(`/instances/${id}/resources/ecr/repositories/${name}/policy`, { policy_text: policyText }),
  deleteECRPolicy: (id: string, name: string) => api.delete(`/instances/${id}/resources/ecr/repositories/${name}/policy`),
  getECRAuthToken: (id: string) => api.get(`/instances/${id}/resources/ecr/auth-token`),

  // Auto Scaling
  listASGs: (id: string) => api.get(`/instances/${id}/resources/autoscaling/groups`),
  createASG: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/autoscaling/groups`, body),
  updateASG: (id: string, name: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/autoscaling/groups/${name}`, body),
  deleteASG: (id: string, name: string) => api.delete(`/instances/${id}/resources/autoscaling/groups/${name}`),
  setASGDesiredCapacity: (id: string, name: string, desiredCapacity: number) => api.post(`/instances/${id}/resources/autoscaling/groups/${name}/capacity`, { desired_capacity: desiredCapacity }),
  getASGActivities: (id: string, name: string) => api.get(`/instances/${id}/resources/autoscaling/groups/${name}/activities`),
  listScalingPolicies: (id: string, asgName?: string) => api.get(`/instances/${id}/resources/autoscaling/policies`, { params: asgName ? { auto_scaling_group_name: asgName } : {} }),
  createScalingPolicy: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/autoscaling/policies`, body),
  deleteScalingPolicy: (id: string, policyName: string, asgName: string) => api.delete(`/instances/${id}/resources/autoscaling/policies/${policyName}`, { params: { auto_scaling_group_name: asgName } }),

  // Route 53
  listHostedZones: (id: string) => api.get(`/instances/${id}/resources/route53/hosted-zones`),
  createHostedZone: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/route53/hosted-zones`, body),
  deleteHostedZone: (id: string, zoneId: string) => api.delete(`/instances/${id}/resources/route53/hosted-zones/${encodeURIComponent(zoneId)}`),
  listRecordSets: (id: string, zoneId: string) => api.get(`/instances/${id}/resources/route53/hosted-zones/${encodeURIComponent(zoneId)}/record-sets`),
  createRecord: (id: string, zoneId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/route53/hosted-zones/${encodeURIComponent(zoneId)}/record-sets`, body),
  upsertRecord: (id: string, zoneId: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/route53/hosted-zones/${encodeURIComponent(zoneId)}/record-sets`, body),
  deleteRecord: (id: string, zoneId: string, body: Record<string, unknown>) => api.delete(`/instances/${id}/resources/route53/hosted-zones/${encodeURIComponent(zoneId)}/record-sets`, { data: body }),

  // CloudFront
  listDistributions: (id: string) => api.get(`/instances/${id}/resources/cloudfront/distributions`),
  createDistribution: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/cloudfront/distributions`, body),
  getDistribution: (id: string, distId: string) => api.get(`/instances/${id}/resources/cloudfront/distributions/${distId}`),
  updateDistribution: (id: string, distId: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/cloudfront/distributions/${distId}`, body),
  deleteDistribution: (id: string, distId: string) => api.delete(`/instances/${id}/resources/cloudfront/distributions/${distId}`),
  createInvalidation: (id: string, distId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/cloudfront/distributions/${distId}/invalidations`, body),
  listInvalidations: (id: string, distId: string) => api.get(`/instances/${id}/resources/cloudfront/distributions/${distId}/invalidations`),

  // ELB v2
  listLoadBalancers: (id: string) => api.get(`/instances/${id}/resources/elbv2/load-balancers`),
  createLoadBalancer: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elbv2/load-balancers`, body),
  deleteLoadBalancer: (id: string, lbArn: string) => api.delete(`/instances/${id}/resources/elbv2/load-balancers/${encodeURIComponent(lbArn)}`),
  listTargetGroups: (id: string) => api.get(`/instances/${id}/resources/elbv2/target-groups`),
  createTargetGroup: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elbv2/target-groups`, body),
  deleteTargetGroup: (id: string, tgArn: string) => api.delete(`/instances/${id}/resources/elbv2/target-groups/${encodeURIComponent(tgArn)}`),
  registerTargets: (id: string, tgArn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elbv2/target-groups/${encodeURIComponent(tgArn)}/register`, body),
  deregisterTargets: (id: string, tgArn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elbv2/target-groups/${encodeURIComponent(tgArn)}/deregister`, body),
  getTargetHealth: (id: string, tgArn: string) => api.get(`/instances/${id}/resources/elbv2/target-groups/${encodeURIComponent(tgArn)}/health`),
  listListeners: (id: string, lbArn: string) => api.get(`/instances/${id}/resources/elbv2/load-balancers/${encodeURIComponent(lbArn)}/listeners`),
  createListener: (id: string, lbArn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/elbv2/load-balancers/${encodeURIComponent(lbArn)}/listeners`, body),
  deleteListener: (id: string, listenerArn: string) => api.delete(`/instances/${id}/resources/elbv2/listeners/${encodeURIComponent(listenerArn)}`),

  // ACM
  listCertificates: (id: string) => api.get(`/instances/${id}/resources/acm/certificates`),
  requestCertificate: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/acm/certificates`, body),
  deleteCertificate: (id: string, certArn: string) => api.delete(`/instances/${id}/resources/acm/certificates/${encodeURIComponent(certArn)}`),
  describeCertificate: (id: string, certArn: string) => api.get(`/instances/${id}/resources/acm/certificates/${encodeURIComponent(certArn)}`),
  resendValidationEmail: (id: string, certArn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/acm/certificates/${encodeURIComponent(certArn)}/resend-validation`, body),

  // CloudFormation
  listStacks: (id: string) => api.get(`/instances/${id}/resources/cfn/stacks`),
  createStack: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/cfn/stacks`, body),
  updateStack: (id: string, name: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/cfn/stacks/${name}`, body),
  deleteStack: (id: string, name: string) => api.delete(`/instances/${id}/resources/cfn/stacks/${name}`),
  describeStack: (id: string, name: string) => api.get(`/instances/${id}/resources/cfn/stacks/${name}`),
  getStackEvents: (id: string, name: string) => api.get(`/instances/${id}/resources/cfn/stacks/${name}/events`),
  getStackResources: (id: string, name: string) => api.get(`/instances/${id}/resources/cfn/stacks/${name}/resources`),
  getStackTemplate: (id: string, name: string) => api.get(`/instances/${id}/resources/cfn/stacks/${name}/template`),

  // Step Functions
  listStateMachines: (id: string) => api.get(`/instances/${id}/resources/stepfunctions/state-machines`),
  createStateMachine: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/stepfunctions/state-machines`, body),
  deleteStateMachine: (id: string, arn: string) => api.delete(`/instances/${id}/resources/stepfunctions/state-machines/${encodeURIComponent(arn)}`),
  describeStateMachine: (id: string, arn: string) => api.get(`/instances/${id}/resources/stepfunctions/state-machines/${encodeURIComponent(arn)}`),
  updateStateMachine: (id: string, arn: string, body: Record<string, unknown>) => api.put(`/instances/${id}/resources/stepfunctions/state-machines/${encodeURIComponent(arn)}`, body),
  listExecutions: (id: string, arn: string) => api.get(`/instances/${id}/resources/stepfunctions/state-machines/${encodeURIComponent(arn)}/executions`),
  startExecution: (id: string, arn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/stepfunctions/state-machines/${encodeURIComponent(arn)}/executions`, body),
  stopExecution: (id: string, execArn: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/stepfunctions/executions/${encodeURIComponent(execArn)}/stop`, body),
  describeExecution: (id: string, execArn: string) => api.get(`/instances/${id}/resources/stepfunctions/executions/${encodeURIComponent(execArn)}`),

  // AppSync
  listAppSyncAPIs: (id: string) => api.get(`/instances/${id}/resources/appsync/apis`),
  createAppSyncAPI: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appsync/apis`, body),
  deleteAppSyncAPI: (id: string, apiId: string) => api.delete(`/instances/${id}/resources/appsync/apis/${apiId}`),
  getAppSyncSchema: (id: string, apiId: string) => api.get(`/instances/${id}/resources/appsync/apis/${apiId}/schema`),
  listDataSources: (id: string, apiId: string) => api.get(`/instances/${id}/resources/appsync/apis/${apiId}/datasources`),
  createDataSource: (id: string, apiId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appsync/apis/${apiId}/datasources`, body),
  deleteDataSource: (id: string, apiId: string, name: string) => api.delete(`/instances/${id}/resources/appsync/apis/${apiId}/datasources/${name}`),
  listAppSyncTypes: (id: string, apiId: string) => api.get(`/instances/${id}/resources/appsync/apis/${apiId}/types`),

  // AppConfig
  listAppConfigApps: (id: string) => api.get(`/instances/${id}/resources/appconfig/applications`),
  createAppConfigApp: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appconfig/applications`, body),
  deleteAppConfigApp: (id: string, appId: string) => api.delete(`/instances/${id}/resources/appconfig/applications/${appId}`),
  listAppConfigEnvs: (id: string, appId: string) => api.get(`/instances/${id}/resources/appconfig/applications/${appId}/environments`),
  createAppConfigEnv: (id: string, appId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appconfig/applications/${appId}/environments`, body),
  deleteAppConfigEnv: (id: string, appId: string, envId: string) => api.delete(`/instances/${id}/resources/appconfig/applications/${appId}/environments/${envId}`),
  listConfigProfiles: (id: string, appId: string) => api.get(`/instances/${id}/resources/appconfig/applications/${appId}/configurationprofiles`),
  createConfigProfile: (id: string, appId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appconfig/applications/${appId}/configurationprofiles`, body),
  startDeployment: (id: string, appId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/appconfig/applications/${appId}/deployments`, body),
  listDeployments: (id: string, appId: string, envId: string) => api.get(`/instances/${id}/resources/appconfig/applications/${appId}/environments/${envId}/deployments`),

  // CodeBuild
  listCodeBuildProjects: (id: string) => api.get(`/instances/${id}/resources/codebuild/projects`),
  createCodeBuildProject: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/codebuild/projects`, body),
  deleteCodeBuildProject: (id: string, name: string) => api.delete(`/instances/${id}/resources/codebuild/projects/${name}`),
  startBuild: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/codebuild/projects/${name}/build`, body),
  listBuilds: (id: string, name: string) => api.get(`/instances/${id}/resources/codebuild/projects/${name}/builds`),
  getBuild: (id: string, buildId: string) => api.get(`/instances/${id}/resources/codebuild/builds/${buildId}`),

  // CodeDeploy
  listCodeDeployApps: (id: string) => api.get(`/instances/${id}/resources/codedeploy/applications`),
  createCodeDeployApp: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/codedeploy/applications`, body),
  deleteCodeDeployApp: (id: string, name: string) => api.delete(`/instances/${id}/resources/codedeploy/applications/${name}`),
  listDeploymentGroups: (id: string, name: string) => api.get(`/instances/${id}/resources/codedeploy/applications/${name}/groups`),
  createDeploymentGroup: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/codedeploy/applications/${name}/groups`, body),
  createDeployment: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/codedeploy/deployments`, body),
  listCodeDeployDeployments: (id: string, name: string) => api.get(`/instances/${id}/resources/codedeploy/applications/${name}/deployments`),
  getDeployment: (id: string, deploymentId: string) => api.get(`/instances/${id}/resources/codedeploy/deployments/${deploymentId}`),

  // AWS Backup
  listBackupVaults: (id: string) => api.get(`/instances/${id}/resources/backup/vaults`),
  createBackupVault: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/backup/vaults`, body),
  deleteBackupVault: (id: string, name: string) => api.delete(`/instances/${id}/resources/backup/vaults/${name}`),
  listBackupPlans: (id: string) => api.get(`/instances/${id}/resources/backup/plans`),
  createBackupPlan: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/backup/plans`, body),
  deleteBackupPlan: (id: string, planId: string) => api.delete(`/instances/${id}/resources/backup/plans/${planId}`),
  listBackupJobs: (id: string) => api.get(`/instances/${id}/resources/backup/jobs/backup`),
  startBackupJob: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/backup/jobs/backup`, body),
  listRecoveryPoints: (id: string, vaultName: string) => api.get(`/instances/${id}/resources/backup/vaults/${vaultName}/recovery-points`),

  // Transfer Family
  listTransferServers: (id: string) => api.get(`/instances/${id}/resources/transfer/servers`),
  createTransferServer: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/transfer/servers`, body),
  deleteTransferServer: (id: string, serverId: string) => api.delete(`/instances/${id}/resources/transfer/servers/${serverId}`),
  startTransferServer: (id: string, serverId: string) => api.post(`/instances/${id}/resources/transfer/servers/${serverId}/start`),
  stopTransferServer: (id: string, serverId: string) => api.post(`/instances/${id}/resources/transfer/servers/${serverId}/stop`),
  listTransferUsers: (id: string, serverId: string) => api.get(`/instances/${id}/resources/transfer/servers/${serverId}/users`),
  createTransferUser: (id: string, serverId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/transfer/servers/${serverId}/users`, body),
  deleteTransferUser: (id: string, serverId: string, username: string) => api.delete(`/instances/${id}/resources/transfer/servers/${serverId}/users/${username}`),

  // Athena
  listAthenaWorkgroups: (id: string) => api.get(`/instances/${id}/resources/athena/workgroups`),
  createAthenaWorkgroup: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/athena/workgroups`, body),
  deleteAthenaWorkgroup: (id: string, name: string) => api.delete(`/instances/${id}/resources/athena/workgroups/${name}`),
  listAthenaDatabases: (id: string) => api.get(`/instances/${id}/resources/athena/databases`),
  runAthenaQuery: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/athena/queries`, body),
  getQueryExecution: (id: string, queryId: string) => api.get(`/instances/${id}/resources/athena/queries/${queryId}`),
  getQueryResults: (id: string, queryId: string) => api.get(`/instances/${id}/resources/athena/queries/${queryId}/results`),
  listQueryHistory: (id: string, workgroup?: string) => api.get(`/instances/${id}/resources/athena/query-history`, { params: workgroup ? { workgroup } : {} }),
  cancelQuery: (id: string, queryId: string) => api.post(`/instances/${id}/resources/athena/queries/${queryId}/cancel`),

  // Glue
  listGlueDatabases: (id: string) => api.get(`/instances/${id}/resources/glue/databases`),
  createGlueDatabase: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/glue/databases`, body),
  deleteGlueDatabase: (id: string, name: string) => api.delete(`/instances/${id}/resources/glue/databases/${name}`),
  listGlueTables: (id: string, dbName: string) => api.get(`/instances/${id}/resources/glue/databases/${dbName}/tables`),
  listGlueCrawlers: (id: string) => api.get(`/instances/${id}/resources/glue/crawlers`),
  createGlueCrawler: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/glue/crawlers`, body),
  deleteGlueCrawler: (id: string, name: string) => api.delete(`/instances/${id}/resources/glue/crawlers/${name}`),
  startGlueCrawler: (id: string, name: string) => api.post(`/instances/${id}/resources/glue/crawlers/${name}/start`),
  stopGlueCrawler: (id: string, name: string) => api.post(`/instances/${id}/resources/glue/crawlers/${name}/stop`),
  listGlueJobs: (id: string) => api.get(`/instances/${id}/resources/glue/jobs`),
  createGlueJob: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/glue/jobs`, body),
  deleteGlueJob: (id: string, name: string) => api.delete(`/instances/${id}/resources/glue/jobs/${name}`),
  startGlueJob: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/glue/jobs/${name}/start`, body),
  getJobRuns: (id: string, name: string) => api.get(`/instances/${id}/resources/glue/jobs/${name}/runs`),

  // Data Firehose
  listFirehoseStreams: (id: string) => api.get(`/instances/${id}/resources/firehose/delivery-streams`),
  createFirehoseStream: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/firehose/delivery-streams`, body),
  deleteFirehoseStream: (id: string, name: string) => api.delete(`/instances/${id}/resources/firehose/delivery-streams/${name}`),
  firehosePutRecord: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/firehose/delivery-streams/${name}/records`, body),
  firehosePutRecordBatch: (id: string, name: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/firehose/delivery-streams/${name}/records/batch`, body),

  // OpenSearch
  listOpenSearchDomains: (id: string) => api.get(`/instances/${id}/resources/opensearch/domains`),
  createOpenSearchDomain: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/opensearch/domains`, body),
  deleteOpenSearchDomain: (id: string, name: string) => api.delete(`/instances/${id}/resources/opensearch/domains/${name}`),
  describeOpenSearchDomain: (id: string, name: string) => api.get(`/instances/${id}/resources/opensearch/domains/${name}`),

  // Bedrock
  listBedrockModels: (id: string) => api.get(`/instances/${id}/resources/bedrock/models`),
  invokeBedrockModel: (id: string, modelId: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/bedrock/models/${modelId}/invoke`, body),

  // Textract
  textractDetectText: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/textract/documents/text`, body),
  textractAnalyzeForms: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/textract/documents/forms`, body),
  textractAnalyzeTables: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/textract/documents/tables`, body),
  textractAnalyzeQueries: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/textract/documents/queries`, body),
  textractStartJob: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/textract/jobs/start`, body),
  textractGetJob: (id: string, jobId: string) => api.get(`/instances/${id}/resources/textract/jobs/${jobId}`),

  // Transcribe
  startTranscriptionJob: (id: string, body: Record<string, unknown>) => api.post(`/instances/${id}/resources/transcribe/jobs`, body),
  listTranscriptionJobs: (id: string) => api.get(`/instances/${id}/resources/transcribe/jobs`),
  getTranscriptionJob: (id: string, name: string) => api.get(`/instances/${id}/resources/transcribe/jobs/${name}`),
  deleteTranscriptionJob: (id: string, name: string) => api.delete(`/instances/${id}/resources/transcribe/jobs/${name}`),
  getTranscript: (id: string, name: string) => api.get(`/instances/${id}/resources/transcribe/jobs/${name}/transcript`),

  // Monitoring — CloudWatch Logs
  listLogGroups: (id: string) =>
    api.get<LogGroup[]>(`/instances/${id}/monitoring/log-groups`),
  listLogStreams: (id: string, group: string) =>
    api.get<LogStream[]>(`/instances/${id}/monitoring/log-groups/${encodeURIComponent(group)}/streams`),
  getLogEvents: (id: string, group: string, params: LogEventsParams = {}) =>
    api.get<LogEventsResponse>(`/instances/${id}/monitoring/log-groups/${encodeURIComponent(group)}/events`, { params }),

  // Monitoring — CloudWatch Metrics
  listNamespaces: (id: string) =>
    api.get<string[]>(`/instances/${id}/monitoring/metrics/namespaces`),
  listMetrics: (id: string, namespace?: string) =>
    api.get<MetricDef[]>(`/instances/${id}/monitoring/metrics`, { params: namespace ? { namespace } : {} }),
  getMetricData: (id: string, params: MetricDataParams) =>
    api.get<MetricDataResponse>(`/instances/${id}/monitoring/metrics/data`, { params }),
}

export interface LogGroup {
  name: string
  retention_days: number | null
  stored_bytes: number
}

export interface LogStream {
  name: string
  first_event_time: number | null
  last_event_time: number | null
  stored_bytes: number
}

export interface LogEvent {
  timestamp: number
  message: string
  stream: string
}

export interface LogEventsParams {
  stream?: string
  start?: number
  end?: number
  filter?: string
  limit?: number
  next_token?: string
}

export interface LogEventsResponse {
  events: LogEvent[]
  next_token: string | null
}

export interface MetricDef {
  name: string
  namespace: string
  dimensions: { Name: string; Value: string }[]
}

export interface MetricDataParams {
  namespace: string
  metric_name: string
  statistic?: string
  period?: number
  start?: number
  end?: number
  dimension_name?: string
  dimension_value?: string
}

export interface MetricDataResponse {
  datapoints: { timestamp: string; value: number }[]
  unit: string
}
