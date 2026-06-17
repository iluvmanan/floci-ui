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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, ChevronRight, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface IAMUser {
  username: string
  user_id: string
  arn: string
  create_date: string
  path: string
}

interface IAMRole {
  role_name: string
  role_id: string
  arn: string
  create_date: string
  description: string
}

interface IAMPolicy {
  policy_name: string
  policy_id: string
  arn: string
  create_date: string
  description: string
}

interface IAMGroup {
  group_name: string
  group_id: string
  arn: string
  create_date: string
  path: string
}

interface AttachedPolicy {
  policy_name: string
  policy_arn: string
}

interface AccessKey {
  access_key_id: string
  status: string
  create_date: string
}

interface GroupMember {
  username: string
  arn: string
}

function truncateArn(arn: string) {
  if (arn.length <= 40) return arn
  return "..." + arn.slice(-37)
}

// ─── User Expanded Row ───────────────────────────────────────────────────────

function UserExpandedRow({
  instanceId,
  username,
  canMutate,
}: {
  instanceId: string
  username: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [attachPolicyOpen, setAttachPolicyOpen] = useState(false)
  const [policyArn, setPolicyArn] = useState("")
  const [newKey, setNewKey] = useState<{ access_key_id: string; secret_access_key: string } | null>(null)

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ["iam-user-policies", instanceId, username],
    queryFn: () => instancesApi.listUserPolicies(instanceId, username).then((r) => r.data as AttachedPolicy[]),
  })

  const { data: keys = [], isLoading: keysLoading } = useQuery({
    queryKey: ["iam-access-keys", instanceId, username],
    queryFn: () => instancesApi.listAccessKeys(instanceId, username).then((r) => r.data as AccessKey[]),
  })

  const detachPolicyMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.detachUserPolicy(instanceId, username, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-user-policies", instanceId, username] })
      toast.success("Policy detached")
    },
    onError: () => toast.error("Failed to detach policy"),
  })

  const attachPolicyMutation = useMutation({
    mutationFn: () => instancesApi.attachUserPolicy(instanceId, username, policyArn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-user-policies", instanceId, username] })
      setAttachPolicyOpen(false)
      setPolicyArn("")
      toast.success("Policy attached")
    },
    onError: () => toast.error("Failed to attach policy"),
  })

  const createKeyMutation = useMutation({
    mutationFn: () => instancesApi.createAccessKey(instanceId, username),
    onSuccess: (r) => {
      const data = r.data as { access_key_id: string; secret_access_key: string }
      qc.invalidateQueries({ queryKey: ["iam-access-keys", instanceId, username] })
      setNewKey(data)
      toast.success("Access key created")
    },
    onError: () => toast.error("Failed to create access key"),
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: string) => instancesApi.deleteAccessKey(instanceId, username, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-access-keys", instanceId, username] })
      toast.success("Access key deleted")
    },
    onError: () => toast.error("Failed to delete access key"),
  })

  return (
    <div className="p-3 space-y-4 bg-muted/20 border-t">
      {/* Policies */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attached Policies</span>
          {canMutate && (
            <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAttachPolicyOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Attach
            </Button>
          )}
        </div>
        {policiesLoading ? (
          <Skeleton className="h-8" />
        ) : policies.length === 0 ? (
          <p className="text-xs text-muted-foreground">No policies attached</p>
        ) : (
          <div className="space-y-1">
            {policies.map((p) => (
              <div key={p.policy_arn} className="flex items-center justify-between bg-background rounded px-2 py-1">
                <div>
                  <span className="text-xs font-medium">{p.policy_name}</span>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">{truncateArn(p.policy_arn)}</span>
                </div>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => detachPolicyMutation.mutate(p.policy_arn)}
                    disabled={detachPolicyMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access Keys */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Access Keys</span>
          {canMutate && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => createKeyMutation.mutate()}
              disabled={createKeyMutation.isPending}
            >
              <Plus className="h-3 w-3 mr-1" />
              Create Key
            </Button>
          )}
        </div>
        {keysLoading ? (
          <Skeleton className="h-8" />
        ) : keys.length === 0 ? (
          <p className="text-xs text-muted-foreground">No access keys</p>
        ) : (
          <div className="space-y-1">
            {keys.map((k) => (
              <div key={k.access_key_id} className="flex items-center justify-between bg-background rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{k.access_key_id}</span>
                  <Badge variant={k.status === "Active" ? "default" : "secondary"} className="text-xs">{k.status}</Badge>
                </div>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => deleteKeyMutation.mutate(k.access_key_id)}
                    disabled={deleteKeyMutation.isPending}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attach policy dialog */}
      <Dialog open={attachPolicyOpen} onOpenChange={setAttachPolicyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attach Policy — {username}</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Policy ARN</label>
            <Input value={policyArn} onChange={(e) => setPolicyArn(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachPolicyOpen(false)}>Cancel</Button>
            <Button onClick={() => attachPolicyMutation.mutate()} disabled={!policyArn || attachPolicyMutation.isPending}>Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New key secret dialog */}
      <Dialog open={!!newKey} onOpenChange={() => setNewKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Access Key Created (shown once)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Access Key ID</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm bg-muted rounded px-2 py-1 flex-1">{newKey?.access_key_id}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(newKey?.access_key_id ?? ""); toast.success("Copied") }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Secret Access Key (shown once — copy now!)</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-sm bg-muted rounded px-2 py-1 flex-1 break-all">{newKey?.secret_access_key}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { navigator.clipboard.writeText(newKey?.secret_access_key ?? ""); toast.success("Copied") }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKey(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Role/Policy expand for attached policies ────────────────────────────────

function RoleExpandedRow({
  instanceId,
  roleName,
  canMutate,
}: {
  instanceId: string
  roleName: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [attachOpen, setAttachOpen] = useState(false)
  const [policyArn, setPolicyArn] = useState("")

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["iam-role-policies", instanceId, roleName],
    queryFn: () => instancesApi.listRolePolicies(instanceId, roleName).then((r) => r.data as AttachedPolicy[]),
  })

  const detachMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.detachRolePolicy(instanceId, roleName, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-role-policies", instanceId, roleName] })
      toast.success("Policy detached")
    },
    onError: () => toast.error("Failed to detach policy"),
  })

  const attachMutation = useMutation({
    mutationFn: () => instancesApi.attachRolePolicy(instanceId, roleName, policyArn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-role-policies", instanceId, roleName] })
      setAttachOpen(false)
      setPolicyArn("")
      toast.success("Policy attached")
    },
    onError: () => toast.error("Failed to attach policy"),
  })

  return (
    <div className="p-3 bg-muted/20 border-t">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attached Policies</span>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAttachOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Attach
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-8" />
      ) : policies.length === 0 ? (
        <p className="text-xs text-muted-foreground">No policies attached</p>
      ) : (
        <div className="space-y-1">
          {policies.map((p) => (
            <div key={p.policy_arn} className="flex items-center justify-between bg-background rounded px-2 py-1">
              <div>
                <span className="text-xs font-medium">{p.policy_name}</span>
                <span className="text-xs text-muted-foreground ml-2 font-mono">{truncateArn(p.policy_arn)}</span>
              </div>
              {canMutate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => detachMutation.mutate(p.policy_arn)}
                  disabled={detachMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Attach Policy — {roleName}</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Policy ARN</label>
            <Input value={policyArn} onChange={(e) => setPolicyArn(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancel</Button>
            <Button onClick={() => attachMutation.mutate()} disabled={!policyArn || attachMutation.isPending}>Attach</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Group Members expand ─────────────────────────────────────────────────────

function GroupExpandedRow({
  instanceId,
  groupName,
  canMutate,
}: {
  instanceId: string
  groupName: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [username, setUsername] = useState("")

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["iam-group-members", instanceId, groupName],
    queryFn: () => instancesApi.listGroupMembers(instanceId, groupName).then((r) => r.data as GroupMember[]),
  })

  const addMutation = useMutation({
    mutationFn: () => instancesApi.addUserToGroup(instanceId, groupName, username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-group-members", instanceId, groupName] })
      setAddOpen(false)
      setUsername("")
      toast.success("User added to group")
    },
    onError: () => toast.error("Failed to add user"),
  })

  const removeMutation = useMutation({
    mutationFn: (u: string) => instancesApi.removeUserFromGroup(instanceId, groupName, u),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-group-members", instanceId, groupName] })
      toast.success("User removed from group")
    },
    onError: () => toast.error("Failed to remove user"),
  })

  return (
    <div className="p-3 bg-muted/20 border-t">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Members</span>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add User
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-8" />
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">No members</p>
      ) : (
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.username} className="flex items-center justify-between bg-background rounded px-2 py-1">
              <span className="text-xs font-mono">{m.username}</span>
              {canMutate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeMutation.mutate(m.username)}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User — {groupName}</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Username</label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => addMutation.mutate()} disabled={!username || addMutation.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IAMPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  // Expand state per tab
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  // Create user dialog
  const [createUserOpen, setCreateUserOpen] = useState(false)
  const [newUsername, setNewUsername] = useState("")

  // Create role dialog
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [trustPolicy, setTrustPolicy] = useState("")
  const [roleDesc, setRoleDesc] = useState("")

  // Create policy dialog
  const [createPolicyOpen, setCreatePolicyOpen] = useState(false)
  const [policyName, setPolicyName] = useState("")
  const [policyDoc, setPolicyDoc] = useState("")
  const [policyDesc, setPolicyDesc] = useState("")

  // Create group dialog
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState("")

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null)

  const { data: users = [], isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["iam-users", instanceId],
    queryFn: () => instancesApi.listIAMUsers(instanceId).then((r) => r.data as IAMUser[]),
  })

  const { data: roles = [], isLoading: rolesLoading, refetch: refetchRoles } = useQuery({
    queryKey: ["iam-roles", instanceId],
    queryFn: () => instancesApi.listIAMRoles(instanceId).then((r) => r.data as IAMRole[]),
  })

  const { data: policies = [], isLoading: policiesLoading, refetch: refetchPolicies } = useQuery({
    queryKey: ["iam-policies", instanceId],
    queryFn: () => instancesApi.listIAMPolicies(instanceId).then((r) => r.data as IAMPolicy[]),
  })

  const { data: groups = [], isLoading: groupsLoading, refetch: refetchGroups } = useQuery({
    queryKey: ["iam-groups", instanceId],
    queryFn: () => instancesApi.listIAMGroups(instanceId).then((r) => r.data as IAMGroup[]),
  })

  const createUserMutation = useMutation({
    mutationFn: () => instancesApi.createIAMUser(instanceId, newUsername),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users", instanceId] })
      setCreateUserOpen(false)
      setNewUsername("")
      toast.success(`User "${newUsername}" created`)
    },
    onError: () => toast.error("Failed to create user"),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (u: string) => instancesApi.deleteIAMUser(instanceId, u),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-users", instanceId] })
      setDeleteConfirm(null)
      toast.success("User deleted")
    },
    onError: () => toast.error("Failed to delete user"),
  })

  const createRoleMutation = useMutation({
    mutationFn: () => instancesApi.createIAMRole(instanceId, { name: roleName, trust_policy: trustPolicy, description: roleDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-roles", instanceId] })
      setCreateRoleOpen(false)
      setRoleName(""); setTrustPolicy(""); setRoleDesc("")
      toast.success(`Role "${roleName}" created`)
    },
    onError: () => toast.error("Failed to create role"),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteIAMRole(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-roles", instanceId] })
      setDeleteConfirm(null)
      toast.success("Role deleted")
    },
    onError: () => toast.error("Failed to delete role"),
  })

  const createPolicyMutation = useMutation({
    mutationFn: () => instancesApi.createIAMPolicy(instanceId, { name: policyName, document: policyDoc, description: policyDesc }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-policies", instanceId] })
      setCreatePolicyOpen(false)
      setPolicyName(""); setPolicyDoc(""); setPolicyDesc("")
      toast.success(`Policy "${policyName}" created`)
    },
    onError: () => toast.error("Failed to create policy"),
  })

  const deletePolicyMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteIAMPolicy(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-policies", instanceId] })
      setDeleteConfirm(null)
      toast.success("Policy deleted")
    },
    onError: () => toast.error("Failed to delete policy"),
  })

  const createGroupMutation = useMutation({
    mutationFn: () => instancesApi.createIAMGroup(instanceId, groupName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-groups", instanceId] })
      setCreateGroupOpen(false)
      setGroupName("")
      toast.success(`Group "${groupName}" created`)
    },
    onError: () => toast.error("Failed to create group"),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteIAMGroup(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["iam-groups", instanceId] })
      setDeleteConfirm(null)
      toast.success("Group deleted")
    },
    onError: () => toast.error("Failed to delete group"),
  })

  function handleDelete() {
    if (!deleteConfirm) return
    if (deleteConfirm.type === "user") deleteUserMutation.mutate(deleteConfirm.id)
    else if (deleteConfirm.type === "role") deleteRoleMutation.mutate(deleteConfirm.id)
    else if (deleteConfirm.type === "policy") deletePolicyMutation.mutate(deleteConfirm.id)
    else if (deleteConfirm.type === "group") deleteGroupMutation.mutate(deleteConfirm.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">IAM</h2>
        <Button variant="ghost" size="sm" onClick={() => { refetchUsers(); refetchRoles(); refetchPolicies(); refetchGroups() }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Users ({users.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => { setNewUsername(""); setCreateUserOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create User
              </Button>
            )}
          </div>
          {usersLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Username</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No users found</TableCell>
                    </TableRow>
                  ) : users.map((u) => (
                    <>
                      <TableRow key={u.username} className="cursor-pointer" onClick={() => setExpandedUser(expandedUser === u.username ? null : u.username)}>
                        <TableCell>
                          {expandedUser === u.username
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-mono text-sm">{u.username}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{truncateArn(u.arn)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.create_date ? new Date(u.create_date).toLocaleDateString() : "—"}</TableCell>
                        {canMutate && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteConfirm({ type: "user", id: u.username })}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {expandedUser === u.username && (
                        <TableRow key={`${u.username}-exp`}>
                          <TableCell colSpan={canMutate ? 5 : 4} className="p-0">
                            <UserExpandedRow instanceId={instanceId} username={u.username} canMutate={!!canMutate} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Roles Tab ── */}
        <TabsContent value="roles" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Roles ({roles.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => { setRoleName(""); setTrustPolicy(""); setRoleDesc(""); setCreateRoleOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Role
              </Button>
            )}
          </div>
          {rolesLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Role Name</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground text-sm h-24">No roles found</TableCell>
                    </TableRow>
                  ) : roles.map((r) => (
                    <>
                      <TableRow key={r.role_name} className="cursor-pointer" onClick={() => setExpandedRole(expandedRole === r.role_name ? null : r.role_name)}>
                        <TableCell>
                          {expandedRole === r.role_name
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-mono text-sm">{r.role_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{truncateArn(r.arn)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.description || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.create_date ? new Date(r.create_date).toLocaleDateString() : "—"}</TableCell>
                        {canMutate && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteConfirm({ type: "role", id: r.role_name })}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {expandedRole === r.role_name && (
                        <TableRow key={`${r.role_name}-exp`}>
                          <TableCell colSpan={canMutate ? 6 : 5} className="p-0">
                            <RoleExpandedRow instanceId={instanceId} roleName={r.role_name} canMutate={!!canMutate} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Policies Tab ── */}
        <TabsContent value="policies" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Policies ({policies.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => { setPolicyName(""); setPolicyDoc(""); setPolicyDesc(""); setCreatePolicyOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Policy
              </Button>
            )}
          </div>
          {policiesLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No policies found</TableCell>
                    </TableRow>
                  ) : policies.map((p) => (
                    <TableRow key={p.policy_id}>
                      <TableCell className="font-mono text-sm">{p.policy_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{truncateArn(p.arn)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.description || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.create_date ? new Date(p.create_date).toLocaleDateString() : "—"}</TableCell>
                      {canMutate && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteConfirm({ type: "policy", id: p.arn })}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Groups Tab ── */}
        <TabsContent value="groups" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Groups ({groups.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => { setGroupName(""); setCreateGroupOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Group
              </Button>
            )}
          </div>
          {groupsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Group Name</TableHead>
                    <TableHead>ARN</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No groups found</TableCell>
                    </TableRow>
                  ) : groups.map((g) => (
                    <>
                      <TableRow key={g.group_name} className="cursor-pointer" onClick={() => setExpandedGroup(expandedGroup === g.group_name ? null : g.group_name)}>
                        <TableCell>
                          {expandedGroup === g.group_name
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-mono text-sm">{g.group_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{truncateArn(g.arn)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{g.create_date ? new Date(g.create_date).toLocaleDateString() : "—"}</TableCell>
                        {canMutate && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteConfirm({ type: "group", id: g.group_name })}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                      {expandedGroup === g.group_name && (
                        <TableRow key={`${g.group_name}-exp`}>
                          <TableCell colSpan={canMutate ? 5 : 4} className="p-0">
                            <GroupExpandedRow instanceId={instanceId} groupName={g.group_name} canMutate={!!canMutate} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create IAM User</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Username</label>
            <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
            <Button onClick={() => createUserMutation.mutate()} disabled={!newUsername || createUserMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Role Dialog */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create IAM Role</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Role Name</label>
              <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Trust Policy (JSON)</label>
              <Textarea value={trustPolicy} onChange={(e) => setTrustPolicy(e.target.value)} className="mt-1 font-mono text-xs" rows={6} placeholder='{"Version":"2012-10-17","Statement":[...]}' />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
            <Button onClick={() => createRoleMutation.mutate()} disabled={!roleName || !trustPolicy || createRoleMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Policy Dialog */}
      <Dialog open={createPolicyOpen} onOpenChange={setCreatePolicyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create IAM Policy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Policy Name</label>
              <Input value={policyName} onChange={(e) => setPolicyName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Policy Document (JSON)</label>
              <Textarea value={policyDoc} onChange={(e) => setPolicyDoc(e.target.value)} className="mt-1 font-mono text-xs" rows={6} placeholder='{"Version":"2012-10-17","Statement":[...]}' />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={policyDesc} onChange={(e) => setPolicyDesc(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatePolicyOpen(false)}>Cancel</Button>
            <Button onClick={() => createPolicyMutation.mutate()} disabled={!policyName || !policyDoc || createPolicyMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Group Dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create IAM Group</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Group Name</label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={() => createGroupMutation.mutate()} disabled={!groupName || createGroupMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-mono font-medium text-foreground">{deleteConfirm?.id}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={
              deleteUserMutation.isPending || deleteRoleMutation.isPending ||
              deletePolicyMutation.isPending || deleteGroupMutation.isPending
            }>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
