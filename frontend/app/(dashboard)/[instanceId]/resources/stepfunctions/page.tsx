"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy, Plus, RefreshCw, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface StateMachine {
  state_machine_arn: string
  name: string
  type: string
  status: string
  creation_date: string
  role_arn: string
}

interface StateMachineDetail extends StateMachine {
  definition: string
}

interface Execution {
  execution_arn: string
  name: string
  status: string
  start_date: string
  stop_date: string | null
}

interface ExecutionDetail extends Execution {
  input: string | null
  output: string | null
  state_machine_arn: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied to clipboard")
}

function truncateArn(arn: string) {
  if (arn.length <= 50) return arn
  return `${arn.slice(0, 24)}…${arn.slice(-20)}`
}

function typeBadge(type: string) {
  const color =
    type === "EXPRESS"
      ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{type}</span>
}

function executionStatusBadge(status: string) {
  let color = "bg-gray-100 text-gray-600"
  if (status === "SUCCEEDED") color = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  else if (status === "RUNNING") color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  else if (["FAILED", "TIMED_OUT", "ABORTED"].includes(status)) color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{status}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StepFunctionsPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: machines = [], isLoading, refetch } = useQuery({
    queryKey: ["sfn-machines", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listStateMachines(instanceId)
      return r.data as StateMachine[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteStateMachine(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sfn-machines", instanceId] })
      setDeleteTarget(null)
      if (selected === deleteTarget) setSelected(null)
      toast.success("State machine deleted")
    },
    onError: () => toast.error("Failed to delete state machine"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Step Functions</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create State Machine
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
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>ARN</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">No state machines found</TableCell>
                </TableRow>
              ) : machines.map((m) => (
                <TableRow key={m.state_machine_arn} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelected(m.state_machine_arn)}>
                  <TableCell className="font-medium text-sm">{m.name}</TableCell>
                  <TableCell>{typeBadge(m.type)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-muted-foreground">{truncateArn(m.state_machine_arn)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(m.state_machine_arn)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.creation_date ? new Date(m.creation_date).toLocaleString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setEditTarget(m.state_machine_arn)}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget(m.state_machine_arn)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selected && (
        <StateMachineDetailPanel instanceId={instanceId} arn={selected} onClose={() => setSelected(null)} />
      )}

      <CreateStateMachineDialog
        open={createOpen}
        instanceId={instanceId}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["sfn-machines", instanceId] })
          setCreateOpen(false)
        }}
      />

      <EditDefinitionDialog
        arn={editTarget}
        instanceId={instanceId}
        onClose={() => setEditTarget(null)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["sfn-machines", instanceId] })
          if (editTarget) qc.invalidateQueries({ queryKey: ["sfn-machine-detail", instanceId, editTarget] })
          setEditTarget(null)
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete State Machine</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this state machine? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create State Machine Dialog ──────────────────────────────────────────────

function CreateStateMachineDialog({
  open,
  instanceId,
  onClose,
  onSuccess,
}: {
  open: boolean
  instanceId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [type, setType] = useState<"STANDARD" | "EXPRESS">("STANDARD")
  const [roleArn, setRoleArn] = useState("")
  const [definition, setDefinition] = useState("")
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setType("STANDARD")
      setRoleArn("")
      setDefinition("")
    }
  }, [open])

  async function handleSubmit() {
    try {
      JSON.parse(definition)
    } catch {
      toast.error("Definition must be valid JSON")
      return
    }
    setIsPending(true)
    try {
      await instancesApi.createStateMachine(instanceId, {
        name,
        definition,
        role_arn: roleArn,
        type,
      })
      toast.success("State machine created")
      onSuccess()
    } catch {
      toast.error("Failed to create state machine")
    } finally {
      setIsPending(false)
    }
  }

  const canSubmit = !!name && !!roleArn && !!definition

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Create State Machine</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-state-machine" />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="sfn-type" checked={type === "STANDARD"} onChange={() => setType("STANDARD")} />
                Standard
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="sfn-type" checked={type === "EXPRESS"} onChange={() => setType("EXPRESS")} />
                Express
              </label>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Execution Role ARN</Label>
            <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} placeholder="arn:aws:iam::123456789012:role/StepFunctionsRole" className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Definition (Amazon States Language JSON)</Label>
            <Textarea
              className="font-mono text-xs min-h-64"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder={'{\n  "Comment": "A simple state machine",\n  "StartAt": "HelloWorld",\n  "States": {\n    "HelloWorld": {\n      "Type": "Pass",\n      "End": true\n    }\n  }\n}'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Edit Definition Dialog ───────────────────────────────────────────────────

function EditDefinitionDialog({
  arn,
  instanceId,
  onClose,
  onSuccess,
}: {
  arn: string | null
  instanceId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [definition, setDefinition] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [isPending, setIsPending] = useState(false)

  const { data: detail } = useQuery({
    queryKey: ["sfn-machine-edit", instanceId, arn],
    queryFn: async () => {
      const r = await instancesApi.describeStateMachine(instanceId, arn!)
      return r.data as StateMachineDetail
    },
    enabled: !!arn,
  })

  useEffect(() => {
    if (detail) {
      setDefinition(detail.definition)
      setRoleArn(detail.role_arn)
    }
  }, [detail])

  async function handleSubmit() {
    try {
      JSON.parse(definition)
    } catch {
      toast.error("Definition must be valid JSON")
      return
    }
    setIsPending(true)
    try {
      await instancesApi.updateStateMachine(instanceId, arn!, {
        definition,
        role_arn: roleArn,
      })
      toast.success("State machine updated")
      onSuccess()
    } catch {
      toast.error("Failed to update state machine")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!arn} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Edit Definition</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Execution Role ARN</Label>
            <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Definition (Amazon States Language JSON)</Label>
            <Textarea className="font-mono text-xs min-h-64" value={definition} onChange={(e) => setDefinition(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── State Machine Detail Panel ───────────────────────────────────────────────

function StateMachineDetailPanel({ instanceId, arn, onClose }: { instanceId: string; arn: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [startOpen, setStartOpen] = useState(false)
  const [viewExecution, setViewExecution] = useState<string | null>(null)

  const { data: detail, isLoading } = useQuery({
    queryKey: ["sfn-machine-detail", instanceId, arn],
    queryFn: async () => {
      const r = await instancesApi.describeStateMachine(instanceId, arn)
      return r.data as StateMachineDetail
    },
  })

  const { data: executions = [], isLoading: executionsLoading, refetch: refetchExecutions } = useQuery({
    queryKey: ["sfn-executions", instanceId, arn],
    queryFn: async () => {
      const r = await instancesApi.listExecutions(instanceId, arn)
      return r.data as Execution[]
    },
  })

  const stopMutation = useMutation({
    mutationFn: (execArn: string) => instancesApi.stopExecution(instanceId, execArn, {}),
    onSuccess: () => {
      refetchExecutions()
      toast.success("Execution stop requested")
    },
    onError: () => toast.error("Failed to stop execution"),
  })

  let prettyDefinition = detail?.definition ?? ""
  try {
    if (detail?.definition) prettyDefinition = JSON.stringify(JSON.parse(detail.definition), null, 2)
  } catch {
    // leave as-is if not parseable
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{detail?.name ?? "Loading…"}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <Tabs defaultValue="definition">
        <TabsList>
          <TabsTrigger value="definition">Definition</TabsTrigger>
          <TabsTrigger value="executions">Executions</TabsTrigger>
        </TabsList>

        <TabsContent value="definition" className="pt-3">
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <pre className="text-xs bg-muted rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap font-mono">
              {prettyDefinition}
            </pre>
          )}
        </TabsContent>

        <TabsContent value="executions" className="pt-3 space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setStartOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Start Execution
            </Button>
          </div>
          {executionsLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Started</TableHead>
                  <TableHead className="text-xs">Stopped</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {executions.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm h-16">No executions</TableCell></TableRow>
                ) : executions.map((e) => (
                  <TableRow key={e.execution_arn} className="cursor-pointer hover:bg-accent/40" onClick={() => setViewExecution(e.execution_arn)}>
                    <TableCell className="text-xs font-mono">{e.name}</TableCell>
                    <TableCell>{executionStatusBadge(e.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.start_date ? new Date(e.start_date).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.stop_date ? new Date(e.stop_date).toLocaleString() : "—"}</TableCell>
                    <TableCell onClick={(ev) => ev.stopPropagation()}>
                      {e.status === "RUNNING" && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => stopMutation.mutate(e.execution_arn)}>
                          <Square className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <StartExecutionDialog
        open={startOpen}
        instanceId={instanceId}
        arn={arn}
        onClose={() => setStartOpen(false)}
        onSuccess={() => {
          refetchExecutions()
          setStartOpen(false)
        }}
      />

      <ExecutionViewDialog
        instanceId={instanceId}
        executionArn={viewExecution}
        onClose={() => setViewExecution(null)}
      />
    </div>
  )
}

// ─── Start Execution Dialog ───────────────────────────────────────────────────

function StartExecutionDialog({
  open,
  instanceId,
  arn,
  onClose,
  onSuccess,
}: {
  open: boolean
  instanceId: string
  arn: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [input, setInput] = useState("{}")
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setInput("{}")
    }
  }, [open])

  async function handleSubmit() {
    try {
      JSON.parse(input)
    } catch {
      toast.error("Input must be valid JSON")
      return
    }
    setIsPending(true)
    try {
      await instancesApi.startExecution(instanceId, arn, {
        name: name || undefined,
        input,
      })
      toast.success("Execution started")
      onSuccess()
    } catch {
      toast.error("Failed to start execution")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Start Execution</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Execution Name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="auto-generated if blank" />
          </div>
          <div className="space-y-1">
            <Label>Input (JSON)</Label>
            <Textarea className="font-mono text-xs min-h-32" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Starting…" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Execution View Dialog ────────────────────────────────────────────────────

function ExecutionViewDialog({
  instanceId,
  executionArn,
  onClose,
}: {
  instanceId: string
  executionArn: string | null
  onClose: () => void
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["sfn-execution-detail", instanceId, executionArn],
    queryFn: async () => {
      const r = await instancesApi.describeExecution(instanceId, executionArn!)
      return r.data as ExecutionDetail
    },
    enabled: !!executionArn,
  })

  function pretty(s: string | null) {
    if (!s) return "—"
    try {
      return JSON.stringify(JSON.parse(s), null, 2)
    } catch {
      return s
    }
  }

  return (
    <Dialog open={!!executionArn} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Execution: {detail?.name ?? ""}</DialogTitle></DialogHeader>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {detail && executionStatusBadge(detail.status)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Input</p>
                <pre className="text-xs bg-muted rounded-md p-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono">{pretty(detail?.input ?? null)}</pre>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Output</p>
                <pre className="text-xs bg-muted rounded-md p-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono">{pretty(detail?.output ?? null)}</pre>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
