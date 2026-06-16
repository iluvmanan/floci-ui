"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EKSCluster {
  name: string
  arn: string
  status: string
  kubernetes_version: string
  endpoint: string
  role_arn: string
  resources_vpc_config: Record<string, unknown>
  created_at: string
  tags: Record<string, string>
}

interface NodeGroup {
  nodegroup_name: string
  status: string
  capacity_type: string
  instance_types: string[]
  scaling_config: { minSize: number; maxSize: number; desiredSize: number }
  ami_type: string
  disk_size: number
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(state: string) {
  const variants: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    CREATING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    UPDATING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    DELETING: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    DEGRADED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        variants[state] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {state || "—"}
    </span>
  )
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function truncateMid(s: string, len = 32) {
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EKSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">EKS</h2>
      {selectedCluster ? (
        <ClusterDetail
          instanceId={instanceId}
          clusterName={selectedCluster}
          canMutate={canMutate}
          onBack={() => setSelectedCluster(null)}
        />
      ) : (
        <ClusterListPanel
          instanceId={instanceId}
          canMutate={canMutate}
          onSelect={(name) => setSelectedCluster(name)}
        />
      )}
    </div>
  )
}

// ─── Cluster List ───────────────────────────────────────────────────────────────

function ClusterListPanel({
  instanceId,
  canMutate,
  onSelect,
}: {
  instanceId: string
  canMutate: boolean
  onSelect: (name: string) => void
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState("")

  const { data: clusters = [], isLoading, refetch } = useQuery({
    queryKey: ["eks-clusters", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listEKSClusters(instanceId)
      return r.data as EKSCluster[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createEKSCluster(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eks-clusters", instanceId] })
      setCreateOpen(false)
      toast.success("Cluster creation started")
    },
    onError: () => toast.error("Failed to create cluster"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteEKSCluster(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eks-clusters", instanceId] })
      setDeleteTarget(null)
      setConfirmName("")
      toast.success("Cluster deletion started")
    },
    onError: () => toast.error("Failed to delete cluster"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Cluster
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>K8s Version</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">
                    No clusters found
                  </TableCell>
                </TableRow>
              ) : (
                clusters.map((c) => (
                  <TableRow key={c.arn} className="cursor-pointer hover:bg-accent/40" onClick={() => onSelect(c.name)}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs">{c.kubernetes_version || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[200px]">{truncateMid(c.endpoint, 36)}</span>
                        {c.endpoint && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation()
                              copyToClipboard(c.endpoint)
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(c.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Cluster Dialog */}
      <CreateClusterDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Delete Confirmation (typed name) */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={() => {
          setDeleteTarget(null)
          setConfirmName("")
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will delete the cluster and is irreversible. Type{" "}
            <span className="font-mono font-medium">{deleteTarget}</span> to confirm.
          </p>
          <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={deleteTarget ?? ""} />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null)
                setConfirmName("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmName !== deleteTarget || deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateClusterDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [version, setVersion] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [subnetIds, setSubnetIds] = useState("")
  const [securityGroupIds, setSecurityGroupIds] = useState("")
  const [endpointPublic, setEndpointPublic] = useState(true)
  const [endpointPrivate, setEndpointPrivate] = useState(false)

  function reset() {
    setName("")
    setVersion("")
    setRoleArn("")
    setSubnetIds("")
    setSecurityGroupIds("")
    setEndpointPublic(true)
    setEndpointPrivate(false)
  }

  function handleSubmit() {
    const body: Record<string, unknown> = {
      name,
      role_arn: roleArn,
      resources_vpc_config: {
        subnet_ids: subnetIds.split(",").map((s) => s.trim()).filter(Boolean),
        security_group_ids: securityGroupIds
          ? securityGroupIds.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
        endpoint_public_access: endpointPublic,
        endpoint_private_access: endpointPrivate,
      },
    }
    if (version) body.version = version
    onSubmit(body)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create EKS Cluster</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cluster Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Kubernetes Version (optional)</Label>
            <Input placeholder="1.29" value={version} onChange={(e) => setVersion(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>IAM Role ARN</Label>
            <Input
              placeholder="arn:aws:iam::123456789012:role/eks-cluster-role"
              value={roleArn}
              onChange={(e) => setRoleArn(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Subnet IDs (comma-separated)</Label>
            <Input
              placeholder="subnet-aaa,subnet-bbb"
              value={subnetIds}
              onChange={(e) => setSubnetIds(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Security Group IDs (optional, comma-separated)</Label>
            <Input
              placeholder="sg-aaa,sg-bbb"
              value={securityGroupIds}
              onChange={(e) => setSecurityGroupIds(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Endpoint Public Access</Label>
            <Switch checked={endpointPublic} onCheckedChange={setEndpointPublic} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Endpoint Private Access</Label>
            <Switch checked={endpointPrivate} onCheckedChange={setEndpointPrivate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name || !roleArn || !subnetIds || isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cluster Detail ─────────────────────────────────────────────────────────────

function ClusterDetail({
  instanceId,
  clusterName,
  canMutate,
  onBack,
}: {
  instanceId: string
  clusterName: string
  canMutate: boolean
  onBack: () => void
}) {
  const { data: cluster, isLoading } = useQuery({
    queryKey: ["eks-cluster-detail", instanceId, clusterName],
    queryFn: async () => {
      const r = await instancesApi.getEKSCluster(instanceId, clusterName)
      return r.data as Record<string, unknown>
    },
  })

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to clusters
      </Button>
      <h3 className="text-sm font-medium font-mono">{clusterName}</h3>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="nodegroups">Node Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          {isLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <Label>Endpoint</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted rounded px-2 py-1 font-mono break-all flex-1">
                      {String(cluster?.endpoint ?? "—")}
                    </code>
                    {cluster?.endpoint ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(String(cluster.endpoint))}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Kubernetes Version</Label>
                  <p className="text-sm">{String(cluster?.version ?? "—")}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label>IAM Role</Label>
                  <p className="text-xs font-mono break-all">{String(cluster?.roleArn ?? "—")}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>VPC Config</Label>
                <pre className="text-xs bg-muted rounded-md p-3 max-h-64 overflow-auto font-mono">
                  {JSON.stringify(cluster?.resourcesVpcConfig ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="nodegroups" className="mt-4">
          <NodeGroupsTab instanceId={instanceId} clusterName={clusterName} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Node Groups Tab ──────────────────────────────────────────────────────────

function NodeGroupsTab({
  instanceId,
  clusterName,
  canMutate,
}: {
  instanceId: string
  clusterName: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [scaleTarget, setScaleTarget] = useState<NodeGroup | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: nodegroups = [], isLoading, refetch } = useQuery({
    queryKey: ["eks-nodegroups", instanceId, clusterName],
    queryFn: async () => {
      const r = await instancesApi.listNodeGroups(instanceId, clusterName)
      return r.data as NodeGroup[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createNodeGroup(instanceId, clusterName, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eks-nodegroups", instanceId, clusterName] })
      setCreateOpen(false)
      toast.success("Node group creation started")
    },
    onError: () => toast.error("Failed to create node group"),
  })

  const scaleMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      instancesApi.updateNodeGroupScaling(instanceId, clusterName, scaleTarget!.nodegroup_name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eks-nodegroups", instanceId, clusterName] })
      setScaleTarget(null)
      toast.success("Node group scaling updated")
    },
    onError: () => toast.error("Failed to update scaling"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteNodeGroup(instanceId, clusterName, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eks-nodegroups", instanceId, clusterName] })
      setDeleteTarget(null)
      toast.success("Node group deletion started")
    },
    onError: () => toast.error("Failed to delete node group"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {nodegroups.length} node group{nodegroups.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Node Group
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Instance Types</TableHead>
                <TableHead>Desired/Min/Max</TableHead>
                <TableHead>Capacity Type</TableHead>
                {canMutate && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodegroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">
                    No node groups found
                  </TableCell>
                </TableRow>
              ) : (
                nodegroups.map((ng) => (
                  <TableRow key={ng.nodegroup_name}>
                    <TableCell className="font-medium text-sm">{ng.nodegroup_name}</TableCell>
                    <TableCell>{statusBadge(ng.status)}</TableCell>
                    <TableCell className="text-xs">{(ng.instance_types ?? []).join(", ") || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {ng.scaling_config?.desiredSize}/{ng.scaling_config?.minSize}/{ng.scaling_config?.maxSize}
                    </TableCell>
                    <TableCell className="text-xs">{ng.capacity_type}</TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setScaleTarget(ng)}
                          >
                            Scale
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setDeleteTarget(ng.nodegroup_name)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Node Group Dialog */}
      <CreateNodeGroupDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Scale Dialog */}
      <Dialog open={!!scaleTarget} onOpenChange={() => setScaleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scale Node Group — {scaleTarget?.nodegroup_name}</DialogTitle>
          </DialogHeader>
          {scaleTarget && (
            <ScaleNodeGroupForm
              nodegroup={scaleTarget}
              onSubmit={(body) => scaleMutation.mutate(body)}
              isPending={scaleMutation.isPending}
              onCancel={() => setScaleTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Node Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete node group <span className="font-mono font-medium">{deleteTarget}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateNodeGroupDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [nodeRole, setNodeRole] = useState("")
  const [subnets, setSubnets] = useState("")
  const [instanceTypes, setInstanceTypes] = useState("t3.medium")
  const [minSize, setMinSize] = useState("1")
  const [maxSize, setMaxSize] = useState("3")
  const [desiredSize, setDesiredSize] = useState("2")

  function reset() {
    setName("")
    setNodeRole("")
    setSubnets("")
    setInstanceTypes("t3.medium")
    setMinSize("1")
    setMaxSize("3")
    setDesiredSize("2")
  }

  function handleSubmit() {
    onSubmit({
      nodegroup_name: name,
      node_role: nodeRole,
      subnets: subnets.split(",").map((s) => s.trim()).filter(Boolean),
      instance_types: instanceTypes.split(",").map((s) => s.trim()).filter(Boolean),
      scaling_config: {
        min_size: parseInt(minSize) || 0,
        max_size: parseInt(maxSize) || 0,
        desired_size: parseInt(desiredSize) || 0,
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Node Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Node Group Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Node IAM Role ARN</Label>
            <Input
              placeholder="arn:aws:iam::123456789012:role/eks-node-role"
              value={nodeRole}
              onChange={(e) => setNodeRole(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Subnets (comma-separated)</Label>
            <Input placeholder="subnet-aaa,subnet-bbb" value={subnets} onChange={(e) => setSubnets(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Instance Types (comma-separated)</Label>
            <Input value={instanceTypes} onChange={(e) => setInstanceTypes(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Min Size</Label>
              <Input type="number" min={0} value={minSize} onChange={(e) => setMinSize(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Desired Size</Label>
              <Input type="number" min={0} value={desiredSize} onChange={(e) => setDesiredSize(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Size</Label>
              <Input type="number" min={0} value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!name || !nodeRole || !subnets || isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScaleNodeGroupForm({
  nodegroup,
  onSubmit,
  isPending,
  onCancel,
}: {
  nodegroup: NodeGroup
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
  onCancel: () => void
}) {
  const [minSize, setMinSize] = useState(String(nodegroup.scaling_config?.minSize ?? 0))
  const [maxSize, setMaxSize] = useState(String(nodegroup.scaling_config?.maxSize ?? 0))
  const [desiredSize, setDesiredSize] = useState(String(nodegroup.scaling_config?.desiredSize ?? 0))

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label>Min Size</Label>
          <Input type="number" min={0} value={minSize} onChange={(e) => setMinSize(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Desired Size</Label>
          <Input type="number" min={0} value={desiredSize} onChange={(e) => setDesiredSize(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Max Size</Label>
          <Input type="number" min={0} value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() =>
            onSubmit({
              scaling_config: {
                min_size: parseInt(minSize) || 0,
                max_size: parseInt(maxSize) || 0,
                desired_size: parseInt(desiredSize) || 0,
              },
            })
          }
          disabled={isPending}
        >
          Update
        </Button>
      </DialogFooter>
    </>
  )
}
