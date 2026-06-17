"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Eye, EyeOff, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface RestAPI {
  id: string
  name: string
  description: string
  endpoint_configuration: string[]
  created_date: string
}

interface APIResource {
  id: string
  parent_id: string
  path: string
  path_part: string
  resource_methods: string[]
}

interface APIStage {
  stage_name: string
  deployment_id: string
  description: string
  created_date: string
  last_updated_date: string
}

interface APIKey {
  id: string
  name: string
  enabled: boolean
  value: string
  created_date: string
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Resources Tab ────────────────────────────────────────────────────────────

function ResourcesTab({
  instanceId,
  apiId,
  canMutate,
}: {
  instanceId: string
  apiId: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [parentId, setParentId] = useState("")
  const [pathPart, setPathPart] = useState("")

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["apigw-resources", instanceId, apiId],
    queryFn: () => instancesApi.listAPIResources(instanceId, apiId).then((r) => r.data as APIResource[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createAPIResource(instanceId, apiId, { parent_id: parentId, path_part: pathPart }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigw-resources", instanceId, apiId] })
      setCreateOpen(false)
      setParentId("")
      setPathPart("")
      toast.success("Resource created")
    },
    onError: () => toast.error("Failed to create resource"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Resources ({resources.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setParentId(resources[0]?.id ?? ""); setPathPart(""); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Resource
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
                <TableHead>Path</TableHead>
                <TableHead>Path Part</TableHead>
                <TableHead>Methods</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm h-24">No resources found</TableCell>
                </TableRow>
              ) : resources.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.path}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.path_part || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.resource_methods.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : r.resource_methods.map((m) => (
                        <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Resource</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Parent Resource</label>
              <Select value={parentId} onValueChange={(v) => v && setParentId(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select parent resource" />
                </SelectTrigger>
                <SelectContent>
                  {resources.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.path}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Path Part</label>
              <Input value={pathPart} onChange={(e) => setPathPart(e.target.value)} className="mt-1" placeholder="users" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!parentId || !pathPart || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Stages Tab ───────────────────────────────────────────────────────────────

function StagesTab({ instanceId, apiId }: { instanceId: string; apiId: string }) {
  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["apigw-stages", instanceId, apiId],
    queryFn: () => instancesApi.listAPIStages(instanceId, apiId).then((r) => r.data as APIStage[]),
  })

  return (
    <div className="space-y-3 pt-3">
      <span className="text-sm font-medium">Stages ({stages.length})</span>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage Name</TableHead>
                <TableHead>Deployment ID</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No stages found</TableCell>
                </TableRow>
              ) : stages.map((s) => (
                <TableRow key={s.stage_name}>
                  <TableCell className="font-mono text-sm">{s.stage_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.deployment_id || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.created_date ? new Date(s.created_date).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.last_updated_date ? new Date(s.last_updated_date).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Deployments Tab ──────────────────────────────────────────────────────────

function DeploymentsTab({
  instanceId,
  apiId,
  canMutate,
}: {
  instanceId: string
  apiId: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [stageName, setStageName] = useState("")
  const [description, setDescription] = useState("")

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createAPIDeployment(instanceId, apiId, { stage_name: stageName, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigw-stages", instanceId, apiId] })
      setCreateOpen(false)
      setStageName("")
      setDescription("")
      toast.success("Deployment created")
    },
    onError: () => toast.error("Failed to create deployment"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Deployments</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setStageName(""); setDescription(""); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Deployment
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Creating a deployment publishes the current resource/method configuration to a stage. See the Stages tab for deployed stages.
      </p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Deployment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Stage Name</label>
              <Input value={stageName} onChange={(e) => setStageName(e.target.value)} className="mt-1" placeholder="prod" />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!stageName || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── API Keys Section ─────────────────────────────────────────────────────────

function ApiKeysSection({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: keys = [], isLoading, refetch } = useQuery({
    queryKey: ["apigw-keys", instanceId],
    queryFn: () => instancesApi.listAPIKeys(instanceId).then((r) => r.data as APIKey[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createAPIKey(instanceId, { name, enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigw-keys", instanceId] })
      setCreateOpen(false)
      setName("")
      setEnabled(true)
      toast.success("API key created")
    },
    onError: () => toast.error("Failed to create API key"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteAPIKey(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigw-keys", instanceId] })
      setDeleteConfirm(null)
      toast.success("API key deleted")
    },
    onError: () => toast.error("Failed to delete API key"),
  })

  function maskValue(v: string) {
    if (!v) return "—"
    if (v.length <= 8) return "•".repeat(v.length)
    return v.slice(0, 4) + "•".repeat(Math.max(v.length - 8, 4)) + v.slice(-4)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">API Keys</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => { setName(""); setEnabled(true); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Create API Key
            </Button>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No API keys found</TableCell>
                </TableRow>
              ) : keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium text-sm">{k.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs">{revealed[k.id] ? k.value : maskValue(k.value)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRevealed((p) => ({ ...p, [k.id]: !p[k.id] }))}>
                        {revealed[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(k.value)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={k.enabled ? "default" : "secondary"} className="text-xs">{k.enabled ? "Enabled" : "Disabled"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{k.created_date ? new Date(k.created_date).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(k.id)}>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} id="apikey-enabled" />
              <label htmlFor="apikey-enabled" className="text-sm font-medium">Enabled</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this API key?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiGatewayPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedApi, setSelectedApi] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [endpointType, setEndpointType] = useState("REGIONAL")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: apis = [], isLoading, refetch } = useQuery({
    queryKey: ["apigw-rest-apis", instanceId],
    queryFn: () => instancesApi.listRestAPIs(instanceId).then((r) => r.data as RestAPI[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createRestAPI(instanceId, { name: newName, description: newDescription || undefined, endpoint_type: endpointType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigw-rest-apis", instanceId] })
      setCreateOpen(false)
      setNewName("")
      setNewDescription("")
      setEndpointType("REGIONAL")
      toast.success(`API "${newName}" created`)
    },
    onError: () => toast.error("Failed to create API"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteRestAPI(instanceId, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["apigw-rest-apis", instanceId] })
      if (selectedApi === id) setSelectedApi(null)
      setDeleteConfirm(null)
      toast.success("API deleted")
    },
    onError: () => toast.error("Failed to delete API"),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">API Gateway (REST APIs)</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => { setNewName(""); setNewDescription(""); setEndpointType("REGIONAL"); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Create REST API
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-3 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Endpoint Type</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {apis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground text-sm h-24">No REST APIs found</TableCell>
                </TableRow>
              ) : apis.map((a) => (
                <TableRow
                  key={a.id}
                  className={`cursor-pointer ${selectedApi === a.id ? "bg-accent" : ""}`}
                  onClick={() => setSelectedApi(a.id)}
                >
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.endpoint_configuration.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.created_date ? new Date(a.created_date).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(a.id)}>
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

      {selectedApi && (
        <div className="border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-2">{apis.find((a) => a.id === selectedApi)?.name}</h3>
          <Tabs defaultValue="resources">
            <TabsList>
              <TabsTrigger value="resources">Resources</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
            </TabsList>
            <TabsContent value="resources">
              <ResourcesTab instanceId={instanceId} apiId={selectedApi} canMutate={canMutate} />
            </TabsContent>
            <TabsContent value="stages">
              <StagesTab instanceId={instanceId} apiId={selectedApi} />
            </TabsContent>
            <TabsContent value="deployments">
              <DeploymentsTab instanceId={instanceId} apiId={selectedApi} canMutate={canMutate} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      <div className="border-t pt-6">
        <ApiKeysSection instanceId={instanceId} canMutate={canMutate} />
      </div>

      {/* Create REST API Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create REST API</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Endpoint Type</label>
              <Select value={endpointType} onValueChange={(v) => v && setEndpointType(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="REGIONAL">REGIONAL</SelectItem>
                  <SelectItem value="EDGE">EDGE</SelectItem>
                  <SelectItem value="PRIVATE">PRIVATE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newName || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this REST API? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
