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
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Namespace {
  id: string
  name: string
  type: string
  description: string
  create_date: string
  properties: Record<string, unknown>
}

interface CloudMapService {
  id: string
  name: string
  namespace_id: string
  description: string
  instance_count: number
  create_date: string
  routing_policy: string
}

interface ServiceInstance {
  id: string
  attributes: Record<string, string>
}

// ─── Namespaces Pane ───────────────────────────────────────────────────────────

function NamespacesPane({
  instanceId,
  canMutate,
  selected,
  onSelect,
}: {
  instanceId: string
  canMutate: boolean
  selected: Namespace | null
  onSelect: (ns: Namespace | null) => void
}) {
  const qc = useQueryClient()
  const [httpOpen, setHttpOpen] = useState(false)
  const [dnsOpen, setDnsOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [vpc, setVpc] = useState("")

  const { data: namespaces = [], isLoading } = useQuery({
    queryKey: ["cloudmap-namespaces", instanceId],
    queryFn: () => instancesApi.listCloudMapNamespaces(instanceId).then((r) => r.data as Namespace[]),
  })

  const createHttpMutation = useMutation({
    mutationFn: () => instancesApi.createHTTPNamespace(instanceId, { name, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-namespaces", instanceId] })
      setHttpOpen(false); setName(""); setDescription("")
      toast.success("HTTP namespace creation started")
    },
    onError: () => toast.error("Failed to create namespace"),
  })

  const createDnsMutation = useMutation({
    mutationFn: () => instancesApi.createPrivateDNSNamespace(instanceId, { name, vpc, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-namespaces", instanceId] })
      setDnsOpen(false); setName(""); setDescription(""); setVpc("")
      toast.success("Private DNS namespace creation started")
    },
    onError: () => toast.error("Failed to create namespace"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteNamespace(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-namespaces", instanceId] })
      onSelect(null)
      toast.success("Namespace deletion started")
    },
    onError: () => toast.error("Failed to delete namespace"),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Namespaces</span>
        {canMutate && (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setHttpOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> HTTP
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setDnsOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> DNS
            </Button>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : namespaces.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">No namespaces found</p>
      ) : (
        <div className="space-y-1">
          {namespaces.map((ns) => (
            <div
              key={ns.id}
              onClick={() => onSelect(ns)}
              className={cn(
                "border rounded-md p-2 cursor-pointer text-sm",
                selected?.id === ns.id ? "bg-accent border-accent-foreground/20" : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{ns.name}</span>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(ns.id) }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-[10px]">{ns.type}</Badge>
              </div>
              {ns.description && <p className="text-[11px] text-muted-foreground mt-1">{ns.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={httpOpen} onOpenChange={setHttpOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create HTTP Namespace</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHttpOpen(false)}>Cancel</Button>
            <Button onClick={() => createHttpMutation.mutate()} disabled={!name || createHttpMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dnsOpen} onOpenChange={setDnsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Private DNS Namespace</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" placeholder="internal.local" />
            </div>
            <div>
              <Label>VPC ID</Label>
              <Input value={vpc} onChange={(e) => setVpc(e.target.value)} className="mt-1" placeholder="vpc-xxxxxxxx" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDnsOpen(false)}>Cancel</Button>
            <Button onClick={() => createDnsMutation.mutate()} disabled={!name || !vpc || createDnsMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Services Pane ─────────────────────────────────────────────────────────────

function ServicesPane({
  instanceId,
  canMutate,
  namespace,
  selected,
  onSelect,
}: {
  instanceId: string
  canMutate: boolean
  namespace: Namespace | null
  selected: CloudMapService | null
  onSelect: (svc: CloudMapService | null) => void
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [routingPolicy, setRoutingPolicy] = useState("MULTIVALUE")
  const [recordType, setRecordType] = useState("A")
  const [ttl, setTtl] = useState(60)

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["cloudmap-services", instanceId, namespace?.id],
    queryFn: () => instancesApi.listCloudMapServices(instanceId, namespace?.id).then((r) => r.data as CloudMapService[]),
    enabled: !!namespace,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createCloudMapService(instanceId, {
        name,
        namespace_id: namespace!.id,
        routing_policy: namespace?.type !== "HTTP" ? routingPolicy : undefined,
        dns_config: namespace?.type !== "HTTP" ? { dns_records: [{ type: recordType, ttl }] } : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-services", instanceId, namespace?.id] })
      setCreateOpen(false); setName("")
      toast.success("Service created")
    },
    onError: () => toast.error("Failed to create service"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deleteCloudMapService(instanceId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-services", instanceId, namespace?.id] })
      onSelect(null)
      toast.success("Service deleted")
    },
    onError: () => toast.error("Failed to delete service"),
  })

  if (!namespace) {
    return <p className="text-xs text-muted-foreground p-2">Select a namespace to view services</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Services</span>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Create
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : services.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">No services found</p>
      ) : (
        <div className="space-y-1">
          {services.map((svc) => (
            <div
              key={svc.id}
              onClick={() => onSelect(svc)}
              className={cn(
                "border rounded-md p-2 cursor-pointer text-sm",
                selected?.id === svc.id ? "bg-accent border-accent-foreground/20" : "hover:bg-accent/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{svc.name}</span>
                {canMutate && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(svc.id) }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{svc.instance_count} instance(s) · {svc.routing_policy || "—"}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            {namespace.type !== "HTTP" && (
              <>
                <div>
                  <Label>Routing Policy</Label>
                  <Select value={routingPolicy} onValueChange={(v) => v && setRoutingPolicy(v)}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MULTIVALUE">Multivalue</SelectItem>
                      <SelectItem value="WEIGHTED">Weighted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>DNS Record Type</Label>
                    <Select value={recordType} onValueChange={(v) => v && setRecordType(v)}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A</SelectItem>
                        <SelectItem value="AAAA">AAAA</SelectItem>
                        <SelectItem value="CNAME">CNAME</SelectItem>
                        <SelectItem value="SRV">SRV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>TTL (s)</Label>
                    <Input type="number" min={1} value={ttl} onChange={(e) => setTtl(Number(e.target.value))} className="mt-1" />
                  </div>
                </div>
              </>
            )}
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

// ─── Instances Pane ─────────────────────────────────────────────────────────────

function InstancesPane({
  instanceId,
  canMutate,
  service,
}: {
  instanceId: string
  canMutate: boolean
  service: CloudMapService | null
}) {
  const qc = useQueryClient()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [instId, setInstId] = useState("")
  const [ip, setIp] = useState("")
  const [port, setPort] = useState("")
  const [customAttrs, setCustomAttrs] = useState("")

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["cloudmap-instances", instanceId, service?.id],
    queryFn: () => instancesApi.listServiceInstances(instanceId, service!.id).then((r) => r.data as ServiceInstance[]),
    enabled: !!service,
  })

  const registerMutation = useMutation({
    mutationFn: () => {
      const attributes: Record<string, string> = {}
      if (ip) attributes.AWS_INSTANCE_IPV4 = ip
      if (port) attributes.AWS_INSTANCE_PORT = port
      customAttrs.split(",").forEach((pair) => {
        const [k, v] = pair.split("=").map((s) => s.trim())
        if (k && v) attributes[k] = v
      })
      return instancesApi.registerInstance(instanceId, service!.id, instId, { attributes })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-instances", instanceId, service?.id] })
      setRegisterOpen(false); setInstId(""); setIp(""); setPort(""); setCustomAttrs("")
      toast.success("Instance registration started")
    },
    onError: () => toast.error("Failed to register instance"),
  })

  const deregisterMutation = useMutation({
    mutationFn: (id: string) => instancesApi.deregisterInstance(instanceId, service!.id, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cloudmap-instances", instanceId, service?.id] })
      toast.success("Instance deregistration started")
    },
    onError: () => toast.error("Failed to deregister instance"),
  })

  if (!service) {
    return <p className="text-xs text-muted-foreground p-2">Select a service to view instances</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Instances</span>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Register
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : instances.length === 0 ? (
        <p className="text-xs text-muted-foreground p-2">No instances registered</p>
      ) : (
        <div className="space-y-1">
          {instances.map((inst) => (
            <div key={inst.id} className="border rounded-md p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{inst.id}</span>
                {canMutate && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deregisterMutation.mutate(inst.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {inst.attributes.AWS_INSTANCE_IPV4 || "—"}:{inst.attributes.AWS_INSTANCE_PORT || "—"}
              </p>
              <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">{JSON.stringify(inst.attributes, null, 0)}</pre>
            </div>
          ))}
        </div>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register Instance</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Instance ID</Label>
              <Input value={instId} onChange={(e) => setInstId(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IPv4 Address</Label>
                <Input value={ip} onChange={(e) => setIp(e.target.value)} className="mt-1" placeholder="10.0.0.1" />
              </div>
              <div>
                <Label>Port</Label>
                <Input value={port} onChange={(e) => setPort(e.target.value)} className="mt-1" placeholder="8080" />
              </div>
            </div>
            <div>
              <Label>Custom Attributes (key=value, comma-separated)</Label>
              <Input value={customAttrs} onChange={(e) => setCustomAttrs(e.target.value)} className="mt-1" placeholder="version=1.0, env=prod" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button onClick={() => registerMutation.mutate()} disabled={!instId || registerMutation.isPending}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CloudMapPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null)
  const [selectedService, setSelectedService] = useState<CloudMapService | null>(null)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Cloud Map (Service Discovery)</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-3">
          <NamespacesPane
            instanceId={instanceId}
            canMutate={canMutate}
            selected={selectedNamespace}
            onSelect={(ns) => { setSelectedNamespace(ns); setSelectedService(null) }}
          />
        </div>
        <div className="border rounded-lg p-3">
          <ServicesPane
            instanceId={instanceId}
            canMutate={canMutate}
            namespace={selectedNamespace}
            selected={selectedService}
            onSelect={setSelectedService}
          />
        </div>
        <div className="border rounded-lg p-3">
          <InstancesPane instanceId={instanceId} canMutate={canMutate} service={selectedService} />
        </div>
      </div>
    </div>
  )
}
