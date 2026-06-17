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
import { Textarea } from "@/components/ui/textarea"
import { Copy, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Origin {
  Id: string
  DomainName: string
}

interface CacheBehavior {
  TargetOriginId?: string
  ViewerProtocolPolicy?: string
  Compress?: boolean
  AllowedMethods?: { Quantity: number; Items: string[] }
}

interface Distribution {
  id: string
  domain_name: string
  status: string
  origins: Origin[]
  default_cache_behavior: CacheBehavior
  price_class: string
  enabled: boolean
  last_modified_time: string
  aliases: string[]
}

interface Invalidation {
  id: string
  status: string
  create_time: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    Deployed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    InProgress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    Completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

function enabledBadge(enabled: boolean) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${enabled ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"}`}>
      {enabled ? "Enabled" : "Disabled"}
    </span>
  )
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CloudFrontPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Create form state
  const [originDomain, setOriginDomain] = useState("")
  const [originId, setOriginId] = useState("")
  const [viewerPolicy, setViewerPolicy] = useState("redirect-to-https")
  const [priceClass, setPriceClass] = useState("PriceClass_All")
  const [aliases, setAliases] = useState("")
  const [comment, setComment] = useState("")

  const { data: distributions = [], isLoading, refetch } = useQuery({
    queryKey: ["cf-distributions", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listDistributions(instanceId)
      return r.data as Distribution[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        origins: [{ id: originId, domain_name: originDomain }],
        default_cache_behavior: {
          target_origin_id: originId,
          viewer_protocol_policy: viewerPolicy,
        },
        price_class: priceClass,
        comment: comment || undefined,
      }
      const aliasList = aliases.split(",").map((a) => a.trim()).filter(Boolean)
      if (aliasList.length > 0) body.aliases = aliasList
      return instancesApi.createDistribution(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-distributions", instanceId] })
      setCreateOpen(false)
      setOriginDomain(""); setOriginId(""); setViewerPolicy("redirect-to-https")
      setPriceClass("PriceClass_All"); setAliases(""); setComment("")
      toast.success("Distribution created")
    },
    onError: () => toast.error("Failed to create distribution"),
  })

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ distId, enabled }: { distId: string; enabled: boolean }) =>
      instancesApi.updateDistribution(instanceId, distId, { enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-distributions", instanceId] })
      toast.success("Distribution updated")
    },
    onError: () => toast.error("Failed to update distribution"),
  })

  const deleteMutation = useMutation({
    mutationFn: (distId: string) => instancesApi.deleteDistribution(instanceId, distId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-distributions", instanceId] })
      setDeleteTarget(null)
      if (selected === deleteTarget) setSelected(null)
      toast.success("Distribution deleted")
    },
    onError: () => {
      toast.error("Delete failed — AWS requires the distribution to be disabled and fully deployed first")
      setDeleteTarget(null)
    },
  })

  const selectedDist = distributions.find((d) => d.id === selected)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CloudFront</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Distribution
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Domain Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origins</TableHead>
                <TableHead>Enabled</TableHead>
                {canMutate && <TableHead className="w-48" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">
                    No distributions found
                  </TableCell>
                </TableRow>
              ) : (
                distributions.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelected(d.id)}>
                    <TableCell className="font-mono text-xs">{d.id}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{d.domain_name}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(d.domain_name)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(`https://${d.domain_name}`, "_blank")}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                    <TableCell className="text-xs">{d.origins?.length ?? 0}</TableCell>
                    <TableCell>{enabledBadge(d.enabled)}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-xs px-2"
                            disabled={toggleEnabledMutation.isPending}
                            onClick={() => toggleEnabledMutation.mutate({ distId: d.id, enabled: !d.enabled })}
                          >
                            {d.enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={d.enabled}
                            title={d.enabled ? "Disable the distribution first" : "Delete"}
                            onClick={() => setDeleteTarget(d.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail Panel */}
      {selectedDist && (
        <DistributionDetail
          instanceId={instanceId}
          dist={selectedDist}
          canMutate={!!canMutate}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Create Distribution Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Distribution</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Origin Domain Name</Label>
              <Input placeholder="my-bucket.s3.amazonaws.com" value={originDomain} onChange={(e) => setOriginDomain(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Origin ID</Label>
              <Input placeholder="origin-1" value={originId} onChange={(e) => setOriginId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Viewer Protocol Policy</Label>
              <Select value={viewerPolicy} onValueChange={(v) => v && setViewerPolicy(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow-all">Allow All (HTTP and HTTPS)</SelectItem>
                  <SelectItem value="redirect-to-https">Redirect HTTP to HTTPS</SelectItem>
                  <SelectItem value="https-only">HTTPS Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Price Class</Label>
              <Select value={priceClass} onValueChange={(v) => v && setPriceClass(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PriceClass_All">All Edge Locations (best performance)</SelectItem>
                  <SelectItem value="PriceClass_200">US, Canada, Europe, Asia, Middle East, Africa</SelectItem>
                  <SelectItem value="PriceClass_100">US, Canada, Europe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Alternate Domain Names (CNAMEs, comma-separated, optional)</Label>
              <Input placeholder="www.example.com, example.com" value={aliases} onChange={(e) => setAliases(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Comment (optional)</Label>
              <Input value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!originDomain || !originId || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Distribution</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete distribution <span className="font-mono font-medium">{deleteTarget}</span>? AWS requires
            the distribution to be disabled and fully deployed before it can be deleted.
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

// ─── Distribution Detail Panel ───────────────────────────────────────────────

function DistributionDetail({
  instanceId,
  dist,
  canMutate,
  onClose,
}: {
  instanceId: string
  dist: Distribution
  canMutate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [invalidationOpen, setInvalidationOpen] = useState(false)
  const [paths, setPaths] = useState("/*")

  const { data: invalidations = [], isLoading } = useQuery({
    queryKey: ["cf-invalidations", instanceId, dist.id],
    queryFn: async () => {
      const r = await instancesApi.listInvalidations(instanceId, dist.id)
      return r.data as Invalidation[]
    },
  })

  const createInvalidationMutation = useMutation({
    mutationFn: () => {
      const pathList = paths.split("\n").map((p) => p.trim()).filter(Boolean)
      return instancesApi.createInvalidation(instanceId, dist.id, { paths: pathList })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cf-invalidations", instanceId, dist.id] })
      setInvalidationOpen(false)
      setPaths("/*")
      toast.success("Invalidation created")
    },
    onError: () => toast.error("Failed to create invalidation"),
  })

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium font-mono">{dist.id}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="behaviors">Behaviors</TabsTrigger>
          <TabsTrigger value="invalidations">Invalidations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-3 space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Domain Name</span>
            <span className="font-mono">{dist.domain_name}</span>
            <span className="text-muted-foreground">Status</span>
            <span>{statusBadge(dist.status)}</span>
            <span className="text-muted-foreground">Price Class</span>
            <span>{dist.price_class}</span>
            <span className="text-muted-foreground">Aliases</span>
            <span>{dist.aliases?.length ? dist.aliases.join(", ") : "—"}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-3 mb-1">Origins</p>
            {dist.origins?.length === 0 ? (
              <p className="text-xs text-muted-foreground">No origins</p>
            ) : (
              <ul className="space-y-1">
                {dist.origins?.map((o) => (
                  <li key={o.Id} className="text-xs font-mono bg-muted/40 rounded px-2 py-1">
                    {o.Id} — {o.DomainName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="behaviors" className="pt-3 space-y-2 text-sm">
          {dist.default_cache_behavior ? (
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Target Origin</span>
              <span className="font-mono">{dist.default_cache_behavior.TargetOriginId}</span>
              <span className="text-muted-foreground">Viewer Protocol Policy</span>
              <span>{dist.default_cache_behavior.ViewerProtocolPolicy}</span>
              <span className="text-muted-foreground">Compress</span>
              <span>{dist.default_cache_behavior.Compress ? "Yes" : "No"}</span>
              <span className="text-muted-foreground">Allowed Methods</span>
              <span>{dist.default_cache_behavior.AllowedMethods?.Items?.join(", ") || "—"}</span>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No default cache behavior</p>
          )}
        </TabsContent>

        <TabsContent value="invalidations" className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{invalidations.length} invalidation{invalidations.length !== 1 ? "s" : ""}</span>
            {canMutate && (
              <Button size="sm" variant="outline" onClick={() => setInvalidationOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Invalidation
              </Button>
            )}
          </div>
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invalidations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground text-sm h-16">No invalidations</TableCell>
                  </TableRow>
                ) : invalidations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {inv.create_time ? new Date(inv.create_time).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Invalidation Dialog */}
      <Dialog open={invalidationOpen} onOpenChange={setInvalidationOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Invalidation</DialogTitle></DialogHeader>
          <div className="space-y-1">
            <Label>Paths (one per line)</Label>
            <Textarea
              className="font-mono text-xs min-h-32"
              value={paths}
              onChange={(e) => setPaths(e.target.value)}
              placeholder={"/*\n/images/*"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvalidationOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createInvalidationMutation.mutate()}
              disabled={!paths.trim() || createInvalidationMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
