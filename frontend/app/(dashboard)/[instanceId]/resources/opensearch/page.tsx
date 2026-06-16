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
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

interface OpenSearchDomain {
  domain_name: string
  arn: string
  created: boolean
  deleted: boolean
  endpoint: string
  processing: boolean
  engine_version: string
  cluster_config: { InstanceType?: string; InstanceCount?: number }
  ebs_options: Record<string, unknown>
}

interface DomainDetail extends OpenSearchDomain {
  access_policies: string
}

function statusBadge(d: OpenSearchDomain): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (d.deleted) return { label: "Deleting", variant: "destructive" }
  if (d.processing) return { label: "Processing", variant: "secondary" }
  if (d.created) return { label: "Active", variant: "default" }
  return { label: "Creating", variant: "secondary" }
}

export default function OpenSearchPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [domainName, setDomainName] = useState("")
  const [engineVersion, setEngineVersion] = useState("OpenSearch_2.11")
  const [instanceType, setInstanceType] = useState("t3.small.search")
  const [instanceCount, setInstanceCount] = useState(1)
  const [volumeSizeGb, setVolumeSizeGb] = useState(10)

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)

  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["opensearch-domains", instanceId],
    queryFn: () => instancesApi.listOpenSearchDomains(instanceId).then((r) => r.data as OpenSearchDomain[]),
  })

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["opensearch-domain-detail", instanceId, selectedDomain],
    queryFn: () => instancesApi.describeOpenSearchDomain(instanceId, selectedDomain as string).then((r) => r.data as DomainDetail),
    enabled: !!selectedDomain,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createOpenSearchDomain(instanceId, {
        domain_name: domainName,
        engine_version: engineVersion,
        cluster_config: { instance_type: instanceType, instance_count: instanceCount },
        volume_size_gb: volumeSizeGb,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opensearch-domains", instanceId] })
      setCreateOpen(false)
      setDomainName("")
      toast.success("Domain creation started")
    },
    onError: () => toast.error("Failed to create domain"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteOpenSearchDomain(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opensearch-domains", instanceId] })
      setSelectedDomain(null)
      toast.success("Domain deletion started")
    },
    onError: () => toast.error("Failed to delete domain"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">OpenSearch</h2>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Domain
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
                <TableHead>Engine Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Instance Type</TableHead>
                <TableHead>Nodes</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 7 : 6} className="text-center text-muted-foreground text-sm h-24">No domains found</TableCell></TableRow>
              ) : domains.map((d) => {
                const badge = statusBadge(d)
                return (
                  <TableRow key={d.domain_name} className="cursor-pointer" onClick={() => setSelectedDomain(d.domain_name)}>
                    <TableCell className="font-mono text-sm">{d.domain_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.engine_version}</TableCell>
                    <TableCell><Badge variant={badge.variant}>{badge.label}</Badge></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">{d.endpoint || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.cluster_config?.InstanceType || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.cluster_config?.InstanceCount ?? "—"}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(d.domain_name)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Domain Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Domain</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Domain Name</Label>
              <Input value={domainName} onChange={(e) => setDomainName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Engine Version</Label>
              <Select value={engineVersion} onValueChange={(v) => v && setEngineVersion(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OpenSearch_2.11">OpenSearch 2.11</SelectItem>
                  <SelectItem value="OpenSearch_2.7">OpenSearch 2.7</SelectItem>
                  <SelectItem value="OpenSearch_1.3">OpenSearch 1.3</SelectItem>
                  <SelectItem value="Elasticsearch_7.10">Elasticsearch 7.10</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Instance Type</Label>
                <Select value={instanceType} onValueChange={(v) => v && setInstanceType(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t3.small.search">t3.small.search</SelectItem>
                    <SelectItem value="t3.medium.search">t3.medium.search</SelectItem>
                    <SelectItem value="m6g.large.search">m6g.large.search</SelectItem>
                    <SelectItem value="r6g.large.search">r6g.large.search</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Instance Count</Label>
                <Input type="number" min={1} value={instanceCount} onChange={(e) => setInstanceCount(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>EBS Volume Size (GB)</Label>
              <Input type="number" min={10} value={volumeSizeGb} onChange={(e) => setVolumeSizeGb(Number(e.target.value))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!domainName || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Domain Detail Dialog */}
      <Dialog open={!!selectedDomain} onOpenChange={() => setSelectedDomain(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{selectedDomain}</DialogTitle></DialogHeader>
          {detailLoading ? (
            <Skeleton className="h-48" />
          ) : detail ? (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <Label className="text-xs text-muted-foreground">Endpoint</Label>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs break-all flex-1">{detail.endpoint || "—"}</p>
                  {detail.endpoint && (
                    <>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(detail.endpoint); toast.success("Copied") }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <a
                        href={`https://${detail.endpoint}/_dashboards`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Processing</Label>
                <p className="text-sm">{detail.processing ? "Yes" : "No"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Cluster Config</Label>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(detail.cluster_config, null, 2)}</pre>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">EBS Options</Label>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(detail.ebs_options, null, 2)}</pre>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Access Policies</Label>
                <pre className="text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{detail.access_policies || "—"}</pre>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            {canMutate && selectedDomain && (
              <Button variant="destructive" onClick={() => deleteMutation.mutate(selectedDomain)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Domain
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedDomain(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
