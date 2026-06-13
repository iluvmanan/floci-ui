"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BarChart3,
  Database,
  FileText,
  Home,
  Key,
  LayoutDashboard,
  LogOut,
  Server,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const mainNav = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/instances", icon: Server, label: "Instances" },
]

const settingsNav = [
  { href: "/settings/users", icon: Users, label: "Users", role: "admin" },
  { href: "/settings/audit", icon: ShieldCheck, label: "Audit Log", role: "admin" },
  { href: "/settings/api-keys", icon: Key, label: "API Keys" },
  { href: "/settings/system", icon: Settings, label: "System", role: "admin" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push("/login")
    toast.success("Signed out")
  }

  const canAccess = (role?: string) => {
    if (!role || !user) return true
    const hierarchy = { superadmin: 4, admin: 3, operator: 2, viewer: 1 }
    return (hierarchy[user.role] ?? 0) >= (hierarchy[role as keyof typeof hierarchy] ?? 0)
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <span className="font-semibold text-base">Floci Console</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {mainNav.map(({ href, icon: Icon, label }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={pathname === href}>
                  <Link href={href}>
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsNav
              .filter(({ role }) => canAccess(role))
              .map(({ href, icon: Icon, label }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(href)}>
                    <Link href={href}>
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user?.full_name?.slice(0, 2).toUpperCase() ?? user?.email.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name ?? user?.email}</p>
            <Badge variant="outline" className="text-xs capitalize">
              {user?.role}
            </Badge>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
