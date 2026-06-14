import { api } from "./client"

// ── Audit Logs ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string
  user_id: string | null
  user_email: string | null
  instance_id: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  ip_address: string | null
  created_at: string
}

export interface AuditListResponse {
  items: AuditEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditParams {
  instance_id?: string
  user_email?: string
  action?: string
  limit?: number
  offset?: number
}

// ── API Keys ───────────────────────────────────────────────────────────────

export interface ApiKeyRecord {
  id: string
  name: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

export interface ApiKeyCreated extends ApiKeyRecord {
  key: string  // raw key shown once
}

export interface ApiKeyCreate {
  name: string
  scopes: string[]
  expires_at?: string
}

// ── System Info ────────────────────────────────────────────────────────────

export interface SystemHealth {
  status: string
  db: boolean
  version: string
  uptime_s: number
}

export interface SystemInfo {
  version: string
  started_at: string
  uptime_s: number
  user_count: number
  instance_count: number
}

// ── API ────────────────────────────────────────────────────────────────────

export const settingsApi = {
  listAudit: (params: AuditParams = {}) =>
    api.get<AuditListResponse>("/audit", { params }),

  exportAuditCsv: (params: Omit<AuditParams, "limit" | "offset"> = {}) =>
    api.get("/audit/export", { params, responseType: "blob" }),

  listApiKeys: () => api.get<ApiKeyRecord[]>("/api-keys"),

  createApiKey: (body: ApiKeyCreate) =>
    api.post<ApiKeyCreated>("/api-keys", body),

  revokeApiKey: (id: string) => api.delete(`/api-keys/${id}`),

  getHealth: () => api.get<SystemHealth>("/system/health"),

  getInfo: () => api.get<SystemInfo>("/system/info"),
}
