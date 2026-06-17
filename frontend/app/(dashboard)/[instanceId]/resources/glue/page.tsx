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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown, ChevronRight, Play, Square, Plus, Trash2, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface GlueDatabase {
  name: string
  description: string
  location_uri: string
  create_time: string
  parameters: Record<string, unknown>
}

interface GlueColumn {
  name: string
  type: string
}

interface GlueTable {
  name: string
  description: string
  table_type: string
  create_time: string
  update_time: string
  storage_descriptor: { location: string; columns: GlueColumn[] }
}

interface GlueCrawler {
  name: string
  role: string
  targets: Record<string, unknown>
  database_name: string
  schedule: string
  state: string
  last_run: Record<string, unknown> | null
}

interface GlueJob {
  name: string
  description: string
  role: string
  command: { name: string; script_location: string }
  default_arguments: Record<string, unknown>
  created_on: string
  last_modified_on: string
}

interface JobRun {
  id: string
  job_name: string
  run_id: string
  attempt: number
  triggered_by: string
  started_on: string
  last_modified_on: string
  completed_on: string
  job_run_state: string
  error_message: string
  execution_time: number
}

function crawlerStateBadge(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "RUNNING") return "secondary"
  if (state === "STOPPING") return "destructive"
  return "outline"
}

function jobRunStateBadge(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "SUCCEEDED") return "default"
  if (state === "FAILED" || state === "ERROR" || state === "TIMEOUT") return "destructive"
  if (state === "RUNNING" || state === "STARTING") return "secondary"
  return "outline"
}

// ─── Data Catalog Tab ─────────────────────────────────────────────────────────

function DatabaseRow({ instanceId, db }: { instanceId: string; db: GlueDatabase }) {
  const [expanded, setExpanded] = useState(false)
  const [selectedTable, setSelectedTable] = useState<GlueTable | null>(null)

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["glue-tables", instanceId, db.name],
    queryFn: () => instancesApi.listGlueTables(instanceId, db.name).then((r) => r.data as GlueTable[]),
    enabled: expanded,
  })

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <TableCell>{expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
        <TableCell className="font-mono text-sm">{db.name}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{db.description || "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{db.location_uri || "—"}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="p-0">
            <div className="p-3 bg-muted/20 border-t space-y-2">
              {isLoading ? (
                <Skeleton className="h-8" />
              ) : tables.length === 0 ? (
                <p className="text-xs text-muted-foreground">No tables found</p>
              ) : (
                <div className="space-y-1">
                  {tables.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTable(t)}
                      className="block w-full text-left text-xs font-mono px-2 py-1 rounded bg-background hover:bg-accent"
                    >
                      {t.name} <span className="text-muted-foreground">({t.table_type})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}

      <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedTable?.name}</DialogTitle></DialogHeader>
          {selectedTable && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">S3 Location</Label>
                <p className="font-mono text-xs break-all">{selectedTable.storage_descriptor.location || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Schema</Label>
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedTable.storage_descriptor.columns.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-mono text-xs">{c.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{c.type}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTable(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function DataCatalogTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [locationUri, setLocationUri] = useState("")

  const { data: databases = [], isLoading } = useQuery({
    queryKey: ["glue-databases", instanceId],
    queryFn: () => instancesApi.listGlueDatabases(instanceId).then((r) => r.data as GlueDatabase[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createGlueDatabase(instanceId, {
        name,
        description: description || undefined,
        location_uri: locationUri || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-databases", instanceId] })
      setCreateOpen(false)
      setName(""); setDescription(""); setLocationUri("")
      toast.success("Database created")
    },
    onError: () => toast.error("Failed to create database"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteGlueDatabase(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-databases", instanceId] })
      toast.success("Database deleted")
    },
    onError: () => toast.error("Failed to delete database"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Databases ({databases.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Database
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {databases.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No databases found</TableCell></TableRow>
              ) : databases.map((db) => (
                <DatabaseRow key={db.name} instanceId={instanceId} db={db} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canMutate && databases.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {databases.map((db) => (
            <Button key={db.name} variant="ghost" size="sm" className="text-xs h-6" onClick={() => deleteMutation.mutate(db.name)}>
              <Trash2 className="h-3 w-3 mr-1 text-destructive" /> Delete {db.name}
            </Button>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Database</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Location URI (optional)</Label>
              <Input value={locationUri} onChange={(e) => setLocationUri(e.target.value)} className="mt-1" placeholder="s3://bucket/path/" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Crawlers Tab ─────────────────────────────────────────────────────────────

function CrawlersTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [s3Paths, setS3Paths] = useState("")
  const [databaseName, setDatabaseName] = useState("")
  const [schedule, setSchedule] = useState("")

  const { data: crawlers = [], isLoading } = useQuery({
    queryKey: ["glue-crawlers", instanceId],
    queryFn: () => instancesApi.listGlueCrawlers(instanceId).then((r) => r.data as GlueCrawler[]),
  })

  const { data: databases = [] } = useQuery({
    queryKey: ["glue-databases", instanceId],
    queryFn: () => instancesApi.listGlueDatabases(instanceId).then((r) => r.data as GlueDatabase[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createGlueCrawler(instanceId, {
        name,
        role,
        database_name: databaseName,
        targets: { s3_paths: s3Paths.split(",").map((p) => p.trim()).filter(Boolean) },
        schedule: schedule || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-crawlers", instanceId] })
      setCreateOpen(false)
      setName(""); setRole(""); setS3Paths(""); setDatabaseName(""); setSchedule("")
      toast.success("Crawler created")
    },
    onError: () => toast.error("Failed to create crawler"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteGlueCrawler(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-crawlers", instanceId] })
      toast.success("Crawler deleted")
    },
    onError: () => toast.error("Failed to delete crawler"),
  })

  const startMutation = useMutation({
    mutationFn: (n: string) => instancesApi.startGlueCrawler(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-crawlers", instanceId] })
      toast.success("Crawler started")
    },
    onError: () => toast.error("Failed to start crawler"),
  })

  const stopMutation = useMutation({
    mutationFn: (n: string) => instancesApi.stopGlueCrawler(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-crawlers", instanceId] })
      toast.success("Crawler stopping")
    },
    onError: () => toast.error("Failed to stop crawler"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Crawlers ({crawlers.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Crawler
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Database</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Last Run</TableHead>
                {canMutate && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {crawlers.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground text-sm h-24">No crawlers found</TableCell></TableRow>
              ) : crawlers.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-mono text-sm">{c.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.database_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{c.schedule || "—"}</TableCell>
                  <TableCell><Badge variant={crawlerStateBadge(c.state)}>{c.state}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.last_run ? "Yes" : "Never"}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={c.state === "RUNNING"}
                          onClick={() => startMutation.mutate(c.name)}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={c.state !== "RUNNING"}
                          onClick={() => stopMutation.mutate(c.name)}
                        >
                          <Square className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(c.name)}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Crawler</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>IAM Role ARN</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
            </div>
            <div>
              <Label>S3 Paths (comma-separated)</Label>
              <Input value={s3Paths} onChange={(e) => setS3Paths(e.target.value)} className="mt-1" placeholder="s3://bucket/path1/, s3://bucket/path2/" />
            </div>
            <div>
              <Label>Database</Label>
              <Select value={databaseName} onValueChange={(v) => v && setDatabaseName(v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select database" /></SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.name} value={db.name}>{db.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Schedule (cron, optional)</Label>
              <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="mt-1" placeholder="cron(0 12 * * ? *)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !role || !databaseName || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Jobs Tab ─────────────────────────────────────────────────────────────────

function JobRunsPanel({ instanceId, jobName }: { instanceId: string; jobName: string }) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["glue-job-runs", instanceId, jobName],
    queryFn: () => instancesApi.getJobRuns(instanceId, jobName).then((r) => r.data as JobRun[]),
  })

  if (isLoading) return <Skeleton className="h-16" />
  if (runs.length === 0) return <p className="text-xs text-muted-foreground p-2">No runs yet</p>

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run ID</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration (s)</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.run_id}>
              <TableCell className="font-mono text-xs">{r.run_id}</TableCell>
              <TableCell><Badge variant={jobRunStateBadge(r.job_run_state)}>{r.job_run_state}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.started_on ? new Date(r.started_on).toLocaleString() : "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.execution_time}</TableCell>
              <TableCell className="text-xs text-destructive max-w-[200px] truncate">{r.error_message || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function JobsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [scriptLocation, setScriptLocation] = useState("")
  const [commandName, setCommandName] = useState("glueetl")
  const [workerType, setWorkerType] = useState("G.1X")
  const [numberOfWorkers, setNumberOfWorkers] = useState(2)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["glue-jobs", instanceId],
    queryFn: () => instancesApi.listGlueJobs(instanceId).then((r) => r.data as GlueJob[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createGlueJob(instanceId, {
        name,
        role,
        command: { name: commandName, script_location: scriptLocation },
        worker_type: workerType,
        number_of_workers: numberOfWorkers,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-jobs", instanceId] })
      setCreateOpen(false)
      setName(""); setRole(""); setScriptLocation("")
      toast.success("Job created")
    },
    onError: () => toast.error("Failed to create job"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteGlueJob(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["glue-jobs", instanceId] })
      toast.success("Job deleted")
    },
    onError: () => toast.error("Failed to delete job"),
  })

  const startMutation = useMutation({
    mutationFn: (n: string) => instancesApi.startGlueJob(instanceId, n, {}),
    onSuccess: (_r, n) => {
      qc.invalidateQueries({ queryKey: ["glue-job-runs", instanceId, n] })
      toast.success("Job run started")
    },
    onError: () => toast.error("Failed to start job"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Jobs ({jobs.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Job
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground text-sm h-24">No jobs found</TableCell></TableRow>
              ) : jobs.map((j) => (
                <>
                  <TableRow key={j.name} className="cursor-pointer" onClick={() => setExpandedJob(expandedJob === j.name ? null : j.name)}>
                    <TableCell>{expandedJob === j.name ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell className="font-mono text-sm">{j.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{j.command.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[160px]">{j.role}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{j.created_on ? new Date(j.created_on).toLocaleDateString() : "—"}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startMutation.mutate(j.name)} disabled={startMutation.isPending}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(j.name)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  {expandedJob === j.name && (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 6 : 5} className="p-3 bg-muted/20 border-t">
                        <JobRunsPanel instanceId={instanceId} jobName={j.name} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>IAM Role ARN</Label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
            </div>
            <div>
              <Label>Script S3 Location</Label>
              <Input value={scriptLocation} onChange={(e) => setScriptLocation(e.target.value)} className="mt-1" placeholder="s3://bucket/scripts/job.py" />
            </div>
            <div>
              <Label>Command Type</Label>
              <Select value={commandName} onValueChange={(v) => v && setCommandName(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="glueetl">glueetl</SelectItem>
                  <SelectItem value="pythonshell">pythonshell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Worker Type</Label>
                <Select value={workerType} onValueChange={(v) => v && setWorkerType(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="G.1X">G.1X</SelectItem>
                    <SelectItem value="G.2X">G.2X</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Worker Count</Label>
                <Input
                  type="number"
                  min={1}
                  value={numberOfWorkers}
                  onChange={(e) => setNumberOfWorkers(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || !role || !scriptLocation || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GluePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Glue</h2>
      </div>
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Data Catalog</TabsTrigger>
          <TabsTrigger value="crawlers">Crawlers</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="pt-3">
          <DataCatalogTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="crawlers" className="pt-3">
          <CrawlersTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="jobs" className="pt-3">
          <JobsTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
