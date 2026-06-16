"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ChevronLeft, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Cluster {
  cluster_arn: string
  cluster_name: string
  status: string
  running_tasks_count: number
  pending_tasks_count: number
  active_services_count: number
  registered_container_instances_count: number
}

interface Service {
  service_name: string
  service_arn: string
  status: string
  desired_count: number
  running_count: number
  pending_count: number
  task_definition: string
  launch_type: string
  created_at: string
}

interface Task {
  task_arn: string
  task_definition_arn: string
  last_status: string
  desired_status: string
  started_at: string
  stopped_at: string
  stop_code: string
  stopped_reason: string
  containers: unknown[]
}

interface TaskDefFamily {
  family: string
  revisions: number[]
  latest_arn: string
}

interface TaskDefDetail {
  family: string
  revision: number
  task_definition_arn: string
  containers: unknown[]
  volumes: unknown[]
  cpu: string
  memory: string
  network_mode: string
  status: string
  requires_compatibilities: string[]
  task_role_arn: string
  execution_role_arn: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(state: string) {
  const variants: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    RUNNING: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    PROVISIONING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    STOPPED: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    DEPROVISIONING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    DRAINING: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    INACTIVE: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
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

function truncateMid(s: string, len = 24) {
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ECSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedCluster, setSelectedCluster] = useState<string | null>(null)
  const [createClusterOpen, setCreateClusterOpen] = useState(false)
  const [deleteClusterTarget, setDeleteClusterTarget] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"clusters" | "task-defs-global">("clusters")

  const { data: clusters = [], isLoading: clustersLoading, refetch: refetchClusters } = useQuery({
    queryKey: ["ecs-clusters", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listECSClusters(instanceId)
      return r.data as Cluster[]
    },
  })

  const createClusterMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createECSCluster(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-clusters", instanceId] })
      setCreateClusterOpen(false)
      toast.success("Cluster created")
    },
    onError: () => toast.error("Failed to create cluster"),
  })

  const deleteClusterMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteECSCluster(instanceId, name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["ecs-clusters", instanceId] })
      setDeleteClusterTarget(null)
      if (selectedCluster === name) setSelectedCluster(null)
      toast.success("Cluster deleted")
    },
    onError: () => toast.error("Failed to delete cluster"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">ECS</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "task-defs-global" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode(viewMode === "clusters" ? "task-defs-global" : "clusters")}
          >
            {viewMode === "clusters" ? "Task Definitions" : "Back to Clusters"}
          </Button>
        </div>
      </div>

      {viewMode === "task-defs-global" ? (
        <TaskDefinitionsPanel instanceId={instanceId} canMutate={canMutate} />
      ) : (
        <div className="flex gap-4">
          {/* Cluster list */}
          <div className="w-72 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {clusters.length} cluster{clusters.length !== 1 ? "s" : ""}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => refetchClusters()}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                {canMutate && (
                  <Button size="sm" onClick={() => setCreateClusterOpen(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              {clustersLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : clusters.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">No clusters found</div>
              ) : (
                <ul className="divide-y">
                  {clusters.map((c) => (
                    <li
                      key={c.cluster_arn}
                      className={`p-3 cursor-pointer hover:bg-accent/40 ${
                        selectedCluster === c.cluster_name ? "bg-accent/60" : ""
                      }`}
                      onClick={() => setSelectedCluster(c.cluster_name)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{c.cluster_name}</span>
                        {statusBadge(c.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{c.running_tasks_count} tasks</span>
                        <span>{c.active_services_count} services</span>
                      </div>
                      {canMutate && (
                        <div className="mt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs px-2 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteClusterTarget(c.cluster_name)
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right pane */}
          <div className="flex-1 min-w-0">
            {!selectedCluster ? (
              <div className="border rounded-lg h-64 flex items-center justify-center text-sm text-muted-foreground">
                Select a cluster to view services, tasks, and task definitions
              </div>
            ) : (
              <ClusterDetail instanceId={instanceId} clusterName={selectedCluster} canMutate={canMutate} />
            )}
          </div>
        </div>
      )}

      {/* Create Cluster Dialog */}
      <CreateClusterDialog
        open={createClusterOpen}
        onClose={() => setCreateClusterOpen(false)}
        onSubmit={(body) => createClusterMutation.mutate(body)}
        isPending={createClusterMutation.isPending}
      />

      {/* Delete Cluster Confirmation */}
      <Dialog open={!!deleteClusterTarget} onOpenChange={() => setDeleteClusterTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cluster</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete cluster <span className="font-mono font-medium">{deleteClusterTarget}</span>? This
            action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClusterTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteClusterMutation.isPending}
              onClick={() => deleteClusterTarget && deleteClusterMutation.mutate(deleteClusterTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Cluster Dialog ─────────────────────────────────────────────────────

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
  const [capacityProviders, setCapacityProviders] = useState("")

  function handleSubmit() {
    const body: Record<string, unknown> = { cluster_name: name }
    const providers = capacityProviders.split(",").map((s) => s.trim()).filter(Boolean)
    if (providers.length > 0) body.capacity_providers = providers
    onSubmit(body)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setName("")
          setCapacityProviders("")
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Cluster</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Cluster Name</Label>
            <Input placeholder="my-cluster" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Capacity Providers (optional, comma-separated)</Label>
            <Input
              placeholder="FARGATE,FARGATE_SPOT"
              value={capacityProviders}
              onChange={(e) => setCapacityProviders(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name || isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Cluster Detail (Services | Tasks | Task Definitions) ─────────────────────

function ClusterDetail({
  instanceId,
  clusterName,
  canMutate,
}: {
  instanceId: string
  clusterName: string
  canMutate: boolean
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium font-mono">{clusterName}</h3>
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="task-definitions">Task Definitions</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="mt-4">
          <ServicesTab instanceId={instanceId} clusterName={clusterName} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab instanceId={instanceId} clusterName={clusterName} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="task-definitions" className="mt-4">
          <TaskDefinitionsPanel instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab({
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
  const [updateTarget, setUpdateTarget] = useState<Service | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ["ecs-services", instanceId, clusterName],
    queryFn: async () => {
      const r = await instancesApi.listECSServices(instanceId, clusterName)
      return r.data as Service[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createECSService(instanceId, clusterName, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-services", instanceId, clusterName] })
      setCreateOpen(false)
      toast.success("Service created")
    },
    onError: () => toast.error("Failed to create service"),
  })

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      instancesApi.updateECSService(instanceId, clusterName, updateTarget!.service_name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-services", instanceId, clusterName] })
      setUpdateTarget(null)
      toast.success("Service updated")
    },
    onError: () => toast.error("Failed to update service"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteECSService(instanceId, clusterName, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-services", instanceId, clusterName] })
      setDeleteTarget(null)
      toast.success("Service deleted")
    },
    onError: () => toast.error("Failed to delete service"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {services.length} service{services.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Service
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
                <TableHead>Desired/Running/Pending</TableHead>
                <TableHead>Task Definition</TableHead>
                <TableHead>Launch Type</TableHead>
                {canMutate && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">
                    No services found
                  </TableCell>
                </TableRow>
              ) : (
                services.map((s) => (
                  <TableRow key={s.service_arn}>
                    <TableCell className="font-medium text-sm">{s.service_name}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {s.desired_count}/{s.running_count}/{s.pending_count}
                    </TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-xs">{s.task_definition}</TableCell>
                    <TableCell className="text-xs">{s.launch_type}</TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() => setUpdateTarget(s)}
                          >
                            Update
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setDeleteTarget(s.service_name)}
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

      {/* Create Service Dialog */}
      <CreateServiceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Update Service Dialog */}
      <Dialog open={!!updateTarget} onOpenChange={() => setUpdateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Service — {updateTarget?.service_name}</DialogTitle>
          </DialogHeader>
          {updateTarget && (
            <UpdateServiceForm
              service={updateTarget}
              onSubmit={(body) => updateMutation.mutate(body)}
              isPending={updateMutation.isPending}
              onCancel={() => setUpdateTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete service <span className="font-mono font-medium">{deleteTarget}</span>?
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

function CreateServiceDialog({
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
  const [serviceName, setServiceName] = useState("")
  const [taskDefinition, setTaskDefinition] = useState("")
  const [desiredCount, setDesiredCount] = useState("1")
  const [launchType, setLaunchType] = useState("FARGATE")

  function reset() {
    setServiceName("")
    setTaskDefinition("")
    setDesiredCount("1")
    setLaunchType("FARGATE")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Service</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Service Name</Label>
            <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Task Definition</Label>
            <Input
              placeholder="my-family:1 or ARN"
              value={taskDefinition}
              onChange={(e) => setTaskDefinition(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Desired Count</Label>
            <Input type="number" min={0} value={desiredCount} onChange={(e) => setDesiredCount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Launch Type</Label>
            <Select value={launchType} onValueChange={(v) => v && setLaunchType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FARGATE">FARGATE</SelectItem>
                <SelectItem value="EC2">EC2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                service_name: serviceName,
                task_definition: taskDefinition,
                desired_count: parseInt(desiredCount) || 0,
                launch_type: launchType,
              })
            }
            disabled={!serviceName || !taskDefinition || isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UpdateServiceForm({
  service,
  onSubmit,
  isPending,
  onCancel,
}: {
  service: Service
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
  onCancel: () => void
}) {
  const [desiredCount, setDesiredCount] = useState(String(service.desired_count))
  const [taskDefinition, setTaskDefinition] = useState(service.task_definition)

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Desired Count</Label>
          <Input type="number" min={0} value={desiredCount} onChange={(e) => setDesiredCount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Task Definition</Label>
          <Input value={taskDefinition} onChange={(e) => setTaskDefinition(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() =>
            onSubmit({
              desired_count: parseInt(desiredCount) || 0,
              task_definition: taskDefinition,
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

// ─── Tasks Tab ──────────────────────────────────────────────────────────────────

function TasksTab({
  instanceId,
  clusterName,
  canMutate,
}: {
  instanceId: string
  clusterName: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [runOpen, setRunOpen] = useState(false)
  const [stopTarget, setStopTarget] = useState<string | null>(null)

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ["ecs-tasks", instanceId, clusterName],
    queryFn: async () => {
      const r = await instancesApi.listECSTasks(instanceId, clusterName)
      return r.data as Task[]
    },
  })

  const runMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.runECSTask(instanceId, clusterName, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-tasks", instanceId, clusterName] })
      setRunOpen(false)
      toast.success("Task started")
    },
    onError: () => toast.error("Failed to run task"),
  })

  const stopMutation = useMutation({
    mutationFn: (taskArn: string) => instancesApi.stopECSTask(instanceId, clusterName, taskArn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecs-tasks", instanceId, clusterName] })
      setStopTarget(null)
      toast.success("Task stopping")
    },
    onError: () => toast.error("Failed to stop task"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {tasks.length} task{tasks.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setRunOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Run Task
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
                <TableHead>Task ARN</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Task Definition</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Stopped</TableHead>
                {canMutate && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((t) => (
                  <TableRow key={t.task_arn}>
                    <TableCell className="font-mono text-xs">{truncateMid(t.task_arn, 28)}</TableCell>
                    <TableCell>{statusBadge(t.last_status)}</TableCell>
                    <TableCell className="font-mono text-xs truncate max-w-xs">
                      {truncateMid(t.task_definition_arn, 28)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.started_at && t.started_at !== "" ? t.started_at : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.stopped_at && t.stopped_at !== "" ? t.stopped_at : "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        {t.last_status !== "STOPPED" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2 text-destructive"
                            onClick={() => setStopTarget(t.task_arn)}
                          >
                            Stop
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Run Task Dialog */}
      <RunTaskDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        onSubmit={(body) => runMutation.mutate(body)}
        isPending={runMutation.isPending}
      />

      {/* Stop Task Confirmation */}
      <Dialog open={!!stopTarget} onOpenChange={() => setStopTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop Task</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Stop task <span className="font-mono font-medium">{stopTarget && truncateMid(stopTarget, 40)}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStopTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={stopMutation.isPending}
              onClick={() => stopTarget && stopMutation.mutate(stopTarget)}
            >
              Stop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RunTaskDialog({
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
  const [taskDefinition, setTaskDefinition] = useState("")
  const [count, setCount] = useState("1")
  const [launchType, setLaunchType] = useState("FARGATE")

  function reset() {
    setTaskDefinition("")
    setCount("1")
    setLaunchType("FARGATE")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Task Definition</Label>
            <Input
              placeholder="my-family:1 or ARN"
              value={taskDefinition}
              onChange={(e) => setTaskDefinition(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Count</Label>
            <Input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Launch Type</Label>
            <Select value={launchType} onValueChange={(v) => v && setLaunchType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FARGATE">FARGATE</SelectItem>
                <SelectItem value="EC2">EC2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                task_definition: taskDefinition,
                count: parseInt(count) || 1,
                launch_type: launchType,
              })
            }
            disabled={!taskDefinition || isPending}
          >
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Task Definitions Panel (global) ────────────────────────────────────────────

function TaskDefinitionsPanel({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [deregisterTarget, setDeregisterTarget] = useState<{ family: string; revision: number } | null>(null)

  const { data: families = [], isLoading, refetch } = useQuery({
    queryKey: ["ecs-task-def-families", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listTaskDefinitions(instanceId)
      return r.data as TaskDefFamily[]
    },
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["ecs-task-def-detail", instanceId, selectedFamily, selectedRevision],
    queryFn: async () => {
      const ref = selectedRevision ? `${selectedFamily}:${selectedRevision}` : selectedFamily!
      const r = await instancesApi.describeTaskDefinition(instanceId, ref)
      return r.data as TaskDefDetail
    },
    enabled: !!selectedFamily,
  })

  const registerMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.registerTaskDefinition(instanceId, body),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ecs-task-def-families", instanceId] })
      const data = r.data as { family: string; revision: number }
      setRegisterOpen(false)
      setSelectedFamily(data.family)
      setSelectedRevision(data.revision)
      toast.success(`Registered revision ${data.revision}`)
    },
    onError: () => toast.error("Failed to register task definition"),
  })

  const deregisterMutation = useMutation({
    mutationFn: ({ family, revision }: { family: string; revision: number }) =>
      instancesApi.deregisterTaskDefinition(instanceId, family, revision),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["ecs-task-def-families", instanceId] })
      setDeregisterTarget(null)
      if (selectedRevision === vars.revision) setSelectedRevision(null)
      toast.success("Revision deregistered")
    },
    onError: () => toast.error("Failed to deregister revision"),
  })

  const currentFamily = families.find((f) => f.family === selectedFamily)

  return (
    <div className="flex gap-4">
      {/* Families list */}
      <div className="w-64 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {families.length} famil{families.length !== 1 ? "ies" : "y"}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {canMutate && (
              <Button size="sm" onClick={() => setRegisterOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : families.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No task definitions found</div>
          ) : (
            <ul className="divide-y">
              {families.map((f) => (
                <li
                  key={f.family}
                  className={`p-2 cursor-pointer hover:bg-accent/40 text-sm ${
                    selectedFamily === f.family ? "bg-accent/60" : ""
                  }`}
                  onClick={() => {
                    setSelectedFamily(f.family)
                    setSelectedRevision(null)
                  }}
                >
                  <div className="font-medium truncate">{f.family}</div>
                  <div className="text-xs text-muted-foreground">{f.revisions.length} revision(s)</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Revisions + detail */}
      <div className="flex-1 min-w-0 space-y-3">
        {!selectedFamily ? (
          <div className="border rounded-lg h-64 flex items-center justify-center text-sm text-muted-foreground">
            Select a family to view revisions
          </div>
        ) : (
          <>
            {selectedRevision !== null && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedRevision(null)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to revisions
              </Button>
            )}
            {selectedRevision === null ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Revision</TableHead>
                      {canMutate && <TableHead className="w-24" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(currentFamily?.revisions ?? [])
                      .slice()
                      .sort((a, b) => b - a)
                      .map((rev) => (
                        <TableRow
                          key={rev}
                          className="cursor-pointer hover:bg-accent/40"
                          onClick={() => setSelectedRevision(rev)}
                        >
                          <TableCell className="font-mono text-sm">
                            {selectedFamily}:{rev}
                          </TableCell>
                          {canMutate && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => setDeregisterTarget({ family: selectedFamily, revision: rev })}
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
            ) : detailLoading ? (
              <Skeleton className="h-64" />
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">CPU:</span> {detail?.cpu || "—"}</div>
                  <div><span className="text-muted-foreground">Memory:</span> {detail?.memory || "—"}</div>
                  <div><span className="text-muted-foreground">Network Mode:</span> {detail?.network_mode || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> {detail?.status || "—"}</div>
                </div>
                <pre className="text-xs bg-muted rounded-md p-3 max-h-96 overflow-auto font-mono">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>

      {/* Register Task Definition Dialog */}
      <RegisterTaskDefDialog
        open={registerOpen}
        defaultFamily={selectedFamily ?? ""}
        onClose={() => setRegisterOpen(false)}
        onSubmit={(body) => registerMutation.mutate(body)}
        isPending={registerMutation.isPending}
      />

      {/* Deregister Confirmation */}
      <Dialog open={!!deregisterTarget} onOpenChange={() => setDeregisterTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deregister Revision</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deregister{" "}
            <span className="font-mono font-medium">
              {deregisterTarget?.family}:{deregisterTarget?.revision}
            </span>
            ?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeregisterTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deregisterMutation.isPending}
              onClick={() => deregisterTarget && deregisterMutation.mutate(deregisterTarget)}
            >
              Deregister
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RegisterTaskDefDialog({
  open,
  defaultFamily,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean
  defaultFamily: string
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [family, setFamily] = useState(defaultFamily)
  const [containerDefsText, setContainerDefsText] = useState("")
  const [cpu, setCpu] = useState("")
  const [memory, setMemory] = useState("")
  const [networkMode, setNetworkMode] = useState("")
  const [requiresCompat, setRequiresCompat] = useState("FARGATE")
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setFamily(defaultFamily)
    setContainerDefsText("")
    setCpu("")
    setMemory("")
    setNetworkMode("")
    setRequiresCompat("FARGATE")
    setError(null)
  }

  function handleSubmit() {
    let containerDefinitions
    try {
      containerDefinitions = JSON.parse(containerDefsText)
      if (!Array.isArray(containerDefinitions)) throw new Error("Must be a JSON array")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON")
      return
    }
    setError(null)
    const body: Record<string, unknown> = {
      family,
      container_definitions: containerDefinitions,
    }
    if (cpu) body.cpu = cpu
    if (memory) body.memory = memory
    if (networkMode) body.network_mode = networkMode
    if (requiresCompat) body.requires_compatibilities = [requiresCompat]
    onSubmit(body)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        } else {
          setFamily(defaultFamily)
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register New Task Definition Revision</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Family</Label>
            <Input value={family} onChange={(e) => setFamily(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>CPU (optional)</Label>
              <Input placeholder="256" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Memory (optional)</Label>
              <Input placeholder="512" value={memory} onChange={(e) => setMemory(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Network Mode (optional)</Label>
              <Input placeholder="awsvpc" value={networkMode} onChange={(e) => setNetworkMode(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Requires Compatibility</Label>
              <Select value={requiresCompat} onValueChange={(v) => v && setRequiresCompat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FARGATE">FARGATE</SelectItem>
                  <SelectItem value="EC2">EC2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Container Definitions (JSON array)</Label>
            <Textarea
              className="font-mono text-xs min-h-40"
              placeholder='[{"name": "app", "image": "nginx:latest", "memory": 256, "essential": true}]'
              value={containerDefsText}
              onChange={(e) => setContainerDefsText(e.target.value)}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!family || !containerDefsText || isPending}>
            Register
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
