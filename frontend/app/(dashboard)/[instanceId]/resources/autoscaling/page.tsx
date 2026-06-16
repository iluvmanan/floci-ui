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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Pencil, Plus, RefreshCw, Settings, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ASG {
  auto_scaling_group_name: string
  min_size: number
  max_size: number
  desired_capacity: number
  instances: { instance_id: string; lifecycle_state: string; health_status: string }[]
  availability_zones: string[]
  created_time: string
}

interface ScalingActivity {
  activity_id: string
  description: string
  status_code: string
  start_time: string
  end_time?: string
  cause: string
}

interface ScalingPolicy {
  policy_name: string
  policy_type: string
  adjustment_type?: string
  scaling_adjustment?: number
  target_tracking_configuration?: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lifecycleBadge(state: string) {
  const ok = ["InService"].includes(state)
  const warn = ["Pending", "Pending:Wait", "Pending:Proceed", "Rebooting"].includes(state)
  return (
    <Badge variant={ok ? "default" : warn ? "secondary" : "outline"} className="text-xs">
      {state}
    </Badge>
  )
}

function statusBadge(status: string) {
  const ok = ["Successful"].includes(status)
  const fail = ["Failed", "Cancelled"].includes(status)
  return (
    <Badge variant={ok ? "default" : fail ? "destructive" : "secondary"} className="text-xs">
      {status}
    </Badge>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutoScalingPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedASG, setSelectedASG] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ASG | null>(null)
  const [capacityTarget, setCapacityTarget] = useState<ASG | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: groups = [], isLoading, refetch } = useQuery({
    queryKey: ["asgs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listASGs(instanceId)
      return r.data as ASG[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createASG(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asgs", instanceId] })
      setCreateOpen(false)
      toast.success("Auto Scaling group created")
    },
    onError: () => toast.error("Failed to create Auto Scaling group"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ name, body }: { name: string; body: Record<string, unknown> }) =>
      instancesApi.updateASG(instanceId, name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asgs", instanceId] })
      setEditTarget(null)
      toast.success("Auto Scaling group updated")
    },
    onError: () => toast.error("Failed to update Auto Scaling group"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteASG(instanceId, name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["asgs", instanceId] })
      setDeleteTarget(null)
      if (selectedASG === name) setSelectedASG(null)
      toast.success("Auto Scaling group deleted")
    },
    onError: () => toast.error("Failed to delete Auto Scaling group"),
  })

  const capacityMutation = useMutation({
    mutationFn: ({ name, desired }: { name: string; desired: number }) =>
      instancesApi.setASGDesiredCapacity(instanceId, name, desired),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asgs", instanceId] })
      setCapacityTarget(null)
      toast.success("Desired capacity updated")
    },
    onError: () => toast.error("Failed to update desired capacity"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Auto Scaling Groups</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create ASG
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Min</TableHead>
                <TableHead>Desired</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Instances</TableHead>
                <TableHead>AZs</TableHead>
                {canMutate && <TableHead className="w-40">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 7 : 6} className="text-center text-muted-foreground h-24">
                    No Auto Scaling groups found
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <TableRow
                    key={g.auto_scaling_group_name}
                    className="cursor-pointer"
                    onClick={() => setSelectedASG(g.auto_scaling_group_name)}
                    data-state={selectedASG === g.auto_scaling_group_name ? "selected" : undefined}
                  >
                    <TableCell className="font-medium text-sm">{g.auto_scaling_group_name}</TableCell>
                    <TableCell>{g.min_size}</TableCell>
                    <TableCell>{g.desired_capacity}</TableCell>
                    <TableCell>{g.max_size}</TableCell>
                    <TableCell>{g.instances?.length ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(g.availability_zones ?? []).join(", ")}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Set desired capacity"
                            onClick={() => setCapacityTarget(g)}
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit"
                            onClick={() => setEditTarget(g)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Delete"
                            onClick={() => setDeleteTarget(g.auto_scaling_group_name)}
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

      {selectedASG && (
        <ASGDetail instanceId={instanceId} name={selectedASG} canMutate={canMutate} />
      )}

      {/* Create ASG Dialog */}
      <CreateASGDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Edit ASG Dialog (min/desired/max) */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editTarget?.auto_scaling_group_name}</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <EditASGForm
              asg={editTarget}
              onSubmit={(body) => updateMutation.mutate({ name: editTarget.auto_scaling_group_name, body })}
              isPending={updateMutation.isPending}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Set Desired Capacity Dialog */}
      <Dialog open={!!capacityTarget} onOpenChange={() => setCapacityTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Desired Capacity</DialogTitle>
          </DialogHeader>
          {capacityTarget && (
            <CapacityForm
              asg={capacityTarget}
              isPending={capacityMutation.isPending}
              onSubmit={(desired) =>
                capacityMutation.mutate({ name: capacityTarget.auto_scaling_group_name, desired })
              }
              onCancel={() => setCapacityTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Auto Scaling Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete Auto Scaling group <span className="font-mono font-medium">{deleteTarget}</span>? This
            will terminate all instances in the group.
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

// ─── Create ASG Dialog ──────────────────────────────────────────────────────────

function CreateASGDialog({
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
  const [minSize, setMinSize] = useState("1")
  const [maxSize, setMaxSize] = useState("3")
  const [desired, setDesired] = useState("1")
  const [launchTemplateId, setLaunchTemplateId] = useState("")
  const [subnetIds, setSubnetIds] = useState("")

  function reset() {
    setName("")
    setMinSize("1")
    setMaxSize("3")
    setDesired("1")
    setLaunchTemplateId("")
    setSubnetIds("")
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
          <DialogTitle>Create Auto Scaling Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input placeholder="my-asg" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Launch Template ID</Label>
            <Input placeholder="lt-0123456789abcdef0" value={launchTemplateId} onChange={(e) => setLaunchTemplateId(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Min Size</Label>
              <Input type="number" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Desired</Label>
              <Input type="number" value={desired} onChange={(e) => setDesired(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Max Size</Label>
              <Input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Subnet IDs (comma-separated)</Label>
            <Input
              placeholder="subnet-abc123, subnet-def456"
              value={subnetIds}
              onChange={(e) => setSubnetIds(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name || !launchTemplateId || !subnetIds || isPending}
            onClick={() =>
              onSubmit({
                auto_scaling_group_name: name,
                launch_template_id: launchTemplateId,
                min_size: parseInt(minSize, 10),
                max_size: parseInt(maxSize, 10),
                desired_capacity: parseInt(desired, 10),
                vpc_zone_identifier: subnetIds
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join(","),
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit ASG Form ───────────────────────────────────────────────────────────

function EditASGForm({
  asg,
  onSubmit,
  isPending,
  onCancel,
}: {
  asg: ASG
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
  onCancel: () => void
}) {
  const [minSize, setMinSize] = useState(String(asg.min_size))
  const [maxSize, setMaxSize] = useState(String(asg.max_size))
  const [desired, setDesired] = useState(String(asg.desired_capacity))

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label>Min Size</Label>
          <Input type="number" value={minSize} onChange={(e) => setMinSize(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Desired</Label>
          <Input type="number" value={desired} onChange={(e) => setDesired(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Max Size</Label>
          <Input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={isPending}
          onClick={() =>
            onSubmit({
              min_size: parseInt(minSize, 10),
              max_size: parseInt(maxSize, 10),
              desired_capacity: parseInt(desired, 10),
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  )
}

// ─── Capacity Form ───────────────────────────────────────────────────────────

function CapacityForm({
  asg,
  isPending,
  onSubmit,
  onCancel,
}: {
  asg: ASG
  isPending: boolean
  onSubmit: (desired: number) => void
  onCancel: () => void
}) {
  const [desired, setDesired] = useState(String(asg.desired_capacity))

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Desired Capacity</Label>
        <Input type="number" value={desired} onChange={(e) => setDesired(e.target.value)} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={isPending} onClick={() => onSubmit(parseInt(desired, 10))}>
          Apply
        </Button>
      </DialogFooter>
    </div>
  )
}

// ─── ASG Detail (Tabs: Instances | Activity | Scaling Policies) ───────────────

function ASGDetail({
  instanceId,
  name,
  canMutate,
}: {
  instanceId: string
  name: string
  canMutate: boolean
}) {
  const { data: groups = [] } = useQuery({
    queryKey: ["asgs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listASGs(instanceId)
      return r.data as ASG[]
    },
  })
  const asg = groups.find((g) => g.auto_scaling_group_name === name)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium font-mono">{name}</h3>
      <Tabs defaultValue="instances">
        <TabsList>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="policies">Scaling Policies</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instance ID</TableHead>
                <TableHead>Lifecycle State</TableHead>
                <TableHead>Health Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(asg?.instances ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground h-16">
                    No instances
                  </TableCell>
                </TableRow>
              ) : (
                asg!.instances.map((i) => (
                  <TableRow key={i.instance_id}>
                    <TableCell className="font-mono text-xs">{i.instance_id}</TableCell>
                    <TableCell>{lifecycleBadge(i.lifecycle_state)}</TableCell>
                    <TableCell className="text-xs">{i.health_status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="activity" className="mt-3">
          <ActivityTab instanceId={instanceId} name={name} />
        </TabsContent>

        <TabsContent value="policies" className="mt-3">
          <PoliciesTab instanceId={instanceId} name={name} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({ instanceId, name }: { instanceId: string; name: string }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["asg-activities", instanceId, name],
    queryFn: async () => {
      const r = await instancesApi.getASGActivities(instanceId, name)
      return r.data as ScalingActivity[]
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Cause</TableHead>
          <TableHead>Start Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {activities.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground h-16">
              No recent activity
            </TableCell>
          </TableRow>
        ) : (
          activities.map((a) => (
            <TableRow key={a.activity_id}>
              <TableCell className="text-xs">{a.description}</TableCell>
              <TableCell>{statusBadge(a.status_code)}</TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-xs truncate" title={a.cause}>
                {a.cause}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{a.start_time}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

// ─── Scaling Policies Tab ────────────────────────────────────────────────────

function PoliciesTab({
  instanceId,
  name,
  canMutate,
}: {
  instanceId: string
  name: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["asg-policies", instanceId, name],
    queryFn: async () => {
      const r = await instancesApi.listScalingPolicies(instanceId, name)
      return r.data as ScalingPolicy[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createScalingPolicy(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asg-policies", instanceId, name] })
      setAddOpen(false)
      toast.success("Scaling policy created")
    },
    onError: () => toast.error("Failed to create scaling policy"),
  })

  const deleteMutation = useMutation({
    mutationFn: (policyName: string) => instancesApi.deleteScalingPolicy(instanceId, policyName, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asg-policies", instanceId, name] })
      setDeleteTarget(null)
      toast.success("Scaling policy deleted")
    },
    onError: () => toast.error("Failed to delete scaling policy"),
  })

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canMutate && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Policy
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Adjustment</TableHead>
              {canMutate && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {policies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground h-16">
                  No scaling policies
                </TableCell>
              </TableRow>
            ) : (
              policies.map((p) => (
                <TableRow key={p.policy_name}>
                  <TableCell className="text-sm">{p.policy_name}</TableCell>
                  <TableCell className="text-xs">{p.policy_type}</TableCell>
                  <TableCell className="text-xs">
                    {p.scaling_adjustment !== undefined
                      ? `${p.scaling_adjustment} (${p.adjustment_type})`
                      : p.target_tracking_configuration
                      ? "Target tracking"
                      : "—"}
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setDeleteTarget(p.policy_name)}
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

      {/* Add Policy Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Scaling Policy</DialogTitle>
          </DialogHeader>
          <AddPolicyForm
            asgName={name}
            isPending={createMutation.isPending}
            onSubmit={(body) => createMutation.mutate(body)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scaling Policy</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete scaling policy <span className="font-mono font-medium">{deleteTarget}</span>?
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

// ─── Add Policy Form ─────────────────────────────────────────────────────────

function AddPolicyForm({
  asgName,
  isPending,
  onSubmit,
  onCancel,
}: {
  asgName: string
  isPending: boolean
  onSubmit: (body: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [policyName, setPolicyName] = useState("")
  const [policyType, setPolicyType] = useState("TargetTrackingScaling")
  const [adjustment, setAdjustment] = useState("1")
  const [adjustmentType, setAdjustmentType] = useState("ChangeInCapacity")
  const [targetValue, setTargetValue] = useState("50")
  const [metricType, setMetricType] = useState("ASGAverageCPUUtilization")

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Policy Name</Label>
        <Input placeholder="scale-out-on-cpu" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Policy Type</Label>
        <Select value={policyType} onValueChange={(v) => v && setPolicyType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TargetTrackingScaling">Target Tracking</SelectItem>
            <SelectItem value="SimpleScaling">Simple Scaling</SelectItem>
            <SelectItem value="StepScaling">Step Scaling</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {policyType === "TargetTrackingScaling" ? (
        <>
          <div className="space-y-1">
            <Label>Metric Type</Label>
            <Select value={metricType} onValueChange={(v) => v && setMetricType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASGAverageCPUUtilization">Average CPU Utilization</SelectItem>
                <SelectItem value="ASGAverageNetworkIn">Average Network In</SelectItem>
                <SelectItem value="ASGAverageNetworkOut">Average Network Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Target Value</Label>
            <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Adjustment Type</Label>
            <Select value={adjustmentType} onValueChange={(v) => v && setAdjustmentType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ChangeInCapacity">ChangeInCapacity</SelectItem>
                <SelectItem value="ExactCapacity">ExactCapacity</SelectItem>
                <SelectItem value="PercentChangeInCapacity">PercentChangeInCapacity</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Scaling Adjustment</Label>
            <Input type="number" value={adjustment} onChange={(e) => setAdjustment(e.target.value)} />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={!policyName || isPending}
          onClick={() =>
            onSubmit(
              policyType === "TargetTrackingScaling"
                ? {
                    auto_scaling_group_name: asgName,
                    policy_name: policyName,
                    policy_type: policyType,
                    target_tracking_configuration: {
                      PredefinedMetricSpecification: { PredefinedMetricType: metricType },
                      TargetValue: parseFloat(targetValue),
                    },
                  }
                : {
                    auto_scaling_group_name: asgName,
                    policy_name: policyName,
                    policy_type: policyType,
                    adjustment_type: adjustmentType,
                    scaling_adjustment: parseInt(adjustment, 10),
                  }
            )
          }
        >
          Create
        </Button>
      </DialogFooter>
    </div>
  )
}
