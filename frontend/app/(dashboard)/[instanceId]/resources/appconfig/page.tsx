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
import { Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Application {
  id: string
  name: string
  description: string
}

interface Environment {
  id: string
  application_id: string
  name: string
  state: string
  description: string
}

interface ConfigProfile {
  id: string
  application_id: string
  name: string
  location_uri: string
  validator_types: string[]
}

interface Deployment {
  deployment_number: number
  state: string
  configuration_profile_id: string
  deployment_strategy_id: string
  started_at: string
  completed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateBadge(state: string) {
  const variants: Record<string, string> = {
    READY_FOR_DEPLOYMENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    DEPLOYING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    BAKING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    COMPLETE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    ROLLED_BACK: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[state] ?? "bg-gray-100 text-gray-600"}`}>
      {state || "—"}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppConfigPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [selectedEnvId, setSelectedEnvId] = useState<string>("")

  const [createAppOpen, setCreateAppOpen] = useState(false)
  const [appName, setAppName] = useState("")
  const [appDesc, setAppDesc] = useState("")
  const [deleteAppTarget, setDeleteAppTarget] = useState<Application | null>(null)

  const { data: apps = [], isLoading: appsLoading, refetch: refetchApps } = useQuery({
    queryKey: ["appconfig-apps", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listAppConfigApps(instanceId)
      return r.data as Application[]
    },
  })

  const createAppMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name: appName }
      if (appDesc) body.description = appDesc
      return instancesApi.createAppConfigApp(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appconfig-apps", instanceId] })
      setCreateAppOpen(false)
      setAppName("")
      setAppDesc("")
      toast.success("Application created")
    },
    onError: () => toast.error("Failed to create application"),
  })

  const deleteAppMutation = useMutation({
    mutationFn: (appId: string) => instancesApi.deleteAppConfigApp(instanceId, appId),
    onSuccess: (_d, appId) => {
      qc.invalidateQueries({ queryKey: ["appconfig-apps", instanceId] })
      setDeleteAppTarget(null)
      if (selectedApp?.id === appId) setSelectedApp(null)
      toast.success("Application deleted")
    },
    onError: () => toast.error("Failed to delete application"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">AppConfig</h2>
        <Button variant="ghost" size="sm" onClick={() => refetchApps()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        {/* ── Applications Tab ── */}
        <TabsContent value="applications" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Applications ({apps.length})</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => setCreateAppOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Application
              </Button>
            )}
          </div>
          {appsLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    {canMutate && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 3 : 2} className="text-center text-muted-foreground h-24">No applications found</TableCell>
                    </TableRow>
                  ) : apps.map((a) => (
                    <TableRow
                      key={a.id}
                      className={`cursor-pointer ${selectedApp?.id === a.id ? "bg-accent/60" : ""}`}
                      onClick={() => { setSelectedApp(a); setSelectedEnvId("") }}
                    >
                      <TableCell className="font-medium text-sm">{a.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a.description || "—"}</TableCell>
                      {canMutate && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteAppTarget(a)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {selectedApp && (
            <p className="text-xs text-muted-foreground mt-2">
              Selected: <span className="font-mono font-medium text-foreground">{selectedApp.name}</span> — use the Environments, Profiles, and Deployments tabs to manage it.
            </p>
          )}
        </TabsContent>

        {/* ── Environments Tab ── */}
        <TabsContent value="environments" className="pt-3">
          {!selectedApp ? (
            <EmptySelectAppState />
          ) : (
            <EnvironmentsTab instanceId={instanceId} appId={selectedApp.id} canMutate={canMutate} />
          )}
        </TabsContent>

        {/* ── Profiles Tab ── */}
        <TabsContent value="profiles" className="pt-3">
          {!selectedApp ? (
            <EmptySelectAppState />
          ) : (
            <ProfilesTab instanceId={instanceId} appId={selectedApp.id} canMutate={canMutate} />
          )}
        </TabsContent>

        {/* ── Deployments Tab ── */}
        <TabsContent value="deployments" className="pt-3">
          {!selectedApp ? (
            <EmptySelectAppState />
          ) : (
            <DeploymentsTab
              instanceId={instanceId}
              appId={selectedApp.id}
              canMutate={canMutate}
              selectedEnvId={selectedEnvId}
              setSelectedEnvId={setSelectedEnvId}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Create Application Dialog */}
      <Dialog open={createAppOpen} onOpenChange={setCreateAppOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Application</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={appDesc} onChange={(e) => setAppDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAppOpen(false)}>Cancel</Button>
            <Button onClick={() => createAppMutation.mutate()} disabled={!appName || createAppMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Application Confirmation */}
      <Dialog open={!!deleteAppTarget} onOpenChange={() => setDeleteAppTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Application</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete application <span className="font-mono font-medium text-foreground">{deleteAppTarget?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAppTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteAppMutation.isPending}
              onClick={() => deleteAppTarget && deleteAppMutation.mutate(deleteAppTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EmptySelectAppState() {
  return (
    <div className="border rounded-lg h-32 flex items-center justify-center text-sm text-muted-foreground">
      Select an application in the Applications tab first
    </div>
  )
}

// ─── Environments Tab ──────────────────────────────────────────────────────────

function EnvironmentsTab({
  instanceId,
  appId,
  canMutate,
}: {
  instanceId: string
  appId: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)

  const { data: envs = [], isLoading, refetch } = useQuery({
    queryKey: ["appconfig-envs", instanceId, appId],
    queryFn: async () => {
      const r = await instancesApi.listAppConfigEnvs(instanceId, appId)
      return r.data as Environment[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name }
      if (description) body.description = description
      return instancesApi.createAppConfigEnv(instanceId, appId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appconfig-envs", instanceId, appId] })
      setCreateOpen(false)
      setName("")
      setDescription("")
      toast.success("Environment created")
    },
    onError: () => toast.error("Failed to create environment"),
  })

  const deleteMutation = useMutation({
    mutationFn: (envId: string) => instancesApi.deleteAppConfigEnv(instanceId, appId, envId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appconfig-envs", instanceId, appId] })
      setDeleteTarget(null)
      toast.success("Environment deleted")
    },
    onError: () => toast.error("Failed to delete environment"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{envs.length} environment{envs.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Environment
            </Button>
          )}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {envs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 3 : 2} className="text-center text-muted-foreground h-24">No environments found</TableCell>
                </TableRow>
              ) : envs.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium text-sm">{e.name}</TableCell>
                  <TableCell>{stateBadge(e.state)}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(e)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Environment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <DialogHeader><DialogTitle>Delete Environment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete environment <span className="font-mono font-medium text-foreground">{deleteTarget?.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Profiles Tab ───────────────────────────────────────────────────────────────

function ProfilesTab({
  instanceId,
  appId,
  canMutate,
}: {
  instanceId: string
  appId: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [locationUri, setLocationUri] = useState("hosted")
  const [validatorTypes, setValidatorTypes] = useState("")

  const { data: profiles = [], isLoading, refetch } = useQuery({
    queryKey: ["appconfig-profiles", instanceId, appId],
    queryFn: async () => {
      const r = await instancesApi.listConfigProfiles(instanceId, appId)
      return r.data as ConfigProfile[]
    },
  })

  function reset() {
    setName("")
    setLocationUri("hosted")
    setValidatorTypes("")
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name, location_uri: locationUri }
      const types = validatorTypes.split(",").map((s) => s.trim()).filter(Boolean)
      if (types.length > 0) body.validator_types = types
      return instancesApi.createConfigProfile(instanceId, appId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appconfig-profiles", instanceId, appId] })
      setCreateOpen(false)
      reset()
      toast.success("Configuration profile created")
    },
    onError: () => toast.error("Failed to create configuration profile"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{profiles.length} profile{profiles.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /></Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Profile
            </Button>
          )}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location URI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground h-24">No profiles found</TableCell>
                </TableRow>
              ) : profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{p.location_uri}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Configuration Profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Location URI</Label>
              <Input value={locationUri} onChange={(e) => setLocationUri(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Validator Types (optional, comma-separated)</Label>
              <Input placeholder="JSON_SCHEMA" value={validatorTypes} onChange={(e) => setValidatorTypes(e.target.value)} />
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

// ─── Deployments Tab ─────────────────────────────────────────────────────────────

function DeploymentsTab({
  instanceId,
  appId,
  canMutate,
  selectedEnvId,
  setSelectedEnvId,
}: {
  instanceId: string
  appId: string
  canMutate: boolean
  selectedEnvId: string
  setSelectedEnvId: (id: string) => void
}) {
  const qc = useQueryClient()
  const [startOpen, setStartOpen] = useState(false)
  const [envIdForStart, setEnvIdForStart] = useState("")
  const [profileId, setProfileId] = useState("")
  const [strategyId, setStrategyId] = useState("AppConfig.AllAtOnce")
  const [configVersion, setConfigVersion] = useState("")

  const { data: envs = [] } = useQuery({
    queryKey: ["appconfig-envs", instanceId, appId],
    queryFn: async () => {
      const r = await instancesApi.listAppConfigEnvs(instanceId, appId)
      return r.data as Environment[]
    },
  })

  const { data: profiles = [] } = useQuery({
    queryKey: ["appconfig-profiles", instanceId, appId],
    queryFn: async () => {
      const r = await instancesApi.listConfigProfiles(instanceId, appId)
      return r.data as ConfigProfile[]
    },
  })

  const { data: deployments = [], isLoading, refetch } = useQuery({
    queryKey: ["appconfig-deployments", instanceId, appId, selectedEnvId],
    queryFn: async () => {
      const r = await instancesApi.listDeployments(instanceId, appId, selectedEnvId)
      return r.data as Deployment[]
    },
    enabled: !!selectedEnvId,
  })

  function reset() {
    setEnvIdForStart("")
    setProfileId("")
    setStrategyId("AppConfig.AllAtOnce")
    setConfigVersion("")
  }

  const startMutation = useMutation({
    mutationFn: () =>
      instancesApi.startDeployment(instanceId, appId, {
        environment_id: envIdForStart,
        configuration_profile_id: profileId,
        deployment_strategy_id: strategyId,
        configuration_version: configVersion,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appconfig-deployments", instanceId, appId, envIdForStart] })
      setStartOpen(false)
      setSelectedEnvId(envIdForStart)
      reset()
      toast.success("Deployment started")
    },
    onError: () => toast.error("Failed to start deployment"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Environment:</Label>
          <Select value={selectedEnvId} onValueChange={(v) => v && setSelectedEnvId(v)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select environment" /></SelectTrigger>
            <SelectContent>
              {envs.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={!selectedEnvId}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => { reset(); if (selectedEnvId) setEnvIdForStart(selectedEnvId); setStartOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Start Deployment
            </Button>
          )}
        </div>
      </div>

      {!selectedEnvId ? (
        <div className="border rounded-lg h-32 flex items-center justify-center text-sm text-muted-foreground">
          Select an environment to view deployments
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deployment #</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No deployments found</TableCell>
                  </TableRow>
                ) : deployments.map((d) => (
                  <TableRow key={d.deployment_number}>
                    <TableCell className="font-mono text-sm">{d.deployment_number}</TableCell>
                    <TableCell>{stateBadge(d.state)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{d.configuration_profile_id}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.started_at || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Start Deployment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Environment</Label>
              <Select value={envIdForStart} onValueChange={(v) => v && setEnvIdForStart(v)}>
                <SelectTrigger><SelectValue placeholder="Select environment" /></SelectTrigger>
                <SelectContent>
                  {envs.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Configuration Profile</Label>
              <Select value={profileId} onValueChange={(v) => v && setProfileId(v)}>
                <SelectTrigger><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Deployment Strategy</Label>
              <Input value={strategyId} onChange={(e) => setStrategyId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Configuration Version</Label>
              <Input value={configVersion} onChange={(e) => setConfigVersion(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartOpen(false)}>Cancel</Button>
            <Button
              onClick={() => startMutation.mutate()}
              disabled={!envIdForStart || !profileId || !configVersion || startMutation.isPending}
            >
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
