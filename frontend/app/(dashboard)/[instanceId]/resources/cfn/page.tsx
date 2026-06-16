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
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stack {
  stack_name: string
  stack_id: string
  stack_status: string
  creation_time: string
  last_updated_time: string
  description: string | null
  outputs: { OutputKey: string; OutputValue: string; ExportName?: string }[]
  parameters: { ParameterKey: string; ParameterValue: string }[]
  tags: { Key: string; Value: string }[]
}

interface StackEvent {
  event_id: string
  resource_type: string
  logical_resource_id: string
  physical_resource_id: string
  resource_status: string
  resource_status_reason: string | null
  timestamp: string
}

interface StackResource {
  logical_resource_id: string
  physical_resource_id: string
  resource_type: string
  resource_status: string
  last_updated_timestamp: string
}

interface ParamRow {
  key: string
  value: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  let color = "bg-gray-100 text-gray-600"
  if (status.includes("ROLLBACK")) {
    color = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
  } else if (status.includes("FAILED")) {
    color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  } else if (status.includes("IN_PROGRESS")) {
    color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  } else if (status.includes("COMPLETE")) {
    color = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  )
}

const CAPABILITIES = ["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"]

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CloudFormationPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [updateTarget, setUpdateTarget] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const { data: stacks = [], isLoading, refetch } = useQuery({
    queryKey: ["cfn-stacks", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listStacks(instanceId)
      return r.data as Stack[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteStack(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cfn-stacks", instanceId] })
      setDeleteTarget(null)
      setDeleteConfirmName("")
      if (selected === deleteTarget) setSelected(null)
      toast.success("Stack deletion initiated")
    },
    onError: () => toast.error("Failed to delete stack"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CloudFormation</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Stack
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
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Description</TableHead>
                {canMutate && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">No stacks found</TableCell>
                </TableRow>
              ) : stacks.map((s) => (
                <TableRow key={s.stack_id} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelected(s.stack_name)}>
                  <TableCell className="font-medium text-sm">{s.stack_name}</TableCell>
                  <TableCell>{statusBadge(s.stack_status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.creation_time ? new Date(s.creation_time).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.last_updated_time ? new Date(s.last_updated_time).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.description || "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setUpdateTarget(s.stack_name)}>
                          Update
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDeleteTarget(s.stack_name)}>
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
        <StackDetailPanel instanceId={instanceId} stackName={selected} onClose={() => setSelected(null)} />
      )}

      <StackFormDialog
        mode="create"
        open={createOpen}
        instanceId={instanceId}
        stackName={null}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["cfn-stacks", instanceId] })
          setCreateOpen(false)
        }}
      />

      <StackFormDialog
        mode="update"
        open={!!updateTarget}
        instanceId={instanceId}
        stackName={updateTarget}
        onClose={() => setUpdateTarget(null)}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["cfn-stacks", instanceId] })
          qc.invalidateQueries({ queryKey: ["cfn-stack-detail", instanceId, updateTarget] })
          setUpdateTarget(null)
        }}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => { setDeleteTarget(null); setDeleteConfirmName("") }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Stack</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{deleteTarget}</span> to confirm deletion.
            </p>
            <Input value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} placeholder={deleteTarget ?? ""} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName("") }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== deleteTarget || deleteMutation.isPending}
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

// ─── Create/Update Stack Dialog ───────────────────────────────────────────────

function StackFormDialog({
  mode,
  open,
  instanceId,
  stackName,
  onClose,
  onSuccess,
}: {
  mode: "create" | "update"
  open: boolean
  instanceId: string
  stackName: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState("")
  const [templateSource, setTemplateSource] = useState<"body" | "url">("body")
  const [templateBody, setTemplateBody] = useState("")
  const [templateUrl, setTemplateUrl] = useState("")
  const [params, setParams] = useState<ParamRow[]>([])
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [isPending, setIsPending] = useState(false)

  const { data: existingTemplate } = useQuery({
    queryKey: ["cfn-stack-template", instanceId, stackName],
    queryFn: async () => {
      const r = await instancesApi.getStackTemplate(instanceId, stackName!)
      return r.data as { template_body: string }
    },
    enabled: mode === "update" && open && !!stackName,
  })

  useEffect(() => {
    if (open) {
      setName(mode === "update" ? stackName ?? "" : "")
      setTemplateSource("body")
      setTemplateUrl("")
      setParams([])
      setCapabilities([])
    } else {
      setTemplateBody("")
    }
  }, [open, mode, stackName])

  useEffect(() => {
    if (mode === "update" && existingTemplate) {
      setTemplateBody(existingTemplate.template_body)
    }
  }, [mode, existingTemplate])

  function toggleCapability(c: string) {
    setCapabilities((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  async function handleSubmit() {
    setIsPending(true)
    try {
      const body: Record<string, unknown> = {}
      if (templateSource === "body" && templateBody) body.template_body = templateBody
      if (templateSource === "url" && templateUrl) body.template_url = templateUrl
      const filteredParams = params.filter((p) => p.key)
      if (filteredParams.length > 0) {
        body.parameters = filteredParams.map((p) => ({ key: p.key, value: p.value }))
      }
      if (capabilities.length > 0) body.capabilities = capabilities

      if (mode === "create") {
        body.stack_name = name
        await instancesApi.createStack(instanceId, body)
        toast.success("Stack creation initiated")
      } else {
        await instancesApi.updateStack(instanceId, stackName!, body)
        toast.success("Stack update initiated")
      }
      onSuccess()
    } catch {
      toast.error(mode === "create" ? "Failed to create stack" : "Failed to update stack")
    } finally {
      setIsPending(false)
    }
  }

  const canSubmit = (mode === "create" ? !!name : true) && (templateSource === "body" ? !!templateBody : !!templateUrl)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Create Stack" : `Update Stack — ${stackName}`}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="template">
          <TabsList>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="options">Options</TabsTrigger>
          </TabsList>

          <TabsContent value="template" className="pt-3 space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="template-source" checked={templateSource === "body"} onChange={() => setTemplateSource("body")} />
                Paste Template
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="template-source" checked={templateSource === "url"} onChange={() => setTemplateSource("url")} />
                S3 URL
              </label>
            </div>
            {templateSource === "body" ? (
              <Textarea
                className="font-mono text-xs min-h-64"
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                placeholder={"AWSTemplateFormatVersion: '2010-09-09'\nResources:\n  ..."}
              />
            ) : (
              <Input value={templateUrl} onChange={(e) => setTemplateUrl(e.target.value)} placeholder="https://s3.amazonaws.com/bucket/template.yaml" />
            )}
          </TabsContent>

          <TabsContent value="parameters" className="pt-3 space-y-2">
            {params.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  placeholder="Key"
                  className="h-7 text-xs"
                  value={p.key}
                  onChange={(e) => {
                    const updated = [...params]
                    updated[i] = { ...updated[i], key: e.target.value }
                    setParams(updated)
                  }}
                />
                <Input
                  placeholder="Value"
                  className="h-7 text-xs"
                  value={p.value}
                  onChange={(e) => {
                    const updated = [...params]
                    updated[i] = { ...updated[i], value: e.target.value }
                    setParams(updated)
                  }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setParams(params.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setParams([...params, { key: "", value: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Parameter
            </Button>
          </TabsContent>

          <TabsContent value="options" className="pt-3 space-y-3">
            {mode === "create" && (
              <div className="space-y-1">
                <Label>Stack Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-stack" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Capabilities</Label>
              <div className="space-y-1">
                {CAPABILITIES.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={capabilities.includes(c)} onChange={() => toggleCapability(c)} className="rounded" />
                    <span className="font-mono text-xs">{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending ? "Submitting…" : mode === "create" ? "Create" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Stack Detail Panel ────────────────────────────────────────────────────────

function StackDetailPanel({ instanceId, stackName, onClose }: { instanceId: string; stackName: string; onClose: () => void }) {
  const { data: stack, isLoading } = useQuery({
    queryKey: ["cfn-stack-detail", instanceId, stackName],
    queryFn: async () => {
      const r = await instancesApi.describeStack(instanceId, stackName)
      return r.data as Stack
    },
  })

  const isInProgress = stack?.stack_status?.includes("IN_PROGRESS") ?? false

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["cfn-stack-events", instanceId, stackName],
    queryFn: async () => {
      const r = await instancesApi.getStackEvents(instanceId, stackName)
      return r.data as StackEvent[]
    },
    refetchInterval: isInProgress ? 3000 : false,
  })

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["cfn-stack-resources", instanceId, stackName],
    queryFn: async () => {
      const r = await instancesApi.getStackResources(instanceId, stackName)
      return r.data as StackResource[]
    },
  })

  const { data: template, isLoading: templateLoading } = useQuery({
    queryKey: ["cfn-stack-template-view", instanceId, stackName],
    queryFn: async () => {
      const r = await instancesApi.getStackTemplate(instanceId, stackName)
      return r.data as { template_body: string }
    },
  })

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{stackName}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="template">Template</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-3 space-y-3">
          {isLoading || !stack ? (
            <Skeleton className="h-32" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Status</span>
                <span>{statusBadge(stack.stack_status)}</span>
                <span className="text-muted-foreground">Description</span>
                <span>{stack.description || "—"}</span>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Parameters</p>
                {stack.parameters?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No parameters</p>
                ) : (
                  <ul className="space-y-1">
                    {stack.parameters?.map((p) => (
                      <li key={p.ParameterKey} className="text-xs font-mono bg-muted/40 rounded px-2 py-1">
                        {p.ParameterKey} = {p.ParameterValue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Outputs</p>
                {stack.outputs?.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No outputs</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Key</TableHead>
                        <TableHead className="text-xs">Value</TableHead>
                        <TableHead className="text-xs">Export Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stack.outputs?.map((o) => (
                        <TableRow key={o.OutputKey}>
                          <TableCell className="text-xs font-mono">{o.OutputKey}</TableCell>
                          <TableCell className="text-xs font-mono truncate max-w-[200px]">{o.OutputValue}</TableCell>
                          <TableCell className="text-xs font-mono">{o.ExportName || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="events" className="pt-3">
          {eventsLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Logical ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm h-16">No events</TableCell></TableRow>
                ) : events.map((e) => (
                  <TableRow key={e.event_id}>
                    <TableCell className="text-xs text-muted-foreground">{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{e.logical_resource_id}</TableCell>
                    <TableCell className="text-xs">{e.resource_type}</TableCell>
                    <TableCell>{statusBadge(e.resource_status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{e.resource_status_reason || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="resources" className="pt-3">
          {resourcesLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Logical ID</TableHead>
                  <TableHead className="text-xs">Physical ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-16">No resources</TableCell></TableRow>
                ) : resources.map((r) => (
                  <TableRow key={r.logical_resource_id}>
                    <TableCell className="text-xs font-mono">{r.logical_resource_id}</TableCell>
                    <TableCell className="text-xs font-mono truncate max-w-[200px]">{r.physical_resource_id}</TableCell>
                    <TableCell className="text-xs">{r.resource_type}</TableCell>
                    <TableCell>{statusBadge(r.resource_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="template" className="pt-3">
          {templateLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <pre className="text-xs bg-muted rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap font-mono">
              {template?.template_body || "No template available"}
            </pre>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
