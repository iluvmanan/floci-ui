import { api } from "./client"

export interface User {
  id: string
  email: string
  full_name: string | null
  role: "superadmin" | "admin" | "operator" | "viewer"
  is_active: boolean
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<User>("/auth/login", { email, password }),

  logout: () => api.post("/auth/logout"),

  me: () => api.get<User>("/auth/me"),

  refresh: () => api.post("/auth/refresh"),

  isFirstRun: () => api.get<{ is_first_run: boolean }>("/auth/first-run"),

  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change-password", { current_password, new_password }),
}
