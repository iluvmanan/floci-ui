export type { User } from "@/lib/api/auth"
export type { Instance } from "@/lib/api/instances"

export type UserRole = "superadmin" | "admin" | "operator" | "viewer"

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  superadmin: 4,
  admin: 3,
  operator: 2,
  viewer: 1,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}
