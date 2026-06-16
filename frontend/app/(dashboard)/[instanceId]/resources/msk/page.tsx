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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2, Copy } from "lucide-react"
import { toast } from "sonner"

interface Cluster {
  cluster_arn: string
  cluster_name: string
  cluster_type: string
  state: string
  current_version: string
  created_at: string
  cluster_info: Record<string, unknown>
}

interface BootstrapBrokers {
  bootstrap_broker_string: string
  bootstrap_broker_string_tls?: string | null
  bootstrap_broker_string_sasl_iam?: string | null
}

function stateBadge(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "ACTIVE") return "default"
  if (state === "CREATING" || state === "UPDATING") return "secondary"
  if (state === "FAILED" || state === "DELETING") return "destructive"
  return "outline"
}

function CopyField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 break-all">{value}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => { navigator.clipboard.writeText(value); toast.success("Copied") }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function ClusterDetailDialog({ instanceId, cluster, onClose }: { instanceId: string; cluster: Cluster; onClose: () => void }) {
  const { data: brokers, isLoading } = useQuery({
    queryKey: ["msk-brokers", instanceId, cluster.cluster_arn],
    queryFn: () => instancesApi.getMSKBootstrapBrokers(instanceId, cluster.cluster_arn).then((r) => r.data as BootstrapBrokers),
  })

  const info = cluster.cluster_info as Record<string, unknown>
  const provisioned = info?.Provisioned as Record<string, unknown> | undefined
  const serverless = info?.Serverless as Record<string, unknown> | undefined

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cluster.cluster_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-muted-foreground">Type:</span> {cluster.cluster_type}</div>
            <div><span className="text-muted-foreground">State:</span> {cluster.state}</div>
            <div><span className="text-muted-foreground">Version:</span> {cluster.current_version || "—"}</div>
            <div><span className="text-muted-foreground">Created:</span> {cluster.created_at ? new Date(cluster.created_at).toLocaleString() : "—"}</div>
          </div>

          {provisioned && (
            <div className="text-xs space-y-1">
              <p className="text-muted-foreground">Kafka Version: {String(provisioned.CurrentBrokerSoftwareInfo ?? "")}</p>
              <p className="text-muted-foreground">Broker Nodes: {String(provisioned.NumberOfBrokerNodes ?? "")}</p>
            </div>
          )}
          {serverless && (
            <div className="text-xs text-muted-foreground">Serverless cluster</div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Bootstrap Brokers</p>
            {isLoading ? (
              <Skeleton className="h-16" />
            ) : (
              <>
                <CopyField label="Plaintext" value={brokers?.bootstrap_broker_string} />
                <CopyField label="TLS" value={brokers?.bootstrap_broker_string_tls} />
                <CopyField label="SASL/IAM" value={brokers?.bootstrap_broker_string_sasl_iam} />
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function MSKPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [clusterType, setClusterType] = useState<"PROVISIONED" | "SERVERLESS">("PROVISIONED")
  const [clusterName, setClusterName] = useState("")
  const [kafkaVersion, setKafkaVersion] = useState("3.5.1")
  const [instanceType, setInstanceType] = useState("kafka.m5.large")
  const [brokerCount, setBrokerCount] = useState(3)
  const [subnetIds, setSubnetIds] = useState("")
  const [securityGroupIds, setSecurityGroupIds] = useState("")

  const { data: clusters = [], isLoading } = useQuery({
    queryKey: ["msk-clusters", instanceId],
    queryFn: () => instancesApi.listMSKClusters(instanceId).then((r) => r.data as Cluster[]),
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const subnets = subnetIds.split(",").map((s) => s.trim()).filter(Boolean)
      const sgs = securityGroupIds.split(",").map((s) => s.trim()).filter(Boolean)
      if (clusterType === "SERVERLESS") {
        return instancesApi.createMSKCluster(instanceId, {
          cluster_name: clusterName,
          cluster_type: "SERVERLESS",
          serverless: {
            vpc_configs: [{ subnet_ids: subnets, security_group_ids: sgs.length ? sgs : undefined }],
          },
        })
      }
      return instancesApi.createMSKCluster(instanceId, {
        cluster_name: clusterName,
        cluster_type: "PROVISIONED",
        provisioned: {
          broker_node_group_info: {
            instance_type: instanceType,
            client_subnets: subnets,
            security_groups: sgs.length ? sgs : undefined,
          },
          kafka_version: kafkaVersion,
          number_of_broker_nodes: brokerCount,
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msk-clusters", instanceId] })
      setCreateOpen(false)
      setClusterName(""); setSubnetIds(""); setSecurityGroupIds("")
      toast.success("Cluster creation started")
    },
    onError: () => toast.error("Failed to create cluster"),
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteMSKCluster(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["msk-clusters", instanceId] })
      toast.success("Cluster deletion started")
    },
    onError: () => toast.error("Failed to delete cluster"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Managed Streaming for Kafka (MSK)</h2>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Cluster
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
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No clusters found</TableCell></TableRow>
              ) : clusters.map((c) => (
                <TableRow key={c.cluster_arn} className="cursor-pointer" onClick={() => setSelectedCluster(c)}>
                  <TableCell className="font-mono text-sm">{c.cluster_name}</TableCell>
                  <TableCell><Badge variant="outline">{c.cluster_type === "SERVERLESS" ? "Serverless" : "Provisioned"}</Badge></TableCell>
                  <TableCell><Badge variant={stateBadge(c.state)}>{c.state}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(c.cluster_arn)}>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create MSK Cluster</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">Cluster Type</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="clusterType" checked={clusterType === "PROVISIONED"} onChange={() => setClusterType("PROVISIONED")} />
                  Provisioned
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="clusterType" checked={clusterType === "SERVERLESS"} onChange={() => setClusterType("SERVERLESS")} />
                  Serverless
                </label>
              </div>
            </div>
            <div>
              <Label>Cluster Name</Label>
              <Input value={clusterName} onChange={(e) => setClusterName(e.target.value)} className="mt-1" />
            </div>
            {clusterType === "PROVISIONED" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kafka Version</Label>
                    <Input value={kafkaVersion} onChange={(e) => setKafkaVersion(e.target.value)} className="mt-1" />
                  </div>
                  <div>
                    <Label>Instance Type</Label>
                    <Input value={instanceType} onChange={(e) => setInstanceType(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Broker Count</Label>
                  <Input type="number" min={1} value={brokerCount} onChange={(e) => setBrokerCount(Number(e.target.value))} className="mt-1" />
                </div>
              </>
            ) : null}
            <div>
              <Label>Subnet IDs (comma-separated)</Label>
              <Input value={subnetIds} onChange={(e) => setSubnetIds(e.target.value)} className="mt-1" placeholder="subnet-abc, subnet-def" />
            </div>
            <div>
              <Label>Security Group IDs (optional, comma-separated)</Label>
              <Input value={securityGroupIds} onChange={(e) => setSecurityGroupIds(e.target.value)} className="mt-1" placeholder="sg-abc" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!clusterName || !subnetIds || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCluster && (
        <ClusterDetailDialog instanceId={instanceId} cluster={selectedCluster} onClose={() => setSelectedCluster(null)} />
      )}
    </div>
  )
}
