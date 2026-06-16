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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NeptuneCluster {
  cluster_identifier: string
  status: string
  engine: string
  engine_version: string
  endpoint: string
  reader_endpoint: string
  port: number | null
  create_time: string
}

interface NeptuneInstance {
  db_instance_identifier: string
  db_instance_class: string
  status: string
  cluster_identifier: string
  endpoint_address: string
  endpoint_port: number | null
  create_time: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const s = status.toLowerCase()
  const variant = s === "available"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : s.includes("fail") || s.includes("delet")
    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variant}`}>
      {status}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NeptunePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  // Create cluster dialog
  const [createClusterOpen, setCreateClusterOpen] = useState(false)
  const [clusterId, setClusterId] = useState("")
  const [engineVersion, setEngineVersion] = useState("")
  const [azs, setAzs] = useState("")

  // Create instance dialog
  const [createInstanceOpen, setCreateInstanceOpen] = useState(false)
  const [dbInstanceId, setDbInstanceId] = useState("")
  const [dbInstanceClass, setDbInstanceClass] = useState("db.r5.large")
  const [selectedClusterForInstance, setSelectedClusterForInstance] = useState("")

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "cluster" | "instance"; id: string } | null>(null)

  const { data: clusters = [], isLoading: clustersLoading, refetch: refetchClusters } = useQuery({
    queryKey: ["neptune-clusters", instanceId],
    queryFn: () => instancesApi.listNeptuneClusters(instanceId).then((r) => r.data as NeptuneCluster[]),
  })

  const { data: instances = [], isLoading: instancesLoading, refetch: refetchInstances } = useQuery({
    queryKey: ["neptune-instances", instanceId],
    queryFn: () => instancesApi.listNeptuneInstances(instanceId).then((r) => r.data as NeptuneInstance[]),
  })

  const createClusterMutation = useMutation({
    mutationFn: () =>
      instancesApi.createNeptuneCluster(instanceId, {
        cluster_identifier: clusterId,
        engine_version: engineVersion || undefined,
        availability_zones: azs ? azs.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neptune-clusters", instanceId] })
      setCreateClusterOpen(false)
      setClusterId(""); setEngineVersion(""); setAzs("")
      toast.success(`Cluster "${clusterId}" creation started`)
    },
    onError: () => toast.error("Failed to create cluster"),
  })

  const deleteClusterMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteNeptuneCluster(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neptune-clusters", instanceId] })
      setDeleteConfirm(null)
      toast.success("Cluster deletion started")
    },
    onError: () => toast.error("Failed to delete cluster"),
  })

  const createInstanceMutation = useMutation({
    mutationFn: () =>
      instancesApi.createNeptuneInstance(instanceId, {
        db_instance_identifier: dbInstanceId,
        db_instance_class: dbInstanceClass,
        cluster_identifier: selectedClusterForInstance,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neptune-instances", instanceId] })
      setCreateInstanceOpen(false)
      setDbInstanceId(""); setDbInstanceClass("db.r5.large"); setSelectedClusterForInstance("")
      toast.success(`Instance "${dbInstanceId}" creation started`)
    },
    onError: () => toast.error("Failed to create instance"),
  })

  const deleteInstanceMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteNeptuneInstance(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["neptune-instances", instanceId] })
      setDeleteConfirm(null)
      toast.success("Instance deletion started")
    },
    onError: () => toast.error("Failed to delete instance"),
  })

  function handleDelete() {
    if (!deleteConfirm) return
    if (deleteConfirm.type === "cluster") deleteClusterMutation.mutate(deleteConfirm.id)
    else deleteInstanceMutation.mutate(deleteConfirm.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Neptune</h2>
        <Button variant="ghost" size="sm" onClick={() => { refetchClusters(); refetchInstances() }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="clusters">
        <TabsList>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
          <TabsTrigger value="instances">Instances</TabsTrigger>
        </TabsList>

        {/* ── Clusters Tab ── */}
        <TabsContent value="clusters" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Clusters ({clusters.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => { setClusterId(""); setEngineVersion(""); setAzs(""); setCreateClusterOpen(true) }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Cluster
              </Button>
            )}
          </div>
          {clustersLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cluster ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engine Version</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Reader Endpoint</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 8 : 7} className="text-center text-muted-foreground text-sm h-24">No clusters found</TableCell>
                    </TableRow>
                  ) : clusters.map((c) => (
                    <TableRow key={c.cluster_identifier}>
                      <TableCell className="font-mono text-sm">{c.cluster_identifier}</TableCell>
                      <TableCell>{statusBadge(c.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.engine_version || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{c.endpoint || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{c.reader_endpoint || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.port ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.create_time && c.create_time !== "None" ? new Date(c.create_time).toLocaleString() : "—"}</TableCell>
                      {canMutate && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteConfirm({ type: "cluster", id: c.cluster_identifier })}
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

        {/* ── Instances Tab ── */}
        <TabsContent value="instances" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Instances ({instances.length})</span>
            {canMutate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDbInstanceId(""); setDbInstanceClass("db.r5.large")
                  setSelectedClusterForInstance(clusters[0]?.cluster_identifier ?? "")
                  setCreateInstanceOpen(true)
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Instance
              </Button>
            )}
          </div>
          {instancesLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instance ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cluster ID</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Created</TableHead>
                    {canMutate && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 7 : 6} className="text-center text-muted-foreground text-sm h-24">No instances found</TableCell>
                    </TableRow>
                  ) : instances.map((i) => (
                    <TableRow key={i.db_instance_identifier}>
                      <TableCell className="font-mono text-sm">{i.db_instance_identifier}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.db_instance_class}</TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{i.cluster_identifier || "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {i.endpoint_address ? `${i.endpoint_address}:${i.endpoint_port ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{i.create_time && i.create_time !== "None" ? new Date(i.create_time).toLocaleString() : "—"}</TableCell>
                      {canMutate && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteConfirm({ type: "instance", id: i.db_instance_identifier })}
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
      </Tabs>

      {/* Create Cluster Dialog */}
      <Dialog open={createClusterOpen} onOpenChange={setCreateClusterOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Neptune Cluster</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Cluster Identifier</label>
              <Input value={clusterId} onChange={(e) => setClusterId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Engine Version (optional)</label>
              <Input value={engineVersion} onChange={(e) => setEngineVersion(e.target.value)} className="mt-1" placeholder="1.2.1.0" />
            </div>
            <div>
              <label className="text-sm font-medium">Availability Zones (optional, comma-separated)</label>
              <Input value={azs} onChange={(e) => setAzs(e.target.value)} className="mt-1" placeholder="us-east-1a, us-east-1b" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateClusterOpen(false)}>Cancel</Button>
            <Button onClick={() => createClusterMutation.mutate()} disabled={!clusterId || createClusterMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Instance Dialog */}
      <Dialog open={createInstanceOpen} onOpenChange={setCreateInstanceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Neptune Instance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Instance Identifier</label>
              <Input value={dbInstanceId} onChange={(e) => setDbInstanceId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Instance Class</label>
              <Select value={dbInstanceClass} onValueChange={(v) => v && setDbInstanceClass(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="db.r5.large">db.r5.large</SelectItem>
                  <SelectItem value="db.r5.xlarge">db.r5.xlarge</SelectItem>
                  <SelectItem value="db.t3.medium">db.t3.medium</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cluster</label>
              <Select value={selectedClusterForInstance} onValueChange={(v) => v && setSelectedClusterForInstance(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select a cluster" />
                </SelectTrigger>
                <SelectContent>
                  {clusters.map((c) => (
                    <SelectItem key={c.cluster_identifier} value={c.cluster_identifier}>{c.cluster_identifier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateInstanceOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createInstanceMutation.mutate()}
              disabled={!dbInstanceId || !selectedClusterForInstance || createInstanceMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete {deleteConfirm?.type} <span className="font-mono font-medium text-foreground">{deleteConfirm?.id}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteClusterMutation.isPending || deleteInstanceMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
