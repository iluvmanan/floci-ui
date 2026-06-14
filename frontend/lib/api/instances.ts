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

  // SNS
  listTopics: (id: string) => api.get(`/instances/${id}/resources/sns/topics`),
  createTopic: (id: string, topic_name: string, fifo = false) =>
    api.post(`/instances/${id}/resources/sns/topics`, { topic_name, fifo }),
  deleteTopic: (id: string, arn: string) =>
    api.delete(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}`),
  publishMessage: (id: string, arn: string, message: string) =>
    api.post(`/instances/${id}/resources/sns/topics/${encodeURIComponent(arn)}/publish`, { message }),

  // Kinesis
  listStreams: (id: string) => api.get(`/instances/${id}/resources/kinesis/streams`),
  createStream: (id: string, stream_name: string, shard_count = 1) =>
    api.post(`/instances/${id}/resources/kinesis/streams`, { stream_name, shard_count }),
  deleteStream: (id: string, name: string) =>
    api.delete(`/instances/${id}/resources/kinesis/streams/${name}`),

  // EventBridge
  listBuses: (id: string) => api.get(`/instances/${id}/resources/eventbridge/buses`),
  createBus: (id: string, bus_name: string) =>
    api.post(`/instances/${id}/resources/eventbridge/buses`, { bus_name }),

  // Cognito
  listUserPools: (id: string) => api.get(`/instances/${id}/resources/cognito/user-pools`),
  listUsers: (id: string, pool_id: string) =>
    api.get(`/instances/${id}/resources/cognito/user-pools/${pool_id}/users`),
  createUser: (id: string, pool_id: string, body: { username: string; email: string; temp_password: string }) =>
    api.post(`/instances/${id}/resources/cognito/user-pools/${pool_id}/users`, body),

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
