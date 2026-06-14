"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Plus, RefreshCw, User, Users } from "lucide-react"
import { toast } from "sonner"

interface Pool {
  id: string
  name: string
}

interface CognitoUser {
  username: string
  status: string
  enabled: boolean
  attributes: Record<string, string>
}

export default function CognitoPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [tempPassword, setTempPassword] = useState("")

  const { data: pools = [], isLoading: poolsLoading, refetch } = useQuery({
    queryKey: ["cognito-pools", instanceId],
    queryFn: () => instancesApi.listUserPools(instanceId).then((r) => r.data as Pool[]),
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["cognito-users", instanceId, selectedPool?.id],
    queryFn: () =>
      instancesApi.listUsers(instanceId, selectedPool!.id).then((r) => r.data as CognitoUser[]),
    enabled: !!selectedPool,
  })

  const createUserMutation = useMutation({
    mutationFn: () =>
      instancesApi.createUser(instanceId, selectedPool!.id, {
        username: newUsername,
        email: newEmail,
        temp_password: tempPassword,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cognito-users", instanceId, selectedPool?.id] })
      setCreateUserOpen(false)
      setNewUsername("")
      setNewEmail("")
      setTempPassword("")
      toast.success(`User "${newUsername}" created`)
    },
    onError: () => toast.error("Failed to create user"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Cognito User Pools</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pool list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            User Pools ({pools.length})
          </div>
          {poolsLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : pools.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No user pools found</div>
          ) : (
            <ul>
              {pools.map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedPool?.id === p.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedPool(p)}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 shrink-0 text-indigo-500" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{p.id}</div>
                    </div>
                  </span>
                  {selectedPool?.id === p.id && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* User list */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedPool ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a user pool to view users
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedPool.name}
                </span>
                {canMutate && (
                  <Button size="sm" variant="outline" onClick={() => setCreateUserOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create User
                  </Button>
                )}
              </div>
              {usersLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground text-sm h-32">
                          No users in this pool
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow key={u.username}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-mono text-sm">{u.username}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={u.status === "CONFIRMED" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {u.attributes?.email ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create User — {selectedPool?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Username</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Temporary Password</label>
              <Input type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createUserMutation.mutate()}
              disabled={!newUsername || !newEmail || !tempPassword || createUserMutation.isPending}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
