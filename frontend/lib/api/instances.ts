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

  exportConfig: (id: string, format: "env" | "docker-compose" | "json") =>
    api.get(`/instances/${id}/config/export`, { params: { format }, responseType: "blob" }),

  listServices: (id: string) => api.get(`/instances/${id}/services`),

  updateService: (id: string, service: string, enabled: boolean) =>
    api.put(`/instances/${id}/services/${service}`, { enabled }),
}
