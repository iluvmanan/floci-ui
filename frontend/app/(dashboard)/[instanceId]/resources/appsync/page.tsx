"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { ChevronLeft, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphQLAPI {
  api_id: string
  name: string
  authentication_type: string
  uris: Record<string, string>
  arn: string
  tags: Record<string, string>
}

interface DataSource {
  name: string
  type: string
  description: string
  service_role_arn: string
  dynamodb_config: Record<string, unknown> | null
  lambda_config: Record<string, unknown> | null
}

interface AppSyncType {
  name: string
  definition: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success("Copied")
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AppSyncPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedApi, setSelectedApi] = useState<GraphQLAPI | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [authType, setAuthType] = useState("API_KEY")
  const [deleteTarget, setDeleteTarget] = useState<GraphQLAPI | null>(null)

  const { data: apis = [], isLoading, refetch } = useQuery({
    queryKey: ["appsync-apis", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listAppSyncAPIs(instanceId)
      return r.data as GraphQLAPI[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createAppSyncAPI(instanceId, { name, authentication_type: authType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appsync-apis", instanceId] })
      setCreateOpen(false)
      setName("")
      setAuthType("API_KEY")
      toast.success("API created")
    },
    onError: () => toast.error("Failed to create API"),
  })

  const deleteMutation = useMutation({
    mutationFn: (apiId: string) => instancesApi.deleteAppSyncAPI(instanceId, apiId),
    onSuccess: (_d, apiId) => {
      qc.invalidateQueries({ queryKey: ["appsync-apis", instanceId] })
      setDeleteTarget(null)
      if (selectedApi?.api_id === apiId) setSelectedApi(null)
      toast.success("API deleted")
    },
    onError: () => toast.error("Failed to delete API"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">AppSync</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create API
            </Button>
          )}
        </div>
      </div>

      {selectedApi ? (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedApi(null)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to APIs
          </Button>
          <ApiDetail instanceId={instanceId} api={selectedApi} canMutate={canMutate} />
        </div>
      ) : isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Auth Type</TableHead>
                <TableHead>GraphQL URL</TableHead>
                <TableHead>API ID</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {apis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">
                    No APIs found
                  </TableCell>
                </TableRow>
              ) : (
                apis.map((a) => (
                  <TableRow key={a.api_id} className="cursor-pointer" onClick={() => setSelectedApi(a)}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell><Badge variant="secondary">{a.authentication_type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-xs">{a.uris?.GRAPHQL || "—"}</span>
                        {a.uris?.GRAPHQL && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(a.uris.GRAPHQL) }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{a.api_id}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(a)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create API Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create GraphQL API</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Authentication Type</Label>
              <Select value={authType} onValueChange={(v) => v && setAuthType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="API_KEY">API_KEY</SelectItem>
                  <SelectItem value="AWS_IAM">AWS_IAM</SelectItem>
                  <SelectItem value="AMAZON_COGNITO_USER_POOLS">AMAZON_COGNITO_USER_POOLS</SelectItem>
                  <SelectItem value="OPENID_CONNECT">OPENID_CONNECT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete API</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete API <span className="font-mono font-medium text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.api_id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── API Detail (Schema | Data Sources | Types | Settings) ───────────────────

function ApiDetail({
  instanceId,
  api,
  canMutate,
}: {
  instanceId: string
  api: GraphQLAPI
  canMutate: boolean
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium font-mono">{api.name}</h3>
      <Tabs defaultValue="schema">
        <TabsList>
          <TabsTrigger value="schema">Schema</TabsTrigger>
          <TabsTrigger value="datasources">Data Sources</TabsTrigger>
          <TabsTrigger value="types">Types</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="schema" className="mt-4">
          <SchemaTab instanceId={instanceId} apiId={api.api_id} />
        </TabsContent>
        <TabsContent value="datasources" className="mt-4">
          <DataSourcesTab instanceId={instanceId} apiId={api.api_id} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <TypesTab instanceId={instanceId} apiId={api.api_id} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab api={api} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Schema Tab ────────────────────────────────────────────────────────────────

function SchemaTab({ instanceId, apiId }: { instanceId: string; apiId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["appsync-schema", instanceId, apiId],
    queryFn: async () => {
      const r = await instancesApi.getAppSyncSchema(instanceId, apiId)
      return r.data as { schema: string; error?: string }
    },
  })

  if (isLoading) return <Skeleton className="h-64" />

  if (!data?.schema) {
    return (
      <div className="border rounded-lg h-48 flex items-center justify-center text-sm text-muted-foreground">
        No schema defined
      </div>
    )
  }

  return (
    <pre className="text-xs bg-muted rounded-md p-3 max-h-[32rem] overflow-auto font-mono">
      {data.schema}
    </pre>
  )
}

// ─── Data Sources Tab ──────────────────────────────────────────────────────────

function DataSourcesTab({
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
  const [name, setName] = useState("")
  const [type, setType] = useState("AMAZON_DYNAMODB")
  const [description, setDescription] = useState("")
  const [serviceRoleArn, setServiceRoleArn] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: dataSources = [], isLoading, refetch } = useQuery({
    queryKey: ["appsync-datasources", instanceId, apiId],
    queryFn: async () => {
      const r = await instancesApi.listDataSources(instanceId, apiId)
      return r.data as DataSource[]
    },
  })

  function reset() {
    setName("")
    setType("AMAZON_DYNAMODB")
    setDescription("")
    setServiceRoleArn("")
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { name, type }
      if (description) body.description = description
      if (serviceRoleArn) body.service_role_arn = serviceRoleArn
      return instancesApi.createDataSource(instanceId, apiId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appsync-datasources", instanceId, apiId] })
      setCreateOpen(false)
      reset()
      toast.success("Data source created")
    },
    onError: () => toast.error("Failed to create data source"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteDataSource(instanceId, apiId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appsync-datasources", instanceId, apiId] })
      setDeleteTarget(null)
      toast.success("Data source deleted")
    },
    onError: () => toast.error("Failed to delete data source"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {dataSources.length} data source{dataSources.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Data Source
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
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataSources.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground h-24">
                    No data sources found
                  </TableCell>
                </TableRow>
              ) : (
                dataSources.map((ds) => (
                  <TableRow key={ds.name}>
                    <TableCell className="font-mono text-sm">{ds.name}</TableCell>
                    <TableCell><Badge variant="secondary">{ds.type}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ds.description || "—"}</TableCell>
                    {canMutate && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(ds.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Data Source Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Data Source</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMAZON_DYNAMODB">AMAZON_DYNAMODB</SelectItem>
                  <SelectItem value="AWS_LAMBDA">AWS_LAMBDA</SelectItem>
                  <SelectItem value="AMAZON_OPENSEARCH">AMAZON_OPENSEARCH</SelectItem>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="NONE">NONE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Service Role ARN (optional)</Label>
              <Input placeholder="arn:aws:iam::..." value={serviceRoleArn} onChange={(e) => setServiceRoleArn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || !type || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Data Source</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete data source <span className="font-mono font-medium text-foreground">{deleteTarget}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
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

// ─── Types Tab ─────────────────────────────────────────────────────────────────

function TypesTab({ instanceId, apiId }: { instanceId: string; apiId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["appsync-types", instanceId, apiId],
    queryFn: async () => {
      const r = await instancesApi.listAppSyncTypes(instanceId, apiId)
      return r.data as AppSyncType[]
    },
  })

  if (isLoading) return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>

  if (types.length === 0) {
    return (
      <div className="border rounded-lg h-32 flex items-center justify-center text-sm text-muted-foreground">
        No types found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {types.map((t) => (
        <div key={t.name} className="border rounded-lg overflow-hidden">
          <button
            className="w-full text-left px-3 py-2 text-sm font-mono font-medium hover:bg-accent/40"
            onClick={() => setExpanded(expanded === t.name ? null : t.name)}
          >
            {t.name}
          </button>
          {expanded === t.name && (
            <pre className="text-xs bg-muted p-3 max-h-64 overflow-auto font-mono border-t">
              {t.definition}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ api }: { api: GraphQLAPI }) {
  return (
    <div className="space-y-4 max-w-lg">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Endpoint URL</Label>
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm bg-muted rounded px-2 py-1.5 flex-1 truncate">{api.uris?.GRAPHQL || "—"}</p>
          {api.uris?.GRAPHQL && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(api.uris.GRAPHQL)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Authentication Type</Label>
        <div><Badge variant="secondary">{api.authentication_type}</Badge></div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">ARN</Label>
        <p className="font-mono text-xs text-muted-foreground break-all">{api.arn}</p>
      </div>
    </div>
  )
}
