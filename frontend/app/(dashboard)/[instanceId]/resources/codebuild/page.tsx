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
import { ChevronLeft, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  name: string
  arn: string
  description: string
  source_type: string
  source_location: string
  environment_type: string
  environment_image: string
  compute_type: string
  service_role: string
  created: string
  last_modified: string
}

interface Build {
  id: string
  build_status: string
  start_time: string
  end_time: string
  current_phase: string
  duration_in_seconds: number | null
  initiator: string
}

interface EnvVarRow {
  name: string
  value: string
  type: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied")
}

function truncateMid(s: string, len = 24) {
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    SUCCEEDED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    STOPPED: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status || "—"}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CodeBuildPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)
  const [startBuildTarget, setStartBuildTarget] = useState<Project | null>(null)

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["codebuild-projects", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listCodeBuildProjects(instanceId)
      return r.data as Project[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteCodeBuildProject(instanceId, name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["codebuild-projects", instanceId] })
      setDeleteTarget(null)
      if (selectedProject?.name === name) setSelectedProject(null)
      toast.success("Project deleted")
    },
    onError: () => toast.error("Failed to delete project"),
  })

  const startBuildMutation = useMutation({
    mutationFn: ({ name, body }: { name: string; body: Record<string, unknown> }) =>
      instancesApi.startBuild(instanceId, name, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["codebuild-builds", instanceId, vars.name] })
      setStartBuildTarget(null)
      toast.success("Build started")
    },
    onError: () => toast.error("Failed to start build"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CodeBuild</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Project
            </Button>
          )}
        </div>
      </div>

      {selectedProject ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Button>
          <BuildHistory instanceId={instanceId} project={selectedProject} canMutate={canMutate} />
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Source Type</TableHead>
                <TableHead>Compute Type</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No projects found</TableCell>
                </TableRow>
              ) : projects.map((p) => (
                <TableRow key={p.name} className="cursor-pointer" onClick={() => setSelectedProject(p)}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell><Badge variant="secondary">{p.source_type}</Badge></TableCell>
                  <TableCell className="text-sm">{p.compute_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.last_modified || "—"}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {canMutate && (
                        <>
                          <Button variant="outline" size="sm" className="h-6 text-xs px-2" onClick={() => setStartBuildTarget(p)}>
                            Start Build
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(p)}>
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

      {/* Create Project Dialog */}
      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        instanceId={instanceId}
      />

      {/* Start Build Dialog */}
      <StartBuildDialog
        project={startBuildTarget}
        onClose={() => setStartBuildTarget(null)}
        onSubmit={(body) => startBuildTarget && startBuildMutation.mutate({ name: startBuildTarget.name, body })}
        isPending={startBuildMutation.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Project</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete project <span className="font-mono font-medium text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.name)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Project Dialog ─────────────────────────────────────────────────────

function CreateProjectDialog({
  open,
  onClose,
  instanceId,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
}) {
  const qc = useQueryClient()
  const [name, setName] = useState("")
  const [sourceType, setSourceType] = useState("GITHUB")
  const [sourceLocation, setSourceLocation] = useState("")
  const [image, setImage] = useState("")
  const [computeType, setComputeType] = useState("BUILD_GENERAL1_SMALL")
  const [serviceRole, setServiceRole] = useState("")
  const [artifactsType, setArtifactsType] = useState("NO_ARTIFACTS")

  function reset() {
    setName("")
    setSourceType("GITHUB")
    setSourceLocation("")
    setImage("")
    setComputeType("BUILD_GENERAL1_SMALL")
    setServiceRole("")
    setArtifactsType("NO_ARTIFACTS")
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name,
        source: { type: sourceType, ...(sourceLocation ? { location: sourceLocation } : {}) },
        environment: { type: "LINUX_CONTAINER", image, compute_type: computeType },
        service_role: serviceRole,
        artifacts_type: artifactsType,
      }
      return instancesApi.createCodeBuildProject(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["codebuild-projects", instanceId] })
      onClose()
      reset()
      toast.success("Project created")
    },
    onError: () => toast.error("Failed to create project"),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create CodeBuild Project</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => v && setSourceType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GITHUB">GITHUB</SelectItem>
                  <SelectItem value="S3">S3</SelectItem>
                  <SelectItem value="CODECOMMIT">CODECOMMIT</SelectItem>
                  <SelectItem value="BITBUCKET">BITBUCKET</SelectItem>
                  <SelectItem value="NO_SOURCE">NO_SOURCE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Source Location</Label>
              <Input value={sourceLocation} onChange={(e) => setSourceLocation(e.target.value)} placeholder="https://github.com/..." />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Environment Image</Label>
            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="aws/codebuild/standard:7.0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Compute Type</Label>
              <Select value={computeType} onValueChange={(v) => v && setComputeType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUILD_GENERAL1_SMALL">BUILD_GENERAL1_SMALL</SelectItem>
                  <SelectItem value="BUILD_GENERAL1_MEDIUM">BUILD_GENERAL1_MEDIUM</SelectItem>
                  <SelectItem value="BUILD_GENERAL1_LARGE">BUILD_GENERAL1_LARGE</SelectItem>
                  <SelectItem value="BUILD_GENERAL1_2XLARGE">BUILD_GENERAL1_2XLARGE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Artifacts Type</Label>
              <Select value={artifactsType} onValueChange={(v) => v && setArtifactsType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_ARTIFACTS">NO_ARTIFACTS</SelectItem>
                  <SelectItem value="S3">S3</SelectItem>
                  <SelectItem value="CODEPIPELINE">CODEPIPELINE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Service Role ARN</Label>
            <Input value={serviceRole} onChange={(e) => setServiceRole(e.target.value)} placeholder="arn:aws:iam::..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name || !image || !serviceRole || createMutation.isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Start Build Dialog ─────────────────────────────────────────────────────────

function StartBuildDialog({
  project,
  onClose,
  onSubmit,
  isPending,
}: {
  project: Project | null
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [envVars, setEnvVars] = useState<EnvVarRow[]>([])
  const [sourceVersion, setSourceVersion] = useState("")

  function reset() {
    setEnvVars([])
    setSourceVersion("")
  }

  function handleSubmit() {
    const body: Record<string, unknown> = {}
    const filtered = envVars.filter((v) => v.name)
    if (filtered.length > 0) {
      body.environment_variables_override = filtered.map((v) => ({ name: v.name, value: v.value, type: v.type }))
    }
    if (sourceVersion) body.source_version = sourceVersion
    onSubmit(body)
  }

  return (
    <Dialog open={!!project} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Start Build — {project?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Source Version (optional)</Label>
            <Input value={sourceVersion} onChange={(e) => setSourceVersion(e.target.value)} placeholder="branch, tag, or commit SHA" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Environment Variable Overrides (optional)</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setEnvVars([...envVars, { name: "", value: "", type: "PLAINTEXT" }])}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            {envVars.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  placeholder="NAME"
                  value={v.name}
                  onChange={(e) => setEnvVars(envVars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <Input
                  className="flex-1"
                  placeholder="value"
                  value={v.value}
                  onChange={(e) => setEnvVars(envVars.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                />
                <Select value={v.type} onValueChange={(val) => val && setEnvVars(envVars.map((x, j) => (j === i ? { ...x, type: val } : x)))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLAINTEXT">PLAINTEXT</SelectItem>
                    <SelectItem value="PARAMETER_STORE">PARAMETER_STORE</SelectItem>
                    <SelectItem value="SECRETS_MANAGER">SECRETS_MANAGER</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending}>Start Build</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Build History ───────────────────────────────────────────────────────────

function BuildHistory({
  instanceId,
  project,
  canMutate,
}: {
  instanceId: string
  project: Project
  canMutate: boolean
}) {
  const { data: builds = [], isLoading, refetch } = useQuery({
    queryKey: ["codebuild-builds", instanceId, project.name],
    queryFn: async () => {
      const r = await instancesApi.listBuilds(instanceId, project.name)
      return r.data as Build[]
    },
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium font-mono">{project.name}</h3>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Build ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Initiator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {builds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No builds found</TableCell>
                </TableRow>
              ) : builds.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1">
                      <span>{truncateMid(b.id, 28)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyToClipboard(b.id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{statusBadge(b.build_status)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.start_time || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {b.duration_in_seconds != null ? `${Math.round(b.duration_in_seconds)}s` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{b.initiator || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
