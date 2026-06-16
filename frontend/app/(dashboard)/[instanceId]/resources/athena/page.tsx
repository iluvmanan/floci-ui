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
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Play, Square, RefreshCw, History, Database } from "lucide-react"
import { toast } from "sonner"

interface Workgroup {
  name: string
  state: string
  description: string
  creation_time: string
}

interface AthenaDatabase {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface QueryExecution {
  status: {
    state: string
    state_change_reason: string
    submission_date_time: string
    completion_date_time: string
  }
  statistics: {
    data_scanned_in_bytes: number
    engine_execution_time_in_millis: number
  }
  query: string
}

interface QueryResults {
  columns: { name: string; type: string }[]
  rows: string[][]
}

interface QueryHistoryItem {
  query_execution_id: string
  query: string
  status: string
  data_scanned_in_bytes: number
  submission_date_time: string
}

const TERMINAL_STATES = ["SUCCEEDED", "FAILED", "CANCELLED"]
const ROWS_PER_PAGE = 50

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(2)} ${units[i]}`
}

function stateBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "SUCCEEDED") return "default"
  if (state === "FAILED" || state === "CANCELLED") return "destructive"
  if (state === "RUNNING" || state === "QUEUED") return "secondary"
  return "outline"
}

export default function AthenaPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [activeView, setActiveView] = useState<"editor" | "history">("editor")
  const [queryString, setQueryString] = useState("")
  const [workgroup, setWorkgroup] = useState("primary")
  const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(undefined)
  const [activeQueryId, setActiveQueryId] = useState<string | null>(null)
  const [page, setPage] = useState(0)

  // Workgroup management
  const [createWgOpen, setCreateWgOpen] = useState(false)
  const [wgName, setWgName] = useState("")
  const [wgOutputLocation, setWgOutputLocation] = useState("")
  const [wgDescription, setWgDescription] = useState("")

  const { data: workgroups = [], isLoading: wgLoading, refetch: refetchWg } = useQuery({
    queryKey: ["athena-workgroups", instanceId],
    queryFn: () => instancesApi.listAthenaWorkgroups(instanceId).then((r) => r.data as Workgroup[]),
  })

  const { data: databases = [], isLoading: dbLoading } = useQuery({
    queryKey: ["athena-databases", instanceId],
    queryFn: () => instancesApi.listAthenaDatabases(instanceId).then((r) => r.data as AthenaDatabase[]),
  })

  const { data: execution } = useQuery({
    queryKey: ["athena-query-execution", instanceId, activeQueryId],
    queryFn: () =>
      instancesApi.getQueryExecution(instanceId, activeQueryId as string).then((r) => r.data as QueryExecution),
    enabled: !!activeQueryId,
    refetchInterval: (query) => {
      const state = query.state.data?.status.state
      return state && !TERMINAL_STATES.includes(state) ? 1000 : false
    },
  })

  const isRunning = execution?.status.state === "QUEUED" || execution?.status.state === "RUNNING"

  const { data: results, isLoading: resultsLoading } = useQuery({
    queryKey: ["athena-query-results", instanceId, activeQueryId],
    queryFn: () =>
      instancesApi.getQueryResults(instanceId, activeQueryId as string).then((r) => r.data as QueryResults),
    enabled: !!activeQueryId && execution?.status.state === "SUCCEEDED",
  })

  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["athena-query-history", instanceId, workgroup],
    queryFn: () =>
      instancesApi.listQueryHistory(instanceId, workgroup).then((r) => r.data as QueryHistoryItem[]),
    enabled: activeView === "history",
  })

  const runQueryMutation = useMutation({
    mutationFn: () =>
      instancesApi.runAthenaQuery(instanceId, {
        query_string: queryString,
        workgroup,
        database: selectedDatabase,
      }),
    onSuccess: (r) => {
      const data = r.data as { query_execution_id: string }
      setActiveQueryId(data.query_execution_id)
      setPage(0)
      toast.success("Query started")
    },
    onError: () => toast.error("Failed to start query"),
  })

  const cancelQueryMutation = useMutation({
    mutationFn: () => instancesApi.cancelQuery(instanceId, activeQueryId as string),
    onSuccess: () => toast.success("Query cancelled"),
    onError: () => toast.error("Failed to cancel query"),
  })

  const createWgMutation = useMutation({
    mutationFn: () =>
      instancesApi.createAthenaWorkgroup(instanceId, {
        name: wgName,
        output_location: wgOutputLocation,
        description: wgDescription || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athena-workgroups", instanceId] })
      setCreateWgOpen(false)
      setWgName(""); setWgOutputLocation(""); setWgDescription("")
      toast.success("Workgroup created")
    },
    onError: () => toast.error("Failed to create workgroup"),
  })

  const deleteWgMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteAthenaWorkgroup(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["athena-workgroups", instanceId] })
      toast.success("Workgroup deleted")
    },
    onError: () => toast.error("Failed to delete workgroup"),
  })

  function handleLoadHistoryQuery(item: QueryHistoryItem) {
    setActiveQueryId(item.query_execution_id)
    setActiveView("editor")
    setPage(0)
  }

  const pagedRows = results ? results.rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE) : []
  const totalPages = results ? Math.ceil(results.rows.length / ROWS_PER_PAGE) : 0

  return (
    <div className="flex gap-4">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Database className="h-3 w-3" /> Databases
            </span>
          </div>
          {dbLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {databases.length === 0 ? (
                <p className="text-xs text-muted-foreground">No databases found</p>
              ) : databases.map((d) => (
                <button
                  key={d.name}
                  onClick={() => setSelectedDatabase(d.name)}
                  className={`block w-full text-left text-xs font-mono px-2 py-1 rounded ${
                    selectedDatabase === d.name ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workgroup</span>
            {canMutate && (
              <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setCreateWgOpen(true)}>
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
          {wgLoading ? (
            <Skeleton className="h-8" />
          ) : (
            <select
              value={workgroup}
              onChange={(e) => setWorkgroup(e.target.value)}
              className="w-full h-8 text-xs border rounded px-2 bg-background"
            >
              {workgroups.length === 0 && <option value="primary">primary</option>}
              {workgroups.map((wg) => (
                <option key={wg.name} value={wg.name}>{wg.name}</option>
              ))}
            </select>
          )}
          <div className="mt-2 space-y-1">
            {workgroups.map((wg) => (
              <div key={wg.name} className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1">
                <span className="font-mono truncate">{wg.name}</span>
                {canMutate && wg.name !== "primary" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => deleteWgMutation.mutate(wg.name)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <Button
            variant={activeView === "editor" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start"
            onClick={() => setActiveView("editor")}
          >
            Query Editor
          </Button>
          <Button
            variant={activeView === "history" ? "secondary" : "ghost"}
            size="sm"
            className="justify-start"
            onClick={() => { setActiveView("history"); refetchHistory() }}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            Query History
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 space-y-3">
        {activeView === "editor" ? (
          <>
            <Textarea
              value={queryString}
              onChange={(e) => setQueryString(e.target.value)}
              placeholder="SELECT * FROM my_table LIMIT 10;"
              className="font-mono text-sm min-h-[160px]"
            />
            <div className="flex items-center gap-2">
              <Button
                onClick={() => runQueryMutation.mutate()}
                disabled={!queryString.trim() || runQueryMutation.isPending || isRunning}
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Run Query
              </Button>
              {isRunning && (
                <Button variant="outline" onClick={() => cancelQueryMutation.mutate()} disabled={cancelQueryMutation.isPending}>
                  <Square className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>

            {execution && (
              <div className="flex items-center gap-4 text-sm border rounded-lg px-3 py-2 bg-muted/20">
                <Badge variant={stateBadgeVariant(execution.status.state)}>{execution.status.state}</Badge>
                <span className="text-muted-foreground">
                  Runtime: {execution.statistics.engine_execution_time_in_millis} ms
                </span>
                <span className="text-muted-foreground">
                  Scanned: {formatBytes(execution.statistics.data_scanned_in_bytes)}
                </span>
              </div>
            )}

            {execution?.status.state === "FAILED" && (
              <div className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2 bg-destructive/5">
                {execution.status.state_change_reason || "Query failed"}
              </div>
            )}

            {execution?.status.state === "SUCCEEDED" && (
              <div>
                {resultsLoading ? (
                  <Skeleton className="h-32" />
                ) : results ? (
                  <div className="space-y-2">
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {results.columns.map((c) => (
                              <TableHead key={c.name}>{c.name}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagedRows.map((row, i) => (
                            <TableRow key={i}>
                              {row.map((val, j) => (
                                <TableCell key={j} className="font-mono text-xs">{val}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Page {page + 1} of {totalPages} ({results.rows.length} rows)
                        </span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                            Previous
                          </Button>
                          <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Query History ({history.length})</span>
              <Button variant="ghost" size="sm" onClick={() => refetchHistory()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {historyLoading ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scanned</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No queries found</TableCell>
                      </TableRow>
                    ) : history.map((item) => (
                      <TableRow
                        key={item.query_execution_id}
                        className="cursor-pointer"
                        onClick={() => handleLoadHistoryQuery(item)}
                      >
                        <TableCell className="font-mono text-xs max-w-[300px] truncate">{item.query}</TableCell>
                        <TableCell><Badge variant={stateBadgeVariant(item.status)}>{item.status}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatBytes(item.data_scanned_in_bytes)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.submission_date_time ? new Date(item.submission_date_time).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create workgroup dialog */}
      <Dialog open={createWgOpen} onOpenChange={setCreateWgOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Workgroup</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={wgName} onChange={(e) => setWgName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Output S3 Location</Label>
              <Input value={wgOutputLocation} onChange={(e) => setWgOutputLocation(e.target.value)} className="mt-1" placeholder="s3://bucket/path/" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={wgDescription} onChange={(e) => setWgDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWgOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createWgMutation.mutate()}
              disabled={!wgName || !wgOutputLocation || createWgMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
