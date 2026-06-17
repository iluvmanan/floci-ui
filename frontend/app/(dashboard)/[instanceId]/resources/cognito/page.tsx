"use client"

import { useEffect, useState } from "react"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Plus, RefreshCw, Trash2, User, Users } from "lucide-react"
import { toast } from "sonner"

interface Pool {
  id: string
  name: string
}

interface PoolDetail {
  id: string
  name: string
  status: string
  mfa_configuration: string
  estimated_number_of_users: number
  creation_date: string
  last_modified_date: string
}

interface CognitoUser {
  username: string
  status: string
  enabled: boolean
  attributes: Record<string, string>
}

interface AppClient {
  client_id: string
  client_name: string
}

interface AttrRow {
  Name: string
  Value: string
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

  // Edit attributes
  const [editAttrsOpen, setEditAttrsOpen] = useState(false)
  const [editAttrsUser, setEditAttrsUser] = useState<string | null>(null)
  const [attrRows, setAttrRows] = useState<AttrRow[]>([])

  // App clients
  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [clientName, setClientName] = useState("")
  const [generateSecret, setGenerateSecret] = useState(false)
  const [newClientSecret, setNewClientSecret] = useState<string | null>(null)
  const [newClientId, setNewClientId] = useState<string | null>(null)

  const { data: pools = [], isLoading: poolsLoading, refetch } = useQuery({
    queryKey: ["cognito-pools", instanceId],
    queryFn: () => instancesApi.listUserPools(instanceId).then((r) => r.data as Pool[]),
  })

  const { data: poolDetail } = useQuery({
    queryKey: ["cognito-pool-detail", instanceId, selectedPool?.id],
    queryFn: () =>
      instancesApi.describeUserPool(instanceId, selectedPool!.id).then((r) => r.data as PoolDetail),
    enabled: !!selectedPool,
  })

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["cognito-users", instanceId, selectedPool?.id],
    queryFn: () =>
      instancesApi.listUsers(instanceId, selectedPool!.id).then((r) => r.data as CognitoUser[]),
    enabled: !!selectedPool,
  })

  const { data: appClients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ["cognito-app-clients", instanceId, selectedPool?.id],
    queryFn: () =>
      instancesApi.listAppClients(instanceId, selectedPool!.id).then((r) => r.data as AppClient[]),
    enabled: !!selectedPool,
  })

  // When editing a user's attrs, pre-fill from their attributes
  function openEditAttrs(u: CognitoUser) {
    setEditAttrsUser(u.username)
    setAttrRows(
      Object.entries(u.attributes).map(([Name, Value]) => ({ Name, Value }))
    )
    setEditAttrsOpen(true)
  }

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

  const enableMutation = useMutation({
    mutationFn: (username: string) => instancesApi.enableUser(instanceId, selectedPool!.id, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cognito-users", instanceId, selectedPool?.id] })
      toast.success("User enabled")
    },
    onError: () => toast.error("Failed to enable user"),
  })

  const disableMutation = useMutation({
    mutationFn: (username: string) => instancesApi.disableUser(instanceId, selectedPool!.id, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cognito-users", instanceId, selectedPool?.id] })
      toast.success("User disabled")
    },
    onError: () => toast.error("Failed to disable user"),
  })

  const resetPasswordMutation = useMutation({
    mutationFn: (username: string) =>
      instancesApi.resetUserPassword(instanceId, selectedPool!.id, username),
    onSuccess: () => toast.success("Password reset initiated"),
    onError: () => toast.error("Failed to reset password"),
  })

  const updateAttrsMutation = useMutation({
    mutationFn: () =>
      instancesApi.updateUserAttributes(instanceId, selectedPool!.id, editAttrsUser!, attrRows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cognito-users", instanceId, selectedPool?.id] })
      setEditAttrsOpen(false)
      toast.success("Attributes updated")
    },
    onError: () => toast.error("Failed to update attributes"),
  })

  const createClientMutation = useMutation({
    mutationFn: () =>
      instancesApi.createAppClient(instanceId, selectedPool!.id, {
        client_name: clientName,
        generate_secret: generateSecret,
      }),
    onSuccess: (r) => {
      const data = r.data as { client_id: string; client_name: string; client_secret: string | null }
      qc.invalidateQueries({ queryKey: ["cognito-app-clients", instanceId, selectedPool?.id] })
      setCreateClientOpen(false)
      setNewClientId(data.client_id)
      setNewClientSecret(data.client_secret)
      setClientName("")
      setGenerateSecret(false)
      toast.success(`App client "${data.client_name}" created`)
    },
    onError: () => toast.error("Failed to create app client"),
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

        {/* Detail panel */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedPool ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a user pool to view details
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

              {/* Pool settings banner */}
              {poolDetail && (
                <div className="px-3 py-2 bg-muted/20 border-b flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span className="text-muted-foreground">MFA: <span className="font-medium text-foreground">{poolDetail.mfa_configuration}</span></span>
                  <span className="text-muted-foreground">Est. Users: <span className="font-medium text-foreground">{poolDetail.estimated_number_of_users}</span></span>
                  <span className="text-muted-foreground">Created: <span className="font-medium text-foreground">{poolDetail.creation_date ? new Date(poolDetail.creation_date).toLocaleDateString() : "—"}</span></span>
                </div>
              )}

              <Tabs defaultValue="users" className="p-3">
                <TabsList>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="app-clients">App Clients</TabsTrigger>
                </TabsList>

                <TabsContent value="users" className="pt-3">
                  {usersLoading ? (
                    <div className="space-y-2">
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
                            {canMutate && <TableHead className="w-52" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground text-sm h-32">
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
                                    {!u.enabled && (
                                      <Badge variant="secondary" className="text-xs">disabled</Badge>
                                    )}
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
                                {canMutate && (
                                  <TableCell>
                                    <div className="flex gap-1 flex-wrap">
                                      {u.enabled ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs"
                                          onClick={() => disableMutation.mutate(u.username)}
                                          disabled={disableMutation.isPending}
                                        >
                                          Disable
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 text-xs"
                                          onClick={() => enableMutation.mutate(u.username)}
                                          disabled={enableMutation.isPending}
                                        >
                                          Enable
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => resetPasswordMutation.mutate(u.username)}
                                        disabled={resetPasswordMutation.isPending}
                                      >
                                        Reset Pwd
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => openEditAttrs(u)}
                                      >
                                        Edit Attrs
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="app-clients" className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">App Clients ({appClients.length})</span>
                    {canMutate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setClientName(""); setGenerateSecret(false); setCreateClientOpen(true) }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Create App Client
                      </Button>
                    )}
                  </div>
                  {clientsLoading ? (
                    <div className="space-y-2">
                      {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                    </div>
                  ) : appClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No app clients</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Client Name</TableHead>
                          <TableHead className="font-mono text-xs">Client ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appClients.map((c) => (
                          <TableRow key={c.client_id}>
                            <TableCell className="text-sm">{c.client_name}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">{c.client_id}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Create User Dialog */}
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

      {/* Edit Attributes Dialog */}
      <Dialog open={editAttrsOpen} onOpenChange={setEditAttrsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Attributes — {editAttrsUser}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-72 overflow-auto">
            {attrRows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Name"
                  className="h-7 text-xs"
                  value={row.Name}
                  onChange={(e) => {
                    const updated = [...attrRows]
                    updated[i] = { ...updated[i], Name: e.target.value }
                    setAttrRows(updated)
                  }}
                />
                <Input
                  placeholder="Value"
                  className="h-7 text-xs"
                  value={row.Value}
                  onChange={(e) => {
                    const updated = [...attrRows]
                    updated[i] = { ...updated[i], Value: e.target.value }
                    setAttrRows(updated)
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setAttrRows(attrRows.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            {attrRows.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No attributes</p>
            )}
          </div>
          <div className="flex gap-2 justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAttrRows([...attrRows, { Name: "", Value: "" }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Attribute
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAttrsOpen(false)}>Cancel</Button>
            <Button onClick={() => updateAttrsMutation.mutate()} disabled={updateAttrsMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create App Client Dialog */}
      <Dialog open={createClientOpen} onOpenChange={setCreateClientOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create App Client — {selectedPool?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Client Name</label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={generateSecret}
                onCheckedChange={setGenerateSecret}
                id="gen-secret"
              />
              <label htmlFor="gen-secret" className="text-sm font-medium cursor-pointer">Generate Client Secret</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClientOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createClientMutation.mutate()}
              disabled={!clientName || createClientMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Client Secret Dialog */}
      <Dialog open={!!newClientId} onOpenChange={() => { setNewClientId(null); setNewClientSecret(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>App Client Created</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Client ID</p>
              <p className="font-mono text-sm break-all">{newClientId}</p>
            </div>
            {newClientSecret && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Client Secret (shown once)</p>
                <p className="font-mono text-sm break-all bg-muted rounded p-2">{newClientSecret}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { setNewClientId(null); setNewClientSecret(null) }}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
