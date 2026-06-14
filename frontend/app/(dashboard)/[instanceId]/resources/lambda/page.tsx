"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Play, RefreshCw, Scroll, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface LambdaFunction {
  name: string
  runtime: string
  memory: number
  timeout: number
  handler: string
  last_modified: string
}

interface InvokeResult {
  status_code: number
  result: unknown
  log_tail: string
  function_error?: string
}

export default function LambdaPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [invokeOpen, setInvokeOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [selectedFn, setSelectedFn] = useState<string | null>(null)
  const [payload, setPayload] = useState("{}")
  const [payloadError, setPayloadError] = useState("")
  const [invokeResult, setInvokeResult] = useState<InvokeResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const { data: fns = [], isLoading, refetch } = useQuery({
    queryKey: ["lambda-functions", instanceId],
    queryFn: () => instancesApi.listFunctions(instanceId).then((r) => r.data as LambdaFunction[]),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteFunction(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["lambda-functions", instanceId] })
      toast.success(`Function "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete function"),
  })

  const invokeMutation = useMutation({
    mutationFn: () => instancesApi.invokeFunction(instanceId, selectedFn!, JSON.parse(payload)),
    onSuccess: (r) => setInvokeResult(r.data as InvokeResult),
    onError: () => toast.error("Invoke failed"),
  })

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Lambda Functions</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
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
                <TableHead>Function</TableHead>
                <TableHead>Runtime</TableHead>
                <TableHead className="w-24">Memory</TableHead>
                <TableHead className="w-24">Timeout</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fns.map((fn) => (
                <TableRow key={fn.name}>
                  <TableCell className="font-mono text-sm">{fn.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{fn.runtime || "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{fn.memory} MB</TableCell>
                  <TableCell className="text-sm">{fn.timeout}s</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLogs(fn.name)} title="Logs">
                        <Scroll className="h-3.5 w-3.5" />
                      </Button>
                      {canMutate && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openInvoke(fn.name)} title="Invoke">
                            <Play className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(fn.name)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invoke dialog */}
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
                  try { JSON.parse(e.target.value); setPayloadError("") } catch { setPayloadError("Invalid JSON") }
                }}
              />
              {payloadError && <p className="text-xs text-destructive mt-1">{payloadError}</p>}
            </div>
            {invokeResult && (
              <div className="border rounded-md p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={invokeResult.status_code === 200 ? "default" : "destructive"} className="text-xs">
                    {invokeResult.status_code}
                  </Badge>
                  {invokeResult.function_error && (
                    <Badge variant="destructive" className="text-xs">{invokeResult.function_error}</Badge>
                  )}
                </div>
                <pre className="text-xs font-mono overflow-auto max-h-48">
                  {JSON.stringify(invokeResult.result, null, 2)}
                </pre>
                {invokeResult.log_tail && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Log tail</summary>
                    <pre className="text-xs font-mono mt-1 text-muted-foreground whitespace-pre-wrap">{invokeResult.log_tail}</pre>
                  </details>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvokeOpen(false)}>Close</Button>
            <Button onClick={() => invokeMutation.mutate()} disabled={!!payloadError || invokeMutation.isPending}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Invoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs dialog */}
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
