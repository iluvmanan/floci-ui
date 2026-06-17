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
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vault {
  backup_vault_name: string
  backup_vault_arn: string
  number_of_recovery_points: number
  creation_date: string
  encryption_key_arn?: string
}

interface PlanRule {
  rule_name: string
  target_backup_vault_name: string
  schedule_expression: string
  retention_days?: number
}

interface Plan {
  backup_plan_id: string
  backup_plan_name?: string
  creation_date: string
  last_execution_date?: string
  rules_count?: number
}

interface BackupJob {
  backup_job_id: string
  resource_arn: string
  resource_type: string
  backup_vault_name: string
  state: string
  percent_done?: string
  creation_date: string
}

interface RecoveryPoint {
  recovery_point_arn: string
  resource_arn: string
  resource_type: string
  creation_date: string
  backup_size_in_bytes?: number
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied")
}

function truncateMid(s: string, len = 28) {
  if (!s) return "—"
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    AVAILABLE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    ABORTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    RUNNING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    CREATING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    PENDING: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    EXPIRED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status || "—"}
    </span>
  )
}

function formatBytes(bytes?: number) {
  if (bytes == null) return "—"
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BackupPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">AWS Backup</h2>
      <Tabs defaultValue="vaults">
        <TabsList>
          <TabsTrigger value="vaults">Vaults</TabsTrigger>
          <TabsTrigger value="plans">Backup Plans</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="recovery-points">Recovery Points</TabsTrigger>
        </TabsList>
        <TabsContent value="vaults"><VaultsTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="jobs"><JobsTab /></TabsContent>
        <TabsContent value="recovery-points"><RecoveryPointsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Vaults Tab ───────────────────────────────────────────────────────────────

function VaultsTab() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Vault | null>(null)
  const [name, setName] = useState("")
  const [kmsKeyArn, setKmsKeyArn] = useState("")

  const { data: vaults = [], isLoading, refetch } = useQuery({
    queryKey: ["backup-vaults", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupVaults(instanceId)
      return r.data as Vault[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createBackupVault(instanceId, {
        backup_vault_name: name,
        ...(kmsKeyArn ? { encryption_key_arn: kmsKeyArn } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-vaults", instanceId] })
      setCreateOpen(false)
      setName("")
      setKmsKeyArn("")
      toast.success("Vault created")
    },
    onError: () => toast.error("Failed to create vault"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteBackupVault(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-vaults", instanceId] })
      setDeleteTarget(null)
      toast.success("Vault deleted")
    },
    onError: () => toast.error("Failed to delete vault"),
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
            Create Vault
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>ARN</TableHead>
                <TableHead>Recovery Points</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vaults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No vaults found</TableCell>
                </TableRow>
              ) : vaults.map((v) => (
                <TableRow key={v.backup_vault_name}>
                  <TableCell className="font-medium text-sm">{v.backup_vault_name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{truncateMid(v.backup_vault_arn)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(v.backup_vault_arn)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.number_of_recovery_points}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{v.creation_date || "—"}</TableCell>
                  <TableCell>
                    {canMutate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(v)}>
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

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setName(""); setKmsKeyArn("") } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Backup Vault</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>KMS Key ARN (optional)</Label>
              <Input value={kmsKeyArn} onChange={(e) => setKmsKeyArn(e.target.value)} placeholder="arn:aws:kms:..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Vault</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete vault <span className="font-mono font-medium text-foreground">{deleteTarget?.backup_vault_name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.backup_vault_name)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Plans Tab ────────────────────────────────────────────────────────────────

function PlansTab() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null)

  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ["backup-plans", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupPlans(instanceId)
      return r.data as Plan[]
    },
  })

  const { data: vaults = [] } = useQuery({
    queryKey: ["backup-vaults", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupVaults(instanceId)
      return r.data as Vault[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteBackupPlan(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-plans", instanceId] })
      setDeleteTarget(null)
      toast.success("Backup plan deleted")
    },
    onError: () => toast.error("Failed to delete backup plan"),
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
            Create Plan
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No backup plans found</TableCell>
                </TableRow>
              ) : plans.map((p) => (
                <TableRow key={p.backup_plan_id}>
                  <TableCell className="font-medium text-sm">{p.backup_plan_name || p.backup_plan_id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.creation_date || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.last_execution_date || "—"}</TableCell>
                  <TableCell className="text-sm">{p.rules_count ?? "—"}</TableCell>
                  <TableCell>
                    {canMutate && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(p)}>
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

      <CreatePlanDialog open={createOpen} onClose={() => setCreateOpen(false)} instanceId={instanceId} vaults={vaults} />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Backup Plan</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete plan <span className="font-mono font-medium text-foreground">{deleteTarget?.backup_plan_name || deleteTarget?.backup_plan_id}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.backup_plan_id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreatePlanDialog({
  open,
  onClose,
  instanceId,
  vaults,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  vaults: Vault[]
}) {
  const qc = useQueryClient()
  const [planName, setPlanName] = useState("")
  const [rules, setRules] = useState<PlanRule[]>([{ rule_name: "", target_backup_vault_name: "", schedule_expression: "", retention_days: undefined }])

  function reset() {
    setPlanName("")
    setRules([{ rule_name: "", target_backup_vault_name: "", schedule_expression: "", retention_days: undefined }])
  }

  function updateRule(i: number, patch: Partial<PlanRule>) {
    setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createBackupPlan(instanceId, {
        backup_plan_name: planName,
        rules: rules
          .filter((r) => r.rule_name && r.target_backup_vault_name)
          .map((r) => ({
            rule_name: r.rule_name,
            target_backup_vault_name: r.target_backup_vault_name,
            schedule_expression: r.schedule_expression,
            ...(r.retention_days ? { lifecycle: { delete_after_days: r.retention_days } } : {}),
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-plans", instanceId] })
      onClose()
      reset()
      toast.success("Backup plan created")
    },
    onError: () => toast.error("Failed to create backup plan"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Backup Plan</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Plan Name</Label>
            <Input value={planName} onChange={(e) => setPlanName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rules</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setRules([...rules, { rule_name: "", target_backup_vault_name: "", schedule_expression: "", retention_days: undefined }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Rule
              </Button>
            </div>
            {rules.map((r, i) => (
              <div key={i} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Rule {i + 1}</span>
                  {rules.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setRules(rules.filter((_, j) => j !== i))}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Rule name" value={r.rule_name} onChange={(e) => updateRule(i, { rule_name: e.target.value })} />
                  <Select value={r.target_backup_vault_name} onValueChange={(v) => v && updateRule(i, { target_backup_vault_name: v })}>
                    <SelectTrigger><SelectValue placeholder="Target vault" /></SelectTrigger>
                    <SelectContent>
                      {vaults.map((v) => (
                        <SelectItem key={v.backup_vault_name} value={v.backup_vault_name}>{v.backup_vault_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="cron(0 5 * * ? *)"
                    value={r.schedule_expression}
                    onChange={(e) => updateRule(i, { schedule_expression: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Retention days"
                    value={r.retention_days ?? ""}
                    onChange={(e) => updateRule(i, { retention_days: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => createMutation.mutate()} disabled={!planName || createMutation.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobsTab() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [startOpen, setStartOpen] = useState(false)

  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ["backup-jobs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupJobs(instanceId)
      return r.data as BackupJob[]
    },
  })

  const { data: vaults = [] } = useQuery({
    queryKey: ["backup-vaults", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupVaults(instanceId)
      return r.data as Vault[]
    },
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {canMutate && (
          <Button size="sm" onClick={() => setStartOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Start Backup Job
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Resource ARN</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Vault</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground h-24">No backup jobs found</TableCell>
                </TableRow>
              ) : jobs.map((j) => (
                <TableRow key={j.backup_job_id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{truncateMid(j.backup_job_id, 20)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(j.backup_job_id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{truncateMid(j.resource_arn)}</TableCell>
                  <TableCell className="text-sm">{j.resource_type}</TableCell>
                  <TableCell className="text-sm">{j.backup_vault_name}</TableCell>
                  <TableCell>{statusBadge(j.state)}</TableCell>
                  <TableCell className="text-xs">
                    <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${j.percent_done ? Math.min(100, Number(j.percent_done)) : 0}%` }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{j.creation_date || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <StartBackupJobDialog open={startOpen} onClose={() => setStartOpen(false)} instanceId={instanceId} vaults={vaults} />
    </div>
  )
}

function StartBackupJobDialog({
  open,
  onClose,
  instanceId,
  vaults,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  vaults: Vault[]
}) {
  const qc = useQueryClient()
  const [vaultName, setVaultName] = useState("")
  const [resourceArn, setResourceArn] = useState("")
  const [iamRoleArn, setIamRoleArn] = useState("")
  const [startWindow, setStartWindow] = useState("")

  function reset() {
    setVaultName("")
    setResourceArn("")
    setIamRoleArn("")
    setStartWindow("")
  }

  const startMutation = useMutation({
    mutationFn: () =>
      instancesApi.startBackupJob(instanceId, {
        backup_vault_name: vaultName,
        resource_arn: resourceArn,
        iam_role_arn: iamRoleArn,
        ...(startWindow ? { start_window_minutes: Number(startWindow) } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["backup-jobs", instanceId] })
      onClose()
      reset()
      toast.success("Backup job started")
    },
    onError: () => toast.error("Failed to start backup job"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Start Backup Job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Vault</Label>
            <Select value={vaultName} onValueChange={(v) => v && setVaultName(v)}>
              <SelectTrigger><SelectValue placeholder="Select vault" /></SelectTrigger>
              <SelectContent>
                {vaults.map((v) => (
                  <SelectItem key={v.backup_vault_name} value={v.backup_vault_name}>{v.backup_vault_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Resource ARN</Label>
            <Input value={resourceArn} onChange={(e) => setResourceArn(e.target.value)} placeholder="arn:aws:ec2:..." />
          </div>
          <div className="space-y-1">
            <Label>IAM Role ARN</Label>
            <Input value={iamRoleArn} onChange={(e) => setIamRoleArn(e.target.value)} placeholder="arn:aws:iam::..." />
          </div>
          <div className="space-y-1">
            <Label>Start Window (minutes, optional)</Label>
            <Input type="number" value={startWindow} onChange={(e) => setStartWindow(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => startMutation.mutate()}
            disabled={!vaultName || !resourceArn || !iamRoleArn || startMutation.isPending}
          >
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Recovery Points Tab ────────────────────────────────────────────────────────

function RecoveryPointsTab() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const { data: vaults = [] } = useQuery({
    queryKey: ["backup-vaults", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listBackupVaults(instanceId)
      return r.data as Vault[]
    },
  })

  const [vaultName, setVaultName] = useState("")

  const { data: points = [], isLoading, refetch } = useQuery({
    queryKey: ["backup-recovery-points", instanceId, vaultName],
    queryFn: async () => {
      const r = await instancesApi.listRecoveryPoints(instanceId, vaultName)
      return r.data as RecoveryPoint[]
    },
    enabled: !!vaultName,
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <Select value={vaultName} onValueChange={(v) => v && setVaultName(v)}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select a vault" /></SelectTrigger>
          <SelectContent>
            {vaults.map((v) => (
              <SelectItem key={v.backup_vault_name} value={v.backup_vault_name}>{v.backup_vault_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={!vaultName}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {!vaultName ? (
          <div className="text-center text-muted-foreground h-24 flex items-center justify-center text-sm">
            Select a vault to view recovery points
          </div>
        ) : isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ARN</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground h-24">No recovery points found</TableCell>
                </TableRow>
              ) : points.map((p) => (
                <TableRow key={p.recovery_point_arn}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{truncateMid(p.recovery_point_arn)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(p.recovery_point_arn)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{truncateMid(p.resource_arn)}</TableCell>
                  <TableCell className="text-sm">{p.resource_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.creation_date || "—"}</TableCell>
                  <TableCell className="text-sm">{formatBytes(p.backup_size_in_bytes)}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
