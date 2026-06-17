"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TransferServer {
  server_id: string
  arn: string
  protocols: string[]
  endpoint_type: string
  state: string
  user_count: number
  endpoint: string
  identity_provider_type: string
}

interface TransferUser {
  user_name: string
  arn: string
  home_directory: string
  role: string
  ssh_public_key_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied")
}

function stateBadge(state: string) {
  const variants: Record<string, string> = {
    ONLINE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    OFFLINE: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    STARTING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    STOPPING: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    START_FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    STOP_FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[state] ?? "bg-gray-100 text-gray-600"}`}>
      {state || "—"}
    </span>
  )
}

const PROTOCOL_OPTIONS = ["SFTP", "FTP", "FTPS"]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransferPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedServer, setSelectedServer] = useState<TransferServer | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TransferServer | null>(null)

  const { data: servers = [], isLoading, refetch } = useQuery({
    queryKey: ["transfer-servers", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listTransferServers(instanceId)
      return r.data as TransferServer[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteTransferServer(instanceId, id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["transfer-servers", instanceId] })
      setDeleteTarget(null)
      if (selectedServer?.server_id === id) setSelectedServer(null)
      toast.success("Server deleted")
    },
    onError: () => toast.error("Failed to delete server"),
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => instancesApi.startTransferServer(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-servers", instanceId] })
      toast.success("Server starting")
    },
    onError: () => toast.error("Failed to start server"),
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => instancesApi.stopTransferServer(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-servers", instanceId] })
      toast.success("Server stopping")
    },
    onError: () => toast.error("Failed to stop server"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Transfer Family</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Server
            </Button>
          )}
        </div>
      </div>

      {selectedServer ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedServer(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Servers
          </Button>
          <UsersPanel instanceId={instanceId} server={selectedServer} canMutate={canMutate} />
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Server ID</TableHead>
                <TableHead>Protocols</TableHead>
                <TableHead>Endpoint Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Users</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {servers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">No servers found</TableCell>
                </TableRow>
              ) : servers.map((s) => (
                <TableRow key={s.server_id} className="cursor-pointer" onClick={() => setSelectedServer(s)}>
                  <TableCell className="font-mono text-sm">{s.server_id}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.protocols?.map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.endpoint_type}</TableCell>
                  <TableCell>{stateBadge(s.state)}</TableCell>
                  <TableCell className="text-sm">{s.user_count}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canMutate && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={s.state === "ONLINE" || s.state === "STARTING" || startMutation.isPending}
                          onClick={() => startMutation.mutate(s.server_id)}
                        >
                          Start
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={s.state === "OFFLINE" || s.state === "STOPPING" || stopMutation.isPending}
                          onClick={() => stopMutation.mutate(s.server_id)}
                        >
                          Stop
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(s)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateServerDialog open={createOpen} onClose={() => setCreateOpen(false)} instanceId={instanceId} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Server</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete server <span className="font-mono font-medium text-foreground">{deleteTarget?.server_id}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.server_id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Server Dialog ───────────────────────────────────────────────────────

function CreateServerDialog({
  open,
  onClose,
  instanceId,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
}) {
  const qc = useQueryClient()
  const [protocols, setProtocols] = useState<string[]>(["SFTP"])
  const [endpointType, setEndpointType] = useState("PUBLIC")
  const [identityProviderType, setIdentityProviderType] = useState("SERVICE_MANAGED")

  function reset() {
    setProtocols(["SFTP"])
    setEndpointType("PUBLIC")
    setIdentityProviderType("SERVICE_MANAGED")
  }

  function toggleProtocol(p: string) {
    setProtocols((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createTransferServer(instanceId, {
        protocols,
        endpoint_type: endpointType,
        identity_provider_type: identityProviderType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-servers", instanceId] })
      onClose()
      reset()
      toast.success("Server created")
    },
    onError: () => toast.error("Failed to create server"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Transfer Server</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Protocols</Label>
            <div className="flex gap-4">
              {PROTOCOL_OPTIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={protocols.includes(p)} onChange={() => toggleProtocol(p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Endpoint Type</Label>
            <Select value={endpointType} onValueChange={(v) => v && setEndpointType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">PUBLIC</SelectItem>
                <SelectItem value="VPC">VPC</SelectItem>
                <SelectItem value="VPC_ENDPOINT">VPC_ENDPOINT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Identity Provider Type</Label>
            <Select value={identityProviderType} onValueChange={(v) => v && setIdentityProviderType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SERVICE_MANAGED">SERVICE_MANAGED</SelectItem>
                <SelectItem value="API_GATEWAY">API_GATEWAY</SelectItem>
                <SelectItem value="AWS_DIRECTORY_SERVICE">AWS_DIRECTORY_SERVICE</SelectItem>
                <SelectItem value="AWS_LAMBDA">AWS_LAMBDA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={protocols.length === 0 || createMutation.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Users Panel ────────────────────────────────────────────────────────────────

function UsersPanel({
  instanceId,
  server,
  canMutate,
}: {
  instanceId: string
  server: TransferServer
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TransferUser | null>(null)

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["transfer-users", instanceId, server.server_id],
    queryFn: async () => {
      const r = await instancesApi.listTransferUsers(instanceId, server.server_id)
      return r.data as TransferUser[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (username: string) => instancesApi.deleteTransferUser(instanceId, server.server_id, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-users", instanceId, server.server_id] })
      setDeleteTarget(null)
      toast.success("User deleted")
    },
    onError: () => toast.error("Failed to delete user"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium font-mono">{server.server_id}</h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create User
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Home Directory</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>SSH Keys</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No users found</TableCell>
                </TableRow>
              ) : users.map((u) => (
                <TableRow key={u.user_name}>
                  <TableCell className="font-medium text-sm">{u.user_name}</TableCell>
                  <TableCell className="font-mono text-xs">{u.home_directory || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{u.role || "—"}</TableCell>
                  <TableCell className="text-sm">{u.ssh_public_key_count}</TableCell>
                  <TableCell>
                    {canMutate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(u)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateUserDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        instanceId={instanceId}
        server={server}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete user <span className="font-mono font-medium text-foreground">{deleteTarget?.user_name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.user_name)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateUserDialog({
  open,
  onClose,
  instanceId,
  server,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  server: TransferServer
}) {
  const qc = useQueryClient()
  const [username, setUsername] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [homeDirectory, setHomeDirectory] = useState("")
  const [sshPublicKey, setSshPublicKey] = useState("")

  function reset() {
    setUsername("")
    setRoleArn("")
    setHomeDirectory("")
    setSshPublicKey("")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createTransferUser(instanceId, server.server_id, {
        user_name: username,
        role: roleArn,
        ...(homeDirectory ? { home_directory: homeDirectory } : {}),
        ...(sshPublicKey ? { ssh_public_key_body: sshPublicKey } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-users", instanceId, server.server_id] })
      onClose()
      reset()
      toast.success("User created")
    },
    onError: () => toast.error("Failed to create user"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Transfer User</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>IAM Role ARN</Label>
            <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} placeholder="arn:aws:iam::..." />
          </div>
          <div className="space-y-1">
            <Label>Home Directory</Label>
            <Input value={homeDirectory} onChange={(e) => setHomeDirectory(e.target.value)} placeholder="/bucket/prefix" />
          </div>
          <div className="space-y-1">
            <Label>SSH Public Key (optional)</Label>
            <Textarea value={sshPublicKey} onChange={(e) => setSshPublicKey(e.target.value)} placeholder="ssh-rsa AAAA..." rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!username || !roleArn || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
