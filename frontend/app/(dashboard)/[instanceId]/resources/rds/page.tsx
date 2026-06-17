"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
import { Camera, Play, Plus, RefreshCw, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface RDSInstance {
  db_instance_identifier: string
  db_instance_class: string
  engine: string
  engine_version: string
  db_instance_status: string
  endpoint_address: string
  endpoint_port: number | null
  allocated_storage: number
  multi_az: boolean
  publicly_accessible: boolean
  instance_create_time: string
  master_username: string
}

interface RDSSnapshot {
  db_snapshot_identifier: string
  db_instance_identifier: string
  status: string
  engine: string
  allocated_storage: number
  snapshot_create_time: string
  percent_progress: number
}

interface RDSCluster {
  db_cluster_identifier: string
  engine: string
  status: string
  endpoint: string
  reader_endpoint: string
  allocated_storage: number
  db_cluster_members: string[]
}

const STATUS_VARIANTS: Record<string, string> = {
  available: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  creating: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  stopped: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  deleting: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANTS[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

// ─── Instances Tab ────────────────────────────────────────────────────────────

function InstancesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const [engine, setEngine] = useState("postgres")
  const [engineVersion, setEngineVersion] = useState("")
  const [dbClass, setDbClass] = useState("db.t3.micro")
  const [storage, setStorage] = useState("20")
  const [masterUsername, setMasterUsername] = useState("")
  const [masterPassword, setMasterPassword] = useState("")
  const [dbName, setDbName] = useState("")
  const [multiAz, setMultiAz] = useState(false)
  const [publiclyAccessible, setPubliclyAccessible] = useState(false)

  const [snapshotDialog, setSnapshotDialog] = useState<string | null>(null)
  const [snapshotId, setSnapshotId] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: instances = [], isLoading, refetch } = useQuery({
    queryKey: ["rds-instances", instanceId],
    queryFn: () => instancesApi.listRDSInstances(instanceId).then((r) => r.data as RDSInstance[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createRDSInstance(instanceId, {
      db_instance_identifier: identifier,
      db_instance_class: dbClass,
      engine,
      engine_version: engineVersion || undefined,
      allocated_storage: parseInt(storage, 10),
      master_username: masterUsername,
      master_password: masterPassword,
      db_name: dbName || undefined,
      multi_az: multiAz,
      publicly_accessible: publiclyAccessible,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rds-instances", instanceId] })
      setCreateOpen(false)
      setIdentifier(""); setEngineVersion(""); setMasterUsername(""); setMasterPassword(""); setDbName("")
      setMultiAz(false); setPubliclyAccessible(false)
      toast.success(`DB instance "${identifier}" creating`)
    },
    onError: () => toast.error("Failed to create DB instance"),
  })

  const startMutation = useMutation({
    mutationFn: (id: string) => instancesApi.startRDSInstance(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rds-instances", instanceId] })
      toast.success("Starting DB instance")
    },
    onError: () => toast.error("Failed to start DB instance"),
  })

  const stopMutation = useMutation({
    mutationFn: (id: string) => instancesApi.stopRDSInstance(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rds-instances", instanceId] })
      toast.success("Stopping DB instance")
    },
    onError: () => toast.error("Failed to stop DB instance"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteRDSInstance(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rds-instances", instanceId] })
      setDeleteConfirm(null)
      toast.success("DB instance deleted")
    },
    onError: () => toast.error("Failed to delete DB instance"),
  })

  const createSnapshotMutation = useMutation({
    mutationFn: () => instancesApi.createRDSSnapshot(instanceId, snapshotDialog!, snapshotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rds-snapshots", instanceId] })
      setSnapshotDialog(null)
      setSnapshotId("")
      toast.success("Snapshot creation started")
    },
    onError: () => toast.error("Failed to create snapshot"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">DB Instances ({instances.length})</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => {
              setIdentifier(""); setEngine("postgres"); setEngineVersion(""); setDbClass("db.t3.micro")
              setStorage("20"); setMasterUsername(""); setMasterPassword(""); setDbName("")
              setMultiAz(false); setPubliclyAccessible(false); setCreateOpen(true)
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Create DB Instance
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
                <TableHead>Identifier</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Multi-AZ</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-40">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 9 : 8} className="text-center text-muted-foreground text-sm h-24">No DB instances found</TableCell>
                </TableRow>
              ) : instances.map((i) => (
                <TableRow key={i.db_instance_identifier}>
                  <TableCell className="font-mono text-sm">{i.db_instance_identifier}</TableCell>
                  <TableCell className="text-sm">{i.engine} {i.engine_version}</TableCell>
                  <TableCell><StatusBadge status={i.db_instance_status} /></TableCell>
                  <TableCell className="text-sm">{i.db_instance_class}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                    {i.endpoint_address ? `${i.endpoint_address}:${i.endpoint_port}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{i.allocated_storage} GB</TableCell>
                  <TableCell>
                    <Badge variant={i.multi_az ? "default" : "secondary"} className="text-xs">{i.multi_az ? "Yes" : "No"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.instance_create_time ? new Date(i.instance_create_time).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Start"
                          disabled={i.db_instance_status !== "stopped" || startMutation.isPending}
                          onClick={() => startMutation.mutate(i.db_instance_identifier)}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Stop"
                          disabled={i.db_instance_status !== "available" || stopMutation.isPending}
                          onClick={() => stopMutation.mutate(i.db_instance_identifier)}
                        >
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Create Snapshot"
                          onClick={() => { setSnapshotDialog(i.db_instance_identifier); setSnapshotId("") }}
                        >
                          <Camera className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Delete"
                          onClick={() => setDeleteConfirm(i.db_instance_identifier)}
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

      {/* Create DB Instance Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create DB Instance</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <label className="text-sm font-medium">DB Instance Identifier</label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1" placeholder="my-database" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Engine</label>
                <Select value={engine} onValueChange={(v) => v && setEngine(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">postgres</SelectItem>
                    <SelectItem value="mysql">mysql</SelectItem>
                    <SelectItem value="mariadb">mariadb</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Engine Version (optional)</label>
                <Input value={engineVersion} onChange={(e) => setEngineVersion(e.target.value)} className="mt-1" placeholder="15.4" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Instance Class</label>
                <Select value={dbClass} onValueChange={(v) => v && setDbClass(v)}>
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="db.t3.micro">db.t3.micro</SelectItem>
                    <SelectItem value="db.t3.small">db.t3.small</SelectItem>
                    <SelectItem value="db.t3.medium">db.t3.medium</SelectItem>
                    <SelectItem value="db.t3.large">db.t3.large</SelectItem>
                    <SelectItem value="db.r5.large">db.r5.large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Storage (GB)</label>
                <Input type="number" min={20} value={storage} onChange={(e) => setStorage(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Master Username</label>
              <Input value={masterUsername} onChange={(e) => setMasterUsername(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Master Password</label>
              <Input type="password" value={masterPassword} onChange={(e) => setMasterPassword(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">DB Name (optional)</label>
              <Input value={dbName} onChange={(e) => setDbName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={multiAz} onCheckedChange={setMultiAz} id="multi-az" />
              <label htmlFor="multi-az" className="text-sm font-medium">Multi-AZ</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={publiclyAccessible} onCheckedChange={setPubliclyAccessible} id="public-access" />
              <label htmlFor="public-access" className="text-sm font-medium">Publicly Accessible</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!identifier || !masterUsername || !masterPassword || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Snapshot Dialog */}
      <Dialog open={!!snapshotDialog} onOpenChange={() => setSnapshotDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Snapshot — {snapshotDialog}</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Snapshot Identifier</label>
            <Input value={snapshotId} onChange={(e) => setSnapshotId(e.target.value)} className="mt-1" placeholder="my-snapshot" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotDialog(null)}>Cancel</Button>
            <Button onClick={() => createSnapshotMutation.mutate()} disabled={!snapshotId || createSnapshotMutation.isPending}>Create</Button>
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

// ─── Snapshots Tab ────────────────────────────────────────────────────────────

function SnapshotsTab({ instanceId }: { instanceId: string }) {
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["rds-snapshots", instanceId],
    queryFn: () => instancesApi.listRDSSnapshots(instanceId).then((r) => r.data as RDSSnapshot[]),
  })

  return (
    <div className="space-y-3 pt-3">
      <span className="text-sm font-medium">Snapshots ({snapshots.length})</span>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Snapshot ID</TableHead>
                <TableHead>DB Instance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-sm h-24">No snapshots found</TableCell>
                </TableRow>
              ) : snapshots.map((s) => (
                <TableRow key={s.db_snapshot_identifier}>
                  <TableCell className="font-mono text-sm">{s.db_snapshot_identifier}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.db_instance_identifier}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-sm">{s.engine}</TableCell>
                  <TableCell className="text-sm">{s.allocated_storage} GB</TableCell>
                  <TableCell className="text-sm">{s.percent_progress}%</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.snapshot_create_time ? new Date(s.snapshot_create_time).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Clusters Tab ─────────────────────────────────────────────────────────────

function ClustersTab({ instanceId }: { instanceId: string }) {
  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ["rds-clusters", instanceId],
    queryFn: () => instancesApi.listRDSClusters(instanceId).then((r) => r.data as RDSCluster[]),
  })

  return (
    <div className="space-y-3 pt-3">
      <span className="text-sm font-medium">Clusters ({clusters.length})</span>
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
                <TableHead>Endpoint</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No clusters found</TableCell>
                </TableRow>
              ) : clusters.map((c) => (
                <TableRow key={c.db_cluster_identifier}>
                  <TableCell className="font-mono text-sm">{c.db_cluster_identifier}</TableCell>
                  <TableCell className="text-sm">{c.engine}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[260px] truncate">{c.endpoint || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RDSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">RDS</h2>
      </div>

      <Tabs defaultValue="instances">
        <TabsList>
          <TabsTrigger value="instances">DB Instances</TabsTrigger>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="clusters">Clusters</TabsTrigger>
        </TabsList>
        <TabsContent value="instances">
          <InstancesTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="snapshots">
          <SnapshotsTab instanceId={instanceId} />
        </TabsContent>
        <TabsContent value="clusters">
          <ClustersTab instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
