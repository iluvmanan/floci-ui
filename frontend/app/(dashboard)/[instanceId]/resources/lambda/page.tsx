"use client"

import { useState, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  RefreshCw,
  Scroll,
  Trash2,
  Upload,
  Settings,
} from "lucide-react"
import { toast } from "sonner"

const RUNTIMES = [
  "nodejs20.x",
  "python3.12",
  "python3.11",
  "java21",
  "go1.x",
  "dotnet8",
  "ruby3.3",
]

interface LambdaFunction {
  name: string
  runtime: string
  memory: number
  timeout: number
  handler: string
  last_modified: string
}

interface FunctionDetail {
  name: string
  arn: string
  runtime: string
  handler: string
  role: string
  description: string
  memory_size: number
  timeout: number
  environment: Record<string, string>
  layers: string[]
  vpc_config: Record<string, unknown>
  dead_letter_config: Record<string, unknown>
  last_modified: string
  code_size: number
  state: string
  state_reason: string
}

interface Alias {
  name: string
  function_version: string
  description: string
}

interface InvokeResult {
  status_code: number
  result: unknown
  log_tail: string
  function_error?: string
}

interface EnvPair {
  key: string
  value: string
}

function EnvEditor({
  pairs,
  onChange,
}: {
  pairs: EnvPair[]
  onChange: (pairs: EnvPair[]) => void
}) {
  return (
    <div className="space-y-1">
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-2">
          <Input
            className="text-xs h-7"
            placeholder="KEY"
            value={p.key}
            onChange={(e) => {
              const next = [...pairs]
              next[i] = { ...next[i], key: e.target.value }
              onChange(next)
            }}
          />
          <Input
            className="text-xs h-7"
            placeholder="value"
            value={p.value}
            onChange={(e) => {
              const next = [...pairs]
              next[i] = { ...next[i], value: e.target.value }
              onChange(next)
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => onChange(pairs.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7"
        onClick={() => onChange([...pairs, { key: "", value: "" }])}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add variable
      </Button>
    </div>
  )
}

function envToRecord(pairs: EnvPair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter((p) => p.key).map((p) => [p.key, p.value]))
}

function recordToEnv(rec: Record<string, string>): EnvPair[] {
  return Object.entries(rec).map(([key, value]) => ({ key, value }))
}

function useFileToBase64() {
  return useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip data URL prefix "data:...;base64,"
        const b64 = result.split(",")[1]
        resolve(b64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])
}

export default function LambdaPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)
  const toBase64 = useFileToBase64()

  // Expanded row for detail panel
  const [expandedFn, setExpandedFn] = useState<string | null>(null)

  // Dialog states
  const [invokeOpen, setInvokeOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editConfigOpen, setEditConfigOpen] = useState(false)
  const [updateCodeOpen, setUpdateCodeOpen] = useState(false)
  const [createAliasOpen, setCreateAliasOpen] = useState(false)

  const [selectedFn, setSelectedFn] = useState<string | null>(null)
  const [payload, setPayload] = useState("{}")
  const [payloadError, setPayloadError] = useState("")
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Create function form
  const [createForm, setCreateForm] = useState({
    function_name: "",
    runtime: "python3.12",
    handler: "index.handler",
    role: "arn:aws:iam::000000000000:role/lambda-role",
    memory_size: "128",
    timeout: "3",
    description: "",
  })
  const [createEnv, setCreateEnv] = useState<EnvPair[]>([])
  const [createZipFile, setCreateZipFile] = useState<File | null>(null)
  const createFileRef = useRef<HTMLInputElement>(null)

  // Edit config form
  const [editForm, setEditForm] = useState({
    handler: "",
    memory_size: "",
    timeout: "",
    description: "",
  })
  const [editEnv, setEditEnv] = useState<EnvPair[]>([])

  // Update code
  const [updateCodeFile, setUpdateCodeFile] = useState<File | null>(null)
  const updateCodeFileRef = useRef<HTMLInputElement>(null)

  // Create alias form
  const [aliasForm, setAliasForm] = useState({
    name: "",
    function_version: "$LATEST",
    description: "",
  })

  const { data: fns = [], isLoading, refetch } = useQuery({
    queryKey: ["lambda-functions", instanceId],
    queryFn: () => instancesApi.listFunctions(instanceId).then((r) => r.data as LambdaFunction[]),
  })

  const { data: fnDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["lambda-function-detail", instanceId, expandedFn],
    queryFn: () =>
      instancesApi.getFunction(instanceId, expandedFn!).then((r) => r.data as FunctionDetail),
    enabled: !!expandedFn,
  })

  const { data: aliases = [], isLoading: aliasesLoading } = useQuery({
    queryKey: ["lambda-aliases", instanceId, expandedFn],
    queryFn: () =>
      instancesApi.listAliases(instanceId, expandedFn!).then((r) => r.data as Alias[]),
    enabled: !!expandedFn,
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteFunction(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["lambda-functions", instanceId] })
      if (expandedFn === name) setExpandedFn(null)
      toast.success(`Function "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete function"),
  })

  const invokeMutation = useMutation({
    mutationFn: () => instancesApi.invokeFunction(instanceId, selectedFn!, JSON.parse(payload)),
    onSuccess: (r) => setInvokeResult(r.data as InvokeResult),
    onError: () => toast.error("Invoke failed"),
  })

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      instancesApi.createFunction(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lambda-functions", instanceId] })
      setCreateOpen(false)
      resetCreateForm()
      toast.success("Function created")
    },
    onError: () => toast.error("Failed to create function"),
  })

  const updateCodeMutation = useMutation({
    mutationFn: async ({ name, zip_base64 }: { name: string; zip_base64: string }) =>
      instancesApi.updateFunctionCode(instanceId, name, zip_base64),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lambda-function-detail", instanceId, expandedFn] })
      setUpdateCodeOpen(false)
      setUpdateCodeFile(null)
      toast.success("Function code updated")
    },
    onError: () => toast.error("Failed to update code"),
  })

  const updateConfigMutation = useMutation({
    mutationFn: async ({ name, body }: { name: string; body: Record<string, unknown> }) =>
      instancesApi.updateFunctionConfig(instanceId, name, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lambda-function-detail", instanceId, expandedFn] })
      setEditConfigOpen(false)
      toast.success("Function config updated")
    },
    onError: () => toast.error("Failed to update config"),
  })

  const createAliasMutation = useMutation({
    mutationFn: async (body: { name: string; function_version: string; description?: string }) =>
      instancesApi.createAlias(instanceId, expandedFn!, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lambda-aliases", instanceId, expandedFn] })
      setCreateAliasOpen(false)
      setAliasForm({ name: "", function_version: "$LATEST", description: "" })
      toast.success("Alias created")
    },
    onError: () => toast.error("Failed to create alias"),
  })

  function resetCreateForm() {
    setCreateForm({
      function_name: "",
      runtime: "python3.12",
      handler: "index.handler",
      role: "arn:aws:iam::000000000000:role/lambda-role",
      memory_size: "128",
      timeout: "3",
      description: "",
    })
    setCreateEnv([])
    setCreateZipFile(null)
    if (createFileRef.current) createFileRef.current.value = ""
  }

  async function handleCreate() {
    if (!createZipFile) {
      toast.error("Please select a ZIP file")
      return
    }
    const zip_b64 = await toBase64(createZipFile)
    const body: Record<string, unknown> = {
      function_name: createForm.function_name,
      runtime: createForm.runtime,
      handler: createForm.handler,
      role: createForm.role,
      code_zip_base64: zip_b64,
    }
    if (createForm.description) body.description = createForm.description
    if (createForm.memory_size) body.memory_size = parseInt(createForm.memory_size, 10)
    if (createForm.timeout) body.timeout = parseInt(createForm.timeout, 10)
    const envRecord = envToRecord(createEnv)
    if (Object.keys(envRecord).length > 0) body.env_vars = envRecord
    createMutation.mutate(body)
  }

  async function handleUpdateCode() {
    if (!updateCodeFile || !expandedFn) return
    const zip_base64 = await toBase64(updateCodeFile)
    updateCodeMutation.mutate({ name: expandedFn, zip_base64 })
  }

  function handleSaveConfig() {
    if (!expandedFn) return
    const body: Record<string, unknown> = {}
    if (editForm.handler) body.handler = editForm.handler
    if (editForm.memory_size) body.memory_size = parseInt(editForm.memory_size, 10)
    if (editForm.timeout) body.timeout = parseInt(editForm.timeout, 10)
    body.description = editForm.description
    body.environment = envToRecord(editEnv)
    updateConfigMutation.mutate({ name: expandedFn, body })
  }

  function openEditConfig(detail: FunctionDetail) {
    setEditForm({
      handler: detail.handler,
      memory_size: String(detail.memory_size),
      timeout: String(detail.timeout),
      description: detail.description,
    })
    setEditEnv(recordToEnv(detail.environment))
    setEditConfigOpen(true)
  }

  async function openLogs(name: string) {
    setSelectedFn(name)
    setLogsOpen(true)
    setLogsLoading(true)
    try {
      const r = await instancesApi.getFunctionLogs(instanceId, name)
      setLogs((r.data as { lines: string[] }).lines)
    } catch {
      toast.error("Failed to load logs")
    } finally {
      setLogsLoading(false)
    }
  }

  function openInvoke(name: string) {
    setSelectedFn(name)
    setInvokeResult(null)
    setPayload("{}")
    setInvokeOpen(true)
  }

  function toggleExpand(name: string) {
    setExpandedFn((prev) => (prev === name ? null : name))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Lambda Functions</h2>
        <div className="flex gap-2">
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Function
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : fns.length === 0 ? (
        <div className="border rounded-lg flex items-center justify-center h-48 text-sm text-muted-foreground">
          No Lambda functions found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-6" />
                <TableHead>Function</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead className="w-24">Memory</TableHead>
                <TableHead className="w-24">Timeout</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fns.map((fn) => (
                <>
                  <TableRow key={fn.name} className="cursor-pointer hover:bg-muted/40">
                    <TableCell
                      className="px-2"
                      onClick={() => toggleExpand(fn.name)}
                    >
                      {expandedFn === fn.name ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell
                      className="font-mono text-sm"
                      onClick={() => toggleExpand(fn.name)}
                    >
                      {fn.name}
                    </TableCell>
                    <TableCell onClick={() => toggleExpand(fn.name)}>
                      <Badge variant="secondary" className="text-xs">{fn.runtime || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => toggleExpand(fn.name)}>
                      {fn.memory} MB
                    </TableCell>
                    <TableCell className="text-sm" onClick={() => toggleExpand(fn.name)}>
                      {fn.timeout}s
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openLogs(fn.name)}
                          title="Logs"
                        >
                          <Scroll className="h-3.5 w-3.5" />
                        </Button>
                        {canMutate && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openInvoke(fn.name)}
                              title="Invoke"
                            >
                              <Play className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => deleteMutation.mutate(fn.name)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>

                  {expandedFn === fn.name && (
                    <TableRow key={`${fn.name}-detail`}>
                      <TableCell colSpan={6} className="bg-muted/20 p-0">
                        <div className="p-4">
                          {detailLoading ? (
                            <div className="space-y-2">
                              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-4" />)}
                            </div>
                          ) : fnDetail ? (
                            <FunctionDetailPanel
                              detail={fnDetail}
                              aliases={aliases}
                              aliasesLoading={aliasesLoading}
                              canMutate={!!canMutate}
                              onEditConfig={() => openEditConfig(fnDetail)}
                              onUpdateCode={() => {
                                setUpdateCodeFile(null)
                                if (updateCodeFileRef.current) updateCodeFileRef.current.value = ""
                                setUpdateCodeOpen(true)
                              }}
                              onCreateAlias={() => {
                                setAliasForm({ name: "", function_version: "$LATEST", description: "" })
                                setCreateAliasOpen(true)
                              }}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create Function dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Lambda Function</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Function name *</label>
                <Input
                  className="mt-1 text-sm"
                  value={createForm.function_name}
                  onChange={(e) => setCreateForm({ ...createForm, function_name: e.target.value })}
                  placeholder="my-function"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Runtime</label>
                <Select
                  value={createForm.runtime}
                  onValueChange={(v) => v && setCreateForm({ ...createForm, runtime: v })}
                >
                  <SelectTrigger className="mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RUNTIMES.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Handler</label>
              <Input
                className="mt-1 text-sm"
                value={createForm.handler}
                onChange={(e) => setCreateForm({ ...createForm, handler: e.target.value })}
                placeholder="index.handler"
              />
            </div>

            <div>
              <label className="text-xs font-medium">Role ARN</label>
              <Input
                className="mt-1 text-sm"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                placeholder="arn:aws:iam::123456789012:role/lambda-role"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Memory (MB)</label>
                <Input
                  className="mt-1 text-sm"
                  type="number"
                  value={createForm.memory_size}
                  onChange={(e) => setCreateForm({ ...createForm, memory_size: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Timeout (s)</label>
                <Input
                  className="mt-1 text-sm"
                  type="number"
                  value={createForm.timeout}
                  onChange={(e) => setCreateForm({ ...createForm, timeout: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">Description (optional)</label>
              <Input
                className="mt-1 text-sm"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-medium">Environment Variables</label>
              <div className="mt-1">
                <EnvEditor pairs={createEnv} onChange={setCreateEnv} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium">ZIP file *</label>
              <input
                ref={createFileRef}
                type="file"
                accept=".zip"
                className="mt-1 block text-sm text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-xs file:font-medium cursor-pointer"
                onChange={(e) => setCreateZipFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm() }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !createForm.function_name || !createZipFile}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Config dialog ── */}
      <Dialog open={editConfigOpen} onOpenChange={setEditConfigOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Config — {expandedFn}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Handler</label>
              <Input
                className="mt-1 text-sm"
                value={editForm.handler}
                onChange={(e) => setEditForm({ ...editForm, handler: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Memory (MB)</label>
                <Input
                  className="mt-1 text-sm"
                  type="number"
                  value={editForm.memory_size}
                  onChange={(e) => setEditForm({ ...editForm, memory_size: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium">Timeout (s)</label>
                <Input
                  className="mt-1 text-sm"
                  type="number"
                  value={editForm.timeout}
                  onChange={(e) => setEditForm({ ...editForm, timeout: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Input
                className="mt-1 text-sm"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Environment Variables</label>
              <div className="mt-1">
                <EnvEditor pairs={editEnv} onChange={setEditEnv} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConfigOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={updateConfigMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Update Code dialog ── */}
      <Dialog open={updateCodeOpen} onOpenChange={setUpdateCodeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Code — {expandedFn}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-xs font-medium">ZIP file</label>
            <input
              ref={updateCodeFileRef}
              type="file"
              accept=".zip"
              className="mt-1 block text-sm text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border file:text-xs file:font-medium cursor-pointer"
              onChange={(e) => setUpdateCodeFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateCodeOpen(false)}>Cancel</Button>
            <Button
              onClick={handleUpdateCode}
              disabled={updateCodeMutation.isPending || !updateCodeFile}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Alias dialog ── */}
      <Dialog open={createAliasOpen} onOpenChange={setCreateAliasOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Alias — {expandedFn}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Alias name *</label>
              <Input
                className="mt-1 text-sm"
                value={aliasForm.name}
                onChange={(e) => setAliasForm({ ...aliasForm, name: e.target.value })}
                placeholder="live"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Function version</label>
              <Input
                className="mt-1 text-sm"
                value={aliasForm.function_version}
                onChange={(e) => setAliasForm({ ...aliasForm, function_version: e.target.value })}
                placeholder="$LATEST or 1"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Description (optional)</label>
              <Input
                className="mt-1 text-sm"
                value={aliasForm.description}
                onChange={(e) => setAliasForm({ ...aliasForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAliasOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                createAliasMutation.mutate({
                  name: aliasForm.name,
                  function_version: aliasForm.function_version,
                  description: aliasForm.description || undefined,
                })
              }
              disabled={createAliasMutation.isPending || !aliasForm.name}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invoke dialog ── */}
      <Dialog open={invokeOpen} onOpenChange={setInvokeOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoke — {selectedFn}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Payload (JSON)</label>
              <Textarea
                className="font-mono text-xs h-32 mt-1"
                value={payload}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setPayload(e.target.value)
                  try {
                    JSON.parse(e.target.value)
                    setPayloadError("")
                  } catch {
                    setPayloadError("Invalid JSON")
                  }
                }}
              />
              {payloadError && <p className="text-xs text-destructive mt-1">{payloadError}</p>}
            </div>
            {invokeResult && (
              <div className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge
                    variant={invokeResult.status_code === 200 ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {invokeResult.status_code}
                  </Badge>
                  {invokeResult.function_error && (
                    <Badge variant="destructive" className="text-xs">
                      {invokeResult.function_error}
                    </Badge>
                  )}
                </div>
                <pre className="text-xs font-mono overflow-auto max-h-48">
                  {JSON.stringify(invokeResult.result, null, 2)}
                </pre>
                {invokeResult.log_tail && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Log tail</summary>
                    <pre className="text-xs font-mono mt-1 text-muted-foreground whitespace-pre-wrap">
                      {invokeResult.log_tail}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvokeOpen(false)}>Close</Button>
            <Button
              onClick={() => invokeMutation.mutate()}
              disabled={!!payloadError || invokeMutation.isPending}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Invoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Logs dialog ── */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Logs — {selectedFn}</DialogTitle>
          </DialogHeader>
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-4" />)}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No logs available</p>
          ) : (
            <div className="border rounded-md bg-black/90 p-3 max-h-80 overflow-auto">
              {logs.map((line, i) => (
                <div key={i} className="text-xs font-mono text-green-400 leading-5">{line}</div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FunctionDetailPanel({
  detail,
  aliases,
  aliasesLoading,
  canMutate,
  onEditConfig,
  onUpdateCode,
  onCreateAlias,
}: {
  detail: FunctionDetail
  aliases: Alias[]
  aliasesLoading: boolean
  canMutate: boolean
  onEditConfig: () => void
  onUpdateCode: () => void
  onCreateAlias: () => void
}) {
  const hasVpc =
    detail.vpc_config &&
    (
      (Array.isArray((detail.vpc_config as Record<string, unknown>).SubnetIds) &&
        ((detail.vpc_config as Record<string, unknown>).SubnetIds as unknown[]).length > 0) ||
      (Array.isArray((detail.vpc_config as Record<string, unknown>).SecurityGroupIds) &&
        ((detail.vpc_config as Record<string, unknown>).SecurityGroupIds as unknown[]).length > 0)
    )

  return (
    <Tabs defaultValue="details" className="w-full">
      <div className="flex items-center justify-between mb-3">
        <TabsList className="h-7 text-xs">
          <TabsTrigger value="details" className="text-xs px-3 h-6">Details</TabsTrigger>
          <TabsTrigger value="aliases" className="text-xs px-3 h-6">Aliases</TabsTrigger>
        </TabsList>
        {canMutate && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onEditConfig}>
              <Settings className="h-3 w-3 mr-1" />
              Edit Config
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onUpdateCode}>
              <Upload className="h-3 w-3 mr-1" />
              Update Code
            </Button>
          </div>
        )}
      </div>

      <TabsContent value="details" className="mt-0 space-y-4">
        {/* Core info */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <InfoRow label="ARN" value={detail.arn} mono />
          <InfoRow label="Role" value={detail.role} mono />
          <InfoRow label="Handler" value={detail.handler} mono />
          <InfoRow label="Runtime" value={detail.runtime} />
          <InfoRow label="Memory" value={`${detail.memory_size} MB`} />
          <InfoRow label="Timeout" value={`${detail.timeout}s`} />
          <InfoRow label="Code size" value={`${(detail.code_size / 1024).toFixed(1)} KB`} />
          <InfoRow label="Last modified" value={detail.last_modified} />
          {detail.description && <InfoRow label="Description" value={detail.description} />}
          {detail.state && (
            <InfoRow
              label="State"
              value={
                <Badge variant={detail.state === "Active" ? "default" : "secondary"} className="text-xs">
                  {detail.state}
                </Badge>
              }
            />
          )}
        </div>

        {/* Environment variables */}
        {Object.keys(detail.environment).length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Environment Variables
            </p>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs h-7 py-1">Key</TableHead>
                    <TableHead className="text-xs h-7 py-1">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(detail.environment).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="text-xs font-mono py-1">{k}</TableCell>
                      <TableCell className="text-xs font-mono py-1">{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* VPC config */}
        {hasVpc && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              VPC Config
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {Array.isArray((detail.vpc_config as Record<string, unknown>).SubnetIds) && (
                <div>
                  <span className="text-xs text-muted-foreground">Subnet IDs</span>
                  <div className="font-mono text-xs mt-0.5">
                    {((detail.vpc_config as Record<string, unknown>).SubnetIds as string[]).join(", ")}
                  </div>
                </div>
              )}
              {Array.isArray((detail.vpc_config as Record<string, unknown>).SecurityGroupIds) && (
                <div>
                  <span className="text-xs text-muted-foreground">Security Groups</span>
                  <div className="font-mono text-xs mt-0.5">
                    {((detail.vpc_config as Record<string, unknown>).SecurityGroupIds as string[]).join(", ")}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </TabsContent>

      <TabsContent value="aliases" className="mt-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">
            {aliasesLoading ? "Loading…" : `${aliases.length} alias${aliases.length !== 1 ? "es" : ""}`}
          </p>
          {canMutate && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onCreateAlias}>
              <Plus className="h-3 w-3 mr-1" />
              Create Alias
            </Button>
          )}
        </div>
        {aliasesLoading ? (
          <div className="space-y-1">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-6" />)}
          </div>
        ) : aliases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No aliases</p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-7 py-1">Name</TableHead>
                  <TableHead className="text-xs h-7 py-1">Version</TableHead>
                  <TableHead className="text-xs h-7 py-1">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="text-xs font-mono py-1">{a.name}</TableCell>
                    <TableCell className="text-xs font-mono py-1">{a.function_version}</TableCell>
                    <TableCell className="text-xs py-1 text-muted-foreground">{a.description || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={`mt-0.5 text-xs ${mono ? "font-mono break-all" : ""}`}>{value}</div>
    </div>
  )
}
