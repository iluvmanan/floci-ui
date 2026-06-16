"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface ApiV2 {
  api_id: string
  name: string
  protocol_type: string
  api_endpoint: string
  created_date: string
  tags: Record<string, string>
}

interface RouteV2 {
  route_id: string
  route_key: string
  target: string
  api_key_required: boolean
}

interface IntegrationV2 {
  integration_id: string
  integration_type: string
  integration_uri: string
  integration_method: string
  payload_format_version: string
}

interface StageV2 {
  stage_name: string
  auto_deploy: boolean
  last_deployment_status_message: string
  created_date: string
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Routes Tab ───────────────────────────────────────────────────────────────

function RoutesTab({
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
  const [routeKey, setRouteKey] = useState("")
  const [target, setTarget] = useState("")

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ["apigwv2-routes", instanceId, apiId],
    queryFn: () => instancesApi.listRoutesv2(instanceId, apiId).then((r) => r.data as RouteV2[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createRouteV2(instanceId, apiId, { route_key: routeKey, target: target || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigwv2-routes", instanceId, apiId] })
      setCreateOpen(false)
      setRouteKey("")
      setTarget("")
      toast.success("Route created")
    },
    onError: () => toast.error("Failed to create route"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Routes ({routes.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setRouteKey(""); setTarget(""); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Route
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
                <TableHead>Route Key</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {routes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground text-sm h-24">No routes found</TableCell>
                </TableRow>
              ) : routes.map((r) => (
                <TableRow key={r.route_id}>
                  <TableCell className="font-mono text-sm">{r.route_key}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.target || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Route</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Route Key</label>
              <Input value={routeKey} onChange={(e) => setRouteKey(e.target.value)} className="mt-1" placeholder="GET /pets" />
            </div>
            <div>
              <label className="text-sm font-medium">Target (optional)</label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1" placeholder="integrations/abc123" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!routeKey || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab({
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
  const [integrationType, setIntegrationType] = useState("HTTP_PROXY")
  const [uri, setUri] = useState("")
  const [method, setMethod] = useState("POST")

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["apigwv2-integrations", instanceId, apiId],
    queryFn: () => instancesApi.listIntegrationsV2(instanceId, apiId).then((r) => r.data as IntegrationV2[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createIntegrationV2(instanceId, apiId, {
      integration_type: integrationType,
      integration_uri: uri || undefined,
      integration_method: method || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigwv2-integrations", instanceId, apiId] })
      setCreateOpen(false)
      setUri("")
      setMethod("POST")
      setIntegrationType("HTTP_PROXY")
      toast.success("Integration created")
    },
    onError: () => toast.error("Failed to create integration"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Integrations ({integrations.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setIntegrationType("HTTP_PROXY"); setUri(""); setMethod("POST"); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Integration
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
                <TableHead>Type</TableHead>
                <TableHead>URI</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Payload Format</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No integrations found</TableCell>
                </TableRow>
              ) : integrations.map((i) => (
                <TableRow key={i.integration_id}>
                  <TableCell><Badge variant="outline" className="text-xs">{i.integration_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-[260px] truncate">{i.integration_uri || "—"}</TableCell>
                  <TableCell className="text-sm">{i.integration_method || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{i.payload_format_version || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Integration</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={integrationType} onValueChange={(v) => v && setIntegrationType(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP_PROXY">HTTP_PROXY</SelectItem>
                  <SelectItem value="AWS_PROXY">AWS_PROXY</SelectItem>
                  <SelectItem value="MOCK">MOCK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">URI</label>
              <Input value={uri} onChange={(e) => setUri(e.target.value)} className="mt-1" placeholder="https://example.com/api" />
            </div>
            <div>
              <label className="text-sm font-medium">Method</label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1" placeholder="POST" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Stages Tab ───────────────────────────────────────────────────────────────

function StagesTab({
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

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["apigwv2-stages", instanceId, apiId],
    queryFn: () => instancesApi.listStagesV2(instanceId, apiId).then((r) => r.data as StageV2[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createDeploymentV2(instanceId, apiId, stageName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigwv2-stages", instanceId, apiId] })
      setCreateOpen(false)
      setStageName("")
      toast.success("Deployment created")
    },
    onError: () => toast.error("Failed to create deployment"),
  })

  return (
    <div className="space-y-3 pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Stages ({stages.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setStageName(""); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Deployment
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
                <TableHead>Stage Name</TableHead>
                <TableHead>Auto Deploy</TableHead>
                <TableHead>Status Message</TableHead>
                <TableHead>Created</TableHead>
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
                  <TableCell>
                    <Badge variant={s.auto_deploy ? "default" : "secondary"} className="text-xs">{s.auto_deploy ? "Enabled" : "Disabled"}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{s.last_deployment_status_message || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.created_date ? new Date(s.created_date).toLocaleString() : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Deployment</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium">Stage Name</label>
            <Input value={stageName} onChange={(e) => setStageName(e.target.value)} className="mt-1" placeholder="prod" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ApiGatewayV2Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedApi, setSelectedApi] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [protocolType, setProtocolType] = useState<"HTTP" | "WEBSOCKET">("HTTP")
  const [routeKey, setRouteKey] = useState("")
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: apis = [], isLoading, refetch } = useQuery({
    queryKey: ["apigwv2-apis", instanceId],
    queryFn: () => instancesApi.listAPIsv2(instanceId).then((r) => r.data as ApiV2[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createAPIv2(instanceId, {
      name: newName,
      protocol_type: protocolType,
      route_key: protocolType === "HTTP" ? (routeKey || undefined) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["apigwv2-apis", instanceId] })
      setCreateOpen(false)
      setNewName("")
      setRouteKey("")
      setProtocolType("HTTP")
      toast.success(`API "${newName}" created`)
    },
    onError: () => toast.error("Failed to create API"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteAPIv2(instanceId, id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["apigwv2-apis", instanceId] })
      if (selectedApi === id) setSelectedApi(null)
      setDeleteConfirm(null)
      toast.success("API deleted")
    },
    onError: () => toast.error("Failed to delete API"),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">API Gateway v2 (HTTP / WebSocket APIs)</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => { setNewName(""); setRouteKey(""); setProtocolType("HTTP"); setCreateOpen(true) }}>
              <Plus className="h-4 w-4 mr-1" />
              Create API
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
                <TableHead>Protocol</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {apis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No APIs found</TableCell>
                </TableRow>
              ) : apis.map((a) => (
                <TableRow
                  key={a.api_id}
                  className={`cursor-pointer ${selectedApi === a.api_id ? "bg-accent" : ""}`}
                  onClick={() => setSelectedApi(a.api_id)}
                >
                  <TableCell className="font-medium text-sm">{a.name}</TableCell>
                  <TableCell>
                    <Badge variant={a.protocol_type === "WEBSOCKET" ? "secondary" : "default"} className="text-xs">{a.protocol_type}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {a.api_endpoint ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-muted-foreground max-w-[220px] truncate">{a.api_endpoint}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(a.api_endpoint)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.created_date ? new Date(a.created_date).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteConfirm(a.api_id)}>
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
          <h3 className="text-sm font-semibold mb-2">{apis.find((a) => a.api_id === selectedApi)?.name}</h3>
          <Tabs defaultValue="routes">
            <TabsList>
              <TabsTrigger value="routes">Routes</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="stages">Stages</TabsTrigger>
            </TabsList>
            <TabsContent value="routes">
              <RoutesTab instanceId={instanceId} apiId={selectedApi} canMutate={canMutate} />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab instanceId={instanceId} apiId={selectedApi} canMutate={canMutate} />
            </TabsContent>
            <TabsContent value="stages">
              <StagesTab instanceId={instanceId} apiId={selectedApi} canMutate={canMutate} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Create API Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create API</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Protocol Type</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="protocol"
                    value="HTTP"
                    checked={protocolType === "HTTP"}
                    onChange={() => setProtocolType("HTTP")}
                  />
                  HTTP
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="protocol"
                    value="WEBSOCKET"
                    checked={protocolType === "WEBSOCKET"}
                    onChange={() => setProtocolType("WEBSOCKET")}
                  />
                  WEBSOCKET
                </label>
              </div>
            </div>
            {protocolType === "HTTP" && (
              <div>
                <label className="text-sm font-medium">Route Key (optional)</label>
                <Input value={routeKey} onChange={(e) => setRouteKey(e.target.value)} className="mt-1" placeholder="GET /pets" />
              </div>
            )}
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
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this API? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
