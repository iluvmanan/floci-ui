"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { ChevronDown, ChevronRight, Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoadBalancer {
  load_balancer_arn: string
  load_balancer_name: string
  dns_name: string
  scheme: string
  type: string
  state: string
  availability_zones: string[]
  created_time: string
}

interface TargetGroup {
  target_group_arn: string
  target_group_name: string
  protocol: string
  port: number
  vpc_id: string
  target_type: string
  health_check_path: string | null
  health_check_protocol: string | null
}

interface Listener {
  listener_arn: string
  port: number
  protocol: string
  ssl_policy: string | null
  certificates: { CertificateArn: string }[]
  default_actions: Record<string, unknown>[]
}

interface TargetHealth {
  target_id: string
  target_port: number
  health_state: string
  health_reason: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badge(text: string, color: string) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {text}
    </span>
  )
}

function typeBadge(type: string) {
  return badge(type, "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400")
}

function schemeBadge(scheme: string) {
  return badge(scheme, "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300")
}

function stateBadge(state: string) {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    provisioning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  return badge(state, variants[state] ?? "bg-gray-100 text-gray-600")
}

function healthBadge(state: string) {
  const variants: Record<string, string> = {
    healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    unhealthy: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    initial: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
    draining: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    unused: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
  }
  return badge(state, variants[state.toLowerCase()] ?? "bg-gray-100 text-gray-600")
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ELBv2Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Load Balancers</h2>
      <Tabs defaultValue="load-balancers">
        <TabsList>
          <TabsTrigger value="load-balancers">Load Balancers</TabsTrigger>
          <TabsTrigger value="target-groups">Target Groups</TabsTrigger>
        </TabsList>
        <TabsContent value="load-balancers" className="mt-4">
          <LoadBalancersTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
        <TabsContent value="target-groups" className="mt-4">
          <TargetGroupsTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Load Balancers Tab ───────────────────────────────────────────────────────

function LoadBalancersTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [lbType, setLbType] = useState("application")
  const [lbName, setLbName] = useState("")
  const [lbScheme, setLbScheme] = useState("internet-facing")
  const [lbSubnets, setLbSubnets] = useState("")
  const [lbSGs, setLbSGs] = useState("")

  const { data: lbs = [], isLoading, refetch } = useQuery({
    queryKey: ["elbv2-lbs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listLoadBalancers(instanceId)
      return r.data as LoadBalancer[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: lbName,
        subnets: lbSubnets.split(",").map((s) => s.trim()).filter(Boolean),
        type: lbType,
        scheme: lbScheme,
      }
      const sgs = lbSGs.split(",").map((s) => s.trim()).filter(Boolean)
      if (sgs.length > 0) body.security_groups = sgs
      return instancesApi.createLoadBalancer(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-lbs", instanceId] })
      setCreateOpen(false)
      setLbName(""); setLbSubnets(""); setLbSGs(""); setLbType("application"); setLbScheme("internet-facing")
      toast.success("Load balancer created")
    },
    onError: () => toast.error("Failed to create load balancer"),
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteLoadBalancer(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-lbs", instanceId] })
      setDeleteTarget(null)
      toast.success("Load balancer deleted")
    },
    onError: () => toast.error("Failed to delete load balancer"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{lbs.length} load balancer{lbs.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Load Balancer
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>DNS Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scheme</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lbs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 8 : 7} className="text-center text-muted-foreground h-24">No load balancers found</TableCell>
                </TableRow>
              ) : lbs.flatMap((lb) => {
                const isExpanded = expanded === lb.load_balancer_arn
                return [
                  <TableRow key={lb.load_balancer_arn} className="cursor-pointer hover:bg-accent/40" onClick={() => setExpanded(isExpanded ? null : lb.load_balancer_arn)}>
                    <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    <TableCell className="font-medium text-sm">{lb.load_balancer_name}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{lb.dns_name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(lb.dns_name)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{typeBadge(lb.type)}</TableCell>
                    <TableCell>{schemeBadge(lb.scheme)}</TableCell>
                    <TableCell>{stateBadge(lb.state)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{lb.created_time ? new Date(lb.created_time).toLocaleDateString() : "—"}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(lb.load_balancer_arn)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>,
                  isExpanded ? (
                    <TableRow key={`${lb.load_balancer_arn}-detail`} className="bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={canMutate ? 7 : 6} className="py-3">
                        <LoadBalancerDetail instanceId={instanceId} lb={lb} canMutate={canMutate} />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ].filter(Boolean)
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create LB Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Load Balancer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={lbType} onValueChange={(v) => v && setLbType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">Application Load Balancer (ALB)</SelectItem>
                  <SelectItem value="network">Network Load Balancer (NLB)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={lbName} onChange={(e) => setLbName(e.target.value)} placeholder="my-load-balancer" />
            </div>
            <div className="space-y-1">
              <Label>Scheme</Label>
              <Select value={lbScheme} onValueChange={(v) => v && setLbScheme(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet-facing">Internet-facing</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subnets (comma-separated)</Label>
              <Input value={lbSubnets} onChange={(e) => setLbSubnets(e.target.value)} placeholder="subnet-aaa, subnet-bbb" />
            </div>
            {lbType === "application" && (
              <div className="space-y-1">
                <Label>Security Groups (comma-separated)</Label>
                <Input value={lbSGs} onChange={(e) => setLbSGs(e.target.value)} placeholder="sg-aaa, sg-bbb" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!lbName || !lbSubnets || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Load Balancer</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete this load balancer? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Load Balancer Detail (listeners) ────────────────────────────────────────

function LoadBalancerDetail({ instanceId, lb, canMutate }: { instanceId: string; lb: LoadBalancer; canMutate: boolean }) {
  const qc = useQueryClient()
  const [addListenerOpen, setAddListenerOpen] = useState(false)
  const [listenerProtocol, setListenerProtocol] = useState("HTTP")
  const [listenerPort, setListenerPort] = useState("80")
  const [targetGroupArn, setTargetGroupArn] = useState("")

  const { data: listeners = [], isLoading } = useQuery({
    queryKey: ["elbv2-listeners", instanceId, lb.load_balancer_arn],
    queryFn: async () => {
      const r = await instancesApi.listListeners(instanceId, lb.load_balancer_arn)
      return r.data as Listener[]
    },
  })

  const addListenerMutation = useMutation({
    mutationFn: () =>
      instancesApi.createListener(instanceId, lb.load_balancer_arn, {
        protocol: listenerProtocol,
        port: parseInt(listenerPort),
        default_actions: [{ Type: "forward", TargetGroupArn: targetGroupArn }],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-listeners", instanceId, lb.load_balancer_arn] })
      setAddListenerOpen(false)
      setTargetGroupArn("")
      toast.success("Listener added")
    },
    onError: () => toast.error("Failed to add listener"),
  })

  const deleteListenerMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteListener(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-listeners", instanceId, lb.load_balancer_arn] })
      toast.success("Listener deleted")
    },
    onError: () => toast.error("Failed to delete listener"),
  })

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <span className="text-muted-foreground">DNS Name</span>
        <span className="font-mono">{lb.dns_name}</span>
        <span className="text-muted-foreground">Availability Zones</span>
        <span>{lb.availability_zones.join(", ") || "—"}</span>
      </div>
      <div className="flex items-center justify-between">
        <p className="font-medium">Listeners</p>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setAddListenerOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Add Listener
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-10" />
      ) : listeners.length === 0 ? (
        <p className="text-muted-foreground">No listeners</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Port</TableHead>
              <TableHead className="text-xs">Protocol</TableHead>
              <TableHead className="text-xs">Default Action</TableHead>
              {canMutate && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listeners.map((l) => (
              <TableRow key={l.listener_arn}>
                <TableCell className="text-xs">{l.port}</TableCell>
                <TableCell className="text-xs">{l.protocol}</TableCell>
                <TableCell className="text-xs font-mono truncate max-w-xs">
                  {JSON.stringify(l.default_actions?.[0] ?? {})}
                </TableCell>
                {canMutate && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteListenerMutation.mutate(l.listener_arn)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={addListenerOpen} onOpenChange={setAddListenerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Listener</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Protocol</Label>
              <Select value={listenerProtocol} onValueChange={(v) => v && setListenerProtocol(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                  <SelectItem value="HTTPS">HTTPS</SelectItem>
                  <SelectItem value="TCP">TCP</SelectItem>
                  <SelectItem value="TLS">TLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Port</Label>
              <Input type="number" value={listenerPort} onChange={(e) => setListenerPort(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Target Group ARN (forward action)</Label>
              <Input value={targetGroupArn} onChange={(e) => setTargetGroupArn(e.target.value)} placeholder="arn:aws:elasticloadbalancing:..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddListenerOpen(false)}>Cancel</Button>
            <Button onClick={() => addListenerMutation.mutate()} disabled={!targetGroupArn || !listenerPort || addListenerMutation.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Target Groups Tab ────────────────────────────────────────────────────────

function TargetGroupsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const [tgName, setTgName] = useState("")
  const [tgProtocol, setTgProtocol] = useState("HTTP")
  const [tgPort, setTgPort] = useState("80")
  const [tgVpc, setTgVpc] = useState("")
  const [tgTargetType, setTgTargetType] = useState("instance")
  const [tgHcPath, setTgHcPath] = useState("")

  const { data: tgs = [], isLoading, refetch } = useQuery({
    queryKey: ["elbv2-tgs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listTargetGroups(instanceId)
      return r.data as TargetGroup[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: tgName,
        protocol: tgProtocol,
        port: parseInt(tgPort),
        target_type: tgTargetType,
      }
      if (tgVpc) body.vpc_id = tgVpc
      if (tgHcPath) body.health_check_path = tgHcPath
      return instancesApi.createTargetGroup(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-tgs", instanceId] })
      setCreateOpen(false)
      setTgName(""); setTgVpc(""); setTgHcPath(""); setTgPort("80"); setTgProtocol("HTTP"); setTgTargetType("instance")
      toast.success("Target group created")
    },
    onError: () => toast.error("Failed to create target group"),
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteTargetGroup(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-tgs", instanceId] })
      setDeleteTarget(null)
      toast.success("Target group deleted")
    },
    onError: () => toast.error("Failed to delete target group"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{tgs.length} target group{tgs.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Target Group
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Target Type</TableHead>
                <TableHead>VPC ID</TableHead>
                <TableHead>Health Check Path</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 8 : 7} className="text-center text-muted-foreground h-24">No target groups found</TableCell>
                </TableRow>
              ) : tgs.flatMap((tg) => {
                const isExpanded = expanded === tg.target_group_arn
                return [
                  <TableRow key={tg.target_group_arn} className="cursor-pointer hover:bg-accent/40" onClick={() => setExpanded(isExpanded ? null : tg.target_group_arn)}>
                    <TableCell>{isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</TableCell>
                    <TableCell className="font-medium text-sm">{tg.target_group_name}</TableCell>
                    <TableCell className="text-xs">{tg.protocol}</TableCell>
                    <TableCell className="text-xs">{tg.port}</TableCell>
                    <TableCell className="text-xs">{tg.target_type}</TableCell>
                    <TableCell className="font-mono text-xs">{tg.vpc_id || "—"}</TableCell>
                    <TableCell className="text-xs">{tg.health_check_path || "—"}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTarget(tg.target_group_arn)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>,
                  isExpanded ? (
                    <TableRow key={`${tg.target_group_arn}-detail`} className="bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={canMutate ? 7 : 6} className="py-3">
                        <TargetGroupDetail instanceId={instanceId} tg={tg} canMutate={canMutate} />
                      </TableCell>
                    </TableRow>
                  ) : null,
                ].filter(Boolean)
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create TG Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Target Group</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={tgName} onChange={(e) => setTgName(e.target.value)} placeholder="my-target-group" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Protocol</Label>
                <Select value={tgProtocol} onValueChange={(v) => v && setTgProtocol(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTTP">HTTP</SelectItem>
                    <SelectItem value="HTTPS">HTTPS</SelectItem>
                    <SelectItem value="TCP">TCP</SelectItem>
                    <SelectItem value="TLS">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Port</Label>
                <Input type="number" value={tgPort} onChange={(e) => setTgPort(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Target Type</Label>
              <Select value={tgTargetType} onValueChange={(v) => v && setTgTargetType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instance">Instance</SelectItem>
                  <SelectItem value="ip">IP</SelectItem>
                  <SelectItem value="lambda">Lambda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>VPC ID (optional)</Label>
              <Input value={tgVpc} onChange={(e) => setTgVpc(e.target.value)} placeholder="vpc-xxxxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label>Health Check Path (optional)</Label>
              <Input value={tgHcPath} onChange={(e) => setTgHcPath(e.target.value)} placeholder="/health" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!tgName || !tgPort || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Target Group</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete this target group?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Target Group Detail (targets + health) ──────────────────────────────────

function TargetGroupDetail({ instanceId, tg, canMutate }: { instanceId: string; tg: TargetGroup; canMutate: boolean }) {
  const qc = useQueryClient()
  const [registerOpen, setRegisterOpen] = useState(false)
  const [targetId, setTargetId] = useState("")
  const [targetPort, setTargetPort] = useState("")

  const { data: health = [], isLoading } = useQuery({
    queryKey: ["elbv2-tg-health", instanceId, tg.target_group_arn],
    queryFn: async () => {
      const r = await instancesApi.getTargetHealth(instanceId, tg.target_group_arn)
      return r.data as TargetHealth[]
    },
  })

  const registerMutation = useMutation({
    mutationFn: () => {
      const target: Record<string, unknown> = { id: targetId }
      if (targetPort) target.port = parseInt(targetPort)
      return instancesApi.registerTargets(instanceId, tg.target_group_arn, { targets: [target] })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-tg-health", instanceId, tg.target_group_arn] })
      setRegisterOpen(false)
      setTargetId(""); setTargetPort("")
      toast.success("Target registered")
    },
    onError: () => toast.error("Failed to register target"),
  })

  const deregisterMutation = useMutation({
    mutationFn: (id: string) =>
      instancesApi.deregisterTargets(instanceId, tg.target_group_arn, { targets: [{ id }] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elbv2-tg-health", instanceId, tg.target_group_arn] })
      toast.success("Target deregistered")
    },
    onError: () => toast.error("Failed to deregister target"),
  })

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-medium">Registered Targets</p>
        {canMutate && (
          <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setRegisterOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Register Targets
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-10" />
      ) : health.length === 0 ? (
        <p className="text-muted-foreground">No registered targets</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Target ID</TableHead>
              <TableHead className="text-xs">Port</TableHead>
              <TableHead className="text-xs">Health</TableHead>
              <TableHead className="text-xs">Reason</TableHead>
              {canMutate && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {health.map((h) => (
              <TableRow key={h.target_id}>
                <TableCell className="font-mono text-xs">{h.target_id}</TableCell>
                <TableCell className="text-xs">{h.target_port}</TableCell>
                <TableCell>{healthBadge(h.health_state)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{h.health_reason || "—"}</TableCell>
                {canMutate && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deregisterMutation.mutate(h.target_id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register Target</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Target ID (instance ID / IP)</Label>
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="i-xxxxxxxxxxxxxxxxx" />
            </div>
            <div className="space-y-1">
              <Label>Port (optional)</Label>
              <Input type="number" value={targetPort} onChange={(e) => setTargetPort(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button onClick={() => registerMutation.mutate()} disabled={!targetId || registerMutation.isPending}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
