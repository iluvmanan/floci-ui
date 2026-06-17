"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, RefreshCw, Trash2, Pencil } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface UserRecord {
  id: string
  email: string
  full_name: string | null
  role: "superadmin" | "admin" | "operator" | "viewer"
  is_active: boolean
  created_at: string
}

interface UsersListResponse {
  items: UserRecord[]
  total: number
  page: number
  pages: number
}

const usersApi = {
  list: () => api.get<UsersListResponse>("/users"),
  create: (body: { email: string; full_name?: string; role: string; password: string }) =>
    api.post<UserRecord>("/users", body),
  update: (id: string, body: { full_name?: string; role?: string; is_active?: boolean }) =>
    api.put<UserRecord>(`/users/${id}`, body),
  remove: (id: string) => api.delete(`/users/${id}`),
}

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-red-500/10 text-red-600",
  admin: "bg-orange-500/10 text-orange-600",
  operator: "bg-blue-500/10 text-blue-600",
  viewer: "bg-gray-500/10 text-gray-600",
}

const ROLES = ["superadmin", "admin", "operator", "viewer"]

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("viewer")
  const [password, setPassword] = useState("")

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.create({ email, full_name: fullName || undefined, role, password }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("User created")
      onClose()
      setEmail(""); setFullName(""); setRole("viewer"); setPassword("")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !email || !password}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditUserDialog({
  user,
  onClose,
}: {
  user: UserRecord | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [fullName, setFullName] = useState(user?.full_name ?? "")
  const [role, setRole] = useState(user?.role ?? "viewer")

  const { mutate, isPending } = useMutation({
    mutationFn: () => usersApi.update(user!.id, { full_name: fullName || undefined, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("User updated")
      onClose()
    },
  })

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRecord | null>(null)
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { mutate: deactivate } = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] })
      toast.success("User deactivated")
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Users</h2>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} user${data.total !== 1 ? "s" : ""}` : "Manage console access"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </div>

      <div className="border rounded-lg divide-y">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))
        ) : data?.items.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>
        ) : (
          data?.items.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{u.email}</p>
                {u.full_name && (
                  <p className="text-xs text-muted-foreground truncate">{u.full_name}</p>
                )}
              </div>
              <Badge className={`text-xs shrink-0 ${ROLE_COLORS[u.role]}`} variant="secondary">
                {u.role}
              </Badge>
              <Badge variant={u.is_active ? "outline" : "secondary"} className="text-xs shrink-0">
                {u.is_active ? "Active" : "Inactive"}
              </Badge>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditUser(u)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {u.id !== currentUser?.id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deactivate(u.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />
    </div>
  )
}
