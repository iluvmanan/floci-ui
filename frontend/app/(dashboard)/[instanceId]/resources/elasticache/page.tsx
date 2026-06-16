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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface CacheCluster {
  cache_cluster_id: string
  engine: string
  cache_node_type: string
  cache_cluster_status: string
  num_cache_nodes: number
  engine_version: string
  cache_cluster_create_time: string
  configuration_endpoint: string
  replication_group_id: string
}

interface ReplicationGroup {
  replication_group_id: string
  description: string
  status: string
  member_clusters: string[]
  node_groups: string
  automatic_failover: string
}

const STATUS_VARIANTS: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  creating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  deleting: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  modifying: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANTS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

function EngineBadge({ engine }: { engine: string }) {
  const cls = engine === "redis"
    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {engine}
    </span>
  )
}

// ─── Clusters Tab ─────────────────────────────────────────────────────────────

function ClustersTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [clusterId, setClusterId] = useState("")
  const [engine, setEngine] = useState<"redis" | "memcached">("redis")
  const [nodeType, setNodeType] = useState("cache.t3.micro")
  const [numNodes, setNumNodes] = useState("1")
  const [engineVersion, setEngineVersion] = useState("")

  const [rebootDialog, setRebootDialog] = useState<string | null>(null)
  const [nodeIdsInput, setNodeIdsInput] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: clusters = [], isLoading, refetch } = useQuery({
    queryKey: ["elasticache-clusters", instanceId],
    queryFn: () => instancesApi.listCacheClusters(instanceId).then((r) => r.data as CacheCluster[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createCacheCluster(instanceId, {
      cache_cluster_id: clusterId,
      engine,
      cache_node_type: nodeType,
      num_cache_nodes: parseInt(numNodes, 10),
      engine_version: engineVersion || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elasticache-clusters", instanceId] })
      setCreateOpen(false)
      setClusterId(""); setEngineVersion(""); setNumNodes("1"); setNodeType("cache.t3.micro"); setEngine("redis")
      toast.success(`Cluster "${clusterId}" creating`)
    },
    onError: () => toast.error("Failed to create cache cluster"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteCacheCluster(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elasticache-clusters", instanceId] })
      setDeleteConfirm(null)
      toast.success("Cluster deleted")
    },
    onError: () => toast.error("Failed to delete cluster"),
  })

  const rebootMutation = useMutation({
    mutationFn: () => instancesApi.rebootCacheCluster(instanceId, rebootDialog!, nodeIdsInput.split(",").map((s) => s.trim()).filter(Boolean)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elasticache-clusters", instanceId] })
      setRebootDialog(null)
      setNodeIdsInput("")
      toast.success("Reboot initiated")
    },
    onError: () => toast.error("Failed to reboot cluster"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Cache Clusters ({clusters.length})</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => {
              setClusterId(""); setEngine("redis"); setNodeType("cache.t3.micro"); setNumNodes("1"); setEngineVersion("")
              setCreateOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Create Cluster
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cluster ID</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Node Type</TableHead>
                <TableHead>Nodes</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 9 : 8} className="text-center text-muted-foreground text-sm h-24">No cache clusters found</TableCell>
                </TableRow>
              ) : clusters.map((c) => (
                <TableRow key={c.cache_cluster_id}>
                  <TableCell className="font-mono text-sm">{c.cache_cluster_id}</TableCell>
                  <TableCell><EngineBadge engine={c.engine} /></TableCell>
                  <TableCell><StatusBadge status={c.cache_cluster_status} /></TableCell>
                  <TableCell className="text-sm">{c.cache_node_type}</TableCell>
                  <TableCell className="text-sm">{c.num_cache_nodes}</TableCell>
                  <TableCell className="text-sm">{c.engine_version}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{c.configuration_endpoint || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.cache_cluster_create_time ? new Date(c.cache_cluster_create_time).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Reboot"
                          onClick={() => { setRebootDialog(c.cache_cluster_id); setNodeIdsInput("") }}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Delete"
                          onClick={() => setDeleteConfirm(c.cache_cluster_id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Cluster Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Cache Cluster</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Cluster ID</label>
              <Input value={clusterId} onChange={(e) => setClusterId(e.target.value)} className="mt-1" placeholder="my-cache-cluster" />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Engine</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="engine" value="redis" checked={engine === "redis"} onChange={() => setEngine("redis")} />
                  redis
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="engine" value="memcached" checked={engine === "memcached"} onChange={() => setEngine("memcached")} />
                  memcached
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Node Type</label>
                <Select value={nodeType} onValueChange={(v) => v && setNodeType(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cache.t3.micro">cache.t3.micro</SelectItem>
                    <SelectItem value="cache.t3.small">cache.t3.small</SelectItem>
                    <SelectItem value="cache.m5.large">cache.m5.large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Num Nodes</label>
                <Input type="number" min={1} value={numNodes} onChange={(e) => setNumNodes(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Engine Version (optional)</label>
              <Input value={engineVersion} onChange={(e) => setEngineVersion(e.target.value)} className="mt-1" placeholder="7.0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!clusterId || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reboot Dialog */}
      <Dialog open={!!rebootDialog} onOpenChange={() => setRebootDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reboot Cluster — {rebootDialog}</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Node IDs (comma-separated)</label>
            <Input value={nodeIdsInput} onChange={(e) => setNodeIdsInput(e.target.value)} className="mt-1" placeholder="0001,0002" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRebootDialog(null)}>Cancel</Button>
            <Button onClick={() => rebootMutation.mutate()} disabled={!nodeIdsInput || rebootMutation.isPending}>Reboot</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-mono font-medium text-foreground">{deleteConfirm}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Replication Groups Tab ───────────────────────────────────────────────────

function ReplicationGroupsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [groupId, setGroupId] = useState("")
  const [description, setDescription] = useState("")
  const [nodeType, setNodeType] = useState("cache.t3.micro")
  const [numNodeGroups, setNumNodeGroups] = useState("1")
  const [replicasPerNodeGroup, setReplicasPerNodeGroup] = useState("1")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ["elasticache-replication-groups", instanceId],
    queryFn: () => instancesApi.listReplicationGroups(instanceId).then((r) => r.data as ReplicationGroup[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createReplicationGroup(instanceId, {
      replication_group_id: groupId,
      description,
      cache_node_type: nodeType,
      num_node_groups: parseInt(numNodeGroups, 10),
      replicas_per_node_group: parseInt(replicasPerNodeGroup, 10),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elasticache-replication-groups", instanceId] })
      setCreateOpen(false)
      setGroupId(""); setDescription(""); setNodeType("cache.t3.micro"); setNumNodeGroups("1"); setReplicasPerNodeGroup("1")
      toast.success(`Replication group "${groupId}" creating`)
    },
    onError: () => toast.error("Failed to create replication group"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteReplicationGroup(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elasticache-replication-groups", instanceId] })
      setDeleteConfirm(null)
      toast.success("Replication group deleted")
    },
    onError: () => toast.error("Failed to delete replication group"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Replication Groups ({groups.length})</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => {
              setGroupId(""); setDescription(""); setNodeType("cache.t3.micro"); setNumNodeGroups("1"); setReplicasPerNodeGroup("1")
              setCreateOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Create Replication Group
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group ID</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Member Clusters</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Automatic Failover</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 7 : 6} className="text-center text-muted-foreground text-sm h-24">No replication groups found</TableCell>
                </TableRow>
              ) : groups.map((g) => (
                <TableRow key={g.replication_group_id}>
                  <TableCell className="font-mono text-sm">{g.replication_group_id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{g.description || "—"}</TableCell>
                  <TableCell><StatusBadge status={g.status} /></TableCell>
                  <TableCell className="text-sm">{g.member_clusters.length}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{g.node_groups || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={g.automatic_failover === "enabled" ? "default" : "secondary"} className="text-xs">{g.automatic_failover || "—"}</Badge>
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(g.replication_group_id)}>
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

      {/* Create Replication Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Replication Group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Group ID</label>
              <Input value={groupId} onChange={(e) => setGroupId(e.target.value)} className="mt-1" placeholder="my-replication-group" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Node Type</label>
              <Select value={nodeType} onValueChange={(v) => v && setNodeType(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cache.t3.micro">cache.t3.micro</SelectItem>
                  <SelectItem value="cache.t3.small">cache.t3.small</SelectItem>
                  <SelectItem value="cache.m5.large">cache.m5.large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Num Node Groups</label>
                <Input type="number" min={1} value={numNodeGroups} onChange={(e) => setNumNodeGroups(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Replicas Per Node Group</label>
                <Input type="number" min={0} value={replicasPerNodeGroup} onChange={(e) => setReplicasPerNodeGroup(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!groupId || !description || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-mono font-medium text-foreground">{deleteConfirm}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ElastiCachePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">ElastiCache</h2>
      </div>

      <Tabs defaultValue="clusters">
        <TabsList>
          <TabsTrigger value="clusters">Cache Clusters</TabsTrigger>
          <TabsTrigger value="replication-groups">Replication Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="clusters">
          <ClustersTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="replication-groups">
          <ReplicationGroupsTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
