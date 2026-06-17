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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CDApplication {
  application_name: string
  application_id: string
  compute_platform: string
  create_time: string
}

interface DeploymentGroup {
  deployment_group_name: string
  deployment_group_id: string
  deployment_config_name: string
  service_role_arn: string
}

interface CDDeployment {
  deployment_id: string
  deployment_group_name: string
  status: string
  create_time: string
  complete_time: string
}

interface TagFilterRow {
  key: string
  value: string
  type: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied")
}

function truncateMid(s: string, len = 24) {
  if (!s) return "—"
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    Succeeded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    InProgress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    Created: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    Queued: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    Stopped: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status || "—"}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CodeDeployPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedApp, setSelectedApp] = useState<CDApplication | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CDApplication | null>(null)

  const { data: apps = [], isLoading, refetch } = useQuery({
    queryKey: ["codedeploy-apps", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listCodeDeployApps(instanceId)
      return r.data as CDApplication[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteCodeDeployApp(instanceId, name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["codedeploy-apps", instanceId] })
      setDeleteTarget(null)
      if (selectedApp?.application_name === name) setSelectedApp(null)
      toast.success("Application deleted")
    },
    onError: () => toast.error("Failed to delete application"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CodeDeploy</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Application
            </Button>
          )}
        </div>
      </div>

      {selectedApp ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedApp(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Applications
          </Button>
          <ApplicationDetail instanceId={instanceId} app={selectedApp} canMutate={canMutate} />
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {apps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No applications found</TableCell>
                </TableRow>
              ) : apps.map((a) => (
                <TableRow key={a.application_name} className="cursor-pointer" onClick={() => setSelectedApp(a)}>
                  <TableCell className="font-medium text-sm">{a.application_name}</TableCell>
                  <TableCell><Badge variant="secondary">{a.compute_platform}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{a.create_time || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canMutate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApplicationDialog open={createOpen} onClose={() => setCreateOpen(false)} instanceId={instanceId} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Application</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete application <span className="font-mono font-medium text-foreground">{deleteTarget?.application_name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.application_name)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Application Dialog ─────────────────────────────────────────────────

function CreateApplicationDialog({
  open,
  onClose,
  instanceId,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
}) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [platform, setPlatform] = useState("Server")

  function reset() {
    setName("")
    setPlatform("Server")
  }

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createCodeDeployApp(instanceId, { application_name: name, compute_platform: platform }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["codedeploy-apps", instanceId] })
      onClose()
      reset()
      toast.success("Application created")
    },
    onError: () => toast.error("Failed to create application"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create CodeDeploy Application</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Compute Platform</Label>
            <div className="flex gap-4">
              {["Server", "Lambda", "ECS"].map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="compute-platform"
                    value={p}
                    checked={platform === p}
                    onChange={() => setPlatform(p)}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Application Detail ─────────────────────────────────────────────────────────

function ApplicationDetail({
  instanceId,
  app,
  canMutate,
}: {
  instanceId: string
  app: CDApplication
  canMutate: boolean
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium font-mono">{app.application_name}</h3>
      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">Deployment Groups</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>
        <TabsContent value="groups">
          <DeploymentGroupsTab instanceId={instanceId} app={app} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="deployments">
          <DeploymentsTab instanceId={instanceId} app={app} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Deployment Groups Tab ───────────────────────────────────────────────────────

function DeploymentGroupsTab({
  instanceId,
  app,
  canMutate,
}: {
  instanceId: string
  app: CDApplication
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ["codedeploy-groups", instanceId, app.application_name],
    queryFn: async () => {
      const r = await instancesApi.listDeploymentGroups(instanceId, app.application_name)
      return r.data as DeploymentGroup[]
    },
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {canMutate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Deployment Group
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Deployment Config</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground h-24">No deployment groups found</TableCell>
                </TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.deployment_group_name}>
                  <TableCell className="font-medium text-sm">{g.deployment_group_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.deployment_config_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateDeploymentGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        instanceId={instanceId}
        app={app}
      />
    </div>
  )
}

function CreateDeploymentGroupDialog({
  open,
  onClose,
  instanceId,
  app,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  app: CDApplication
}) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [serviceRoleArn, setServiceRoleArn] = useState("")
  const [deploymentConfigName, setDeploymentConfigName] = useState("CodeDeployDefault.OneAtATime")
  const [tagFilters, setTagFilters] = useState<TagFilterRow[]>([])

  function reset() {
    setName("")
    setServiceRoleArn("")
    setDeploymentConfigName("CodeDeployDefault.OneAtATime")
    setTagFilters([])
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        deployment_group_name: name,
        service_role_arn: serviceRoleArn,
        deployment_config_name: deploymentConfigName,
      }
      const filtered = tagFilters.filter((t) => t.key)
      if (filtered.length > 0) {
        body.ec2_tag_filters = filtered.map((t) => ({ Key: t.key, Value: t.value, Type: t.type }))
      }
      return instancesApi.createDeploymentGroup(instanceId, app.application_name, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["codedeploy-groups", instanceId, app.application_name] })
      onClose()
      reset()
      toast.success("Deployment group created")
    },
    onError: () => toast.error("Failed to create deployment group"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Deployment Group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Service Role ARN</Label>
            <Input value={serviceRoleArn} onChange={(e) => setServiceRoleArn(e.target.value)} placeholder="arn:aws:iam::..." />
          </div>
          <div className="space-y-1">
            <Label>Deployment Config Name</Label>
            <Input value={deploymentConfigName} onChange={(e) => setDeploymentConfigName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>EC2 Tag Filters (optional)</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setTagFilters([...tagFilters, { key: "", value: "", type: "KEY_AND_VALUE" }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            {tagFilters.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="Key"
                  value={t.key}
                  onChange={(e) => setTagFilters(tagFilters.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                />
                <Input
                  className="flex-1"
                  placeholder="Value"
                  value={t.value}
                  onChange={(e) => setTagFilters(tagFilters.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Select value={t.type} onValueChange={(val) => val && setTagFilters(tagFilters.map((x, j) => (j === i ? { ...x, type: val } : x)))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KEY_AND_VALUE">KEY_AND_VALUE</SelectItem>
                    <SelectItem value="KEY_ONLY">KEY_ONLY</SelectItem>
                    <SelectItem value="VALUE_ONLY">VALUE_ONLY</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTagFilters(tagFilters.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || !serviceRoleArn || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Deployments Tab ──────────────────────────────────────────────────────────

function DeploymentsTab({
  instanceId,
  app,
  canMutate,
}: {
  instanceId: string
  app: CDApplication
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { data: deployments = [], isLoading, refetch } = useQuery({
    queryKey: ["codedeploy-deployments", instanceId, app.application_name],
    queryFn: async () => {
      const r = await instancesApi.listCodeDeployDeployments(instanceId, app.application_name)
      return r.data as CDDeployment[]
    },
  })

  const { data: groups = [] } = useQuery({
    queryKey: ["codedeploy-groups", instanceId, app.application_name],
    queryFn: async () => {
      const r = await instancesApi.listDeploymentGroups(instanceId, app.application_name)
      return r.data as DeploymentGroup[]
    },
  })

  const { data: detail } = useQuery({
    queryKey: ["codedeploy-deployment-detail", instanceId, detailId],
    queryFn: async () => {
      const r = await instancesApi.getDeployment(instanceId, detailId!)
      return r.data
    },
    enabled: !!detailId,
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {canMutate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Create Deployment
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment ID</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No deployments found</TableCell>
                </TableRow>
              ) : deployments.map((d) => (
                <TableRow key={d.deployment_id} className="cursor-pointer" onClick={() => setDetailId(d.deployment_id)}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{truncateMid(d.deployment_id, 24)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(d.deployment_id) }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.deployment_group_name}</TableCell>
                  <TableCell>{statusBadge(d.status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.create_time || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.complete_time || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateDeploymentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        instanceId={instanceId}
        app={app}
        groups={groups}
      />

      <Dialog open={!!detailId} onOpenChange={() => setDetailId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Deployment Detail</DialogTitle></DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">{detail ? JSON.stringify(detail, null, 2) : "Loading..."}</pre>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateDeploymentDialog({
  open,
  onClose,
  instanceId,
  app,
  groups,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  app: CDApplication
  groups: DeploymentGroup[]
}) {
  const qc = useQueryClient()
  const [groupName, setGroupName] = useState("")
  const [bucket, setBucket] = useState("")
  const [key, setKey] = useState("")
  const [bundleType, setBundleType] = useState("zip")
  const [description, setDescription] = useState("")

  function reset() {
    setGroupName("")
    setBucket("")
    setKey("")
    setBundleType("zip")
    setDescription("")
  }

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createDeployment(instanceId, {
        application_name: app.application_name,
        deployment_group_name: groupName,
        s3_location: { bucket, key, bundle_type: bundleType },
        description,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["codedeploy-deployments", instanceId, app.application_name] })
      onClose()
      reset()
      toast.success("Deployment created")
    },
    onError: () => toast.error("Failed to create deployment"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Deployment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Deployment Group</Label>
            <Select value={groupName} onValueChange={(v) => v && setGroupName(v)}>
              <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.deployment_group_name} value={g.deployment_group_name}>{g.deployment_group_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>S3 Bucket</Label>
              <Input value={bucket} onChange={(e) => setBucket(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>S3 Key</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Bundle Type</Label>
            <Select value={bundleType} onValueChange={(v) => v && setBundleType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zip">zip</SelectItem>
                <SelectItem value="tar">tar</SelectItem>
                <SelectItem value="tgz">tgz</SelectItem>
                <SelectItem value="YAML">YAML</SelectItem>
                <SelectItem value="JSON">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!groupName || !bucket || !key || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
