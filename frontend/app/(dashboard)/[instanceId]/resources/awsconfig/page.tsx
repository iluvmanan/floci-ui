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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Plus, Trash2, Play, Square } from "lucide-react"
import { toast } from "sonner"

interface Recorder {
  name: string
  role_arn: string
  all_supported: boolean
  include_global_resource_types: boolean
  recording: boolean
  last_status: string
  last_error_code: string
  last_status_change_time: string
}

interface Rule {
  config_rule_name: string
  config_rule_arn: string
  config_rule_state: string
  description: string
  source: { owner: string; source_identifier: string }
}

interface Compliance {
  config_rule_name: string
  compliance: { compliance_type: string; compliance_contributor_count: Record<string, unknown> }
}

interface DiscoveredResource {
  resource_type: string
  resource_id: string
  resource_name: string
}

function complianceBadge(type: string): "default" | "secondary" | "destructive" | "outline" {
  if (type === "COMPLIANT") return "default"
  if (type === "NON_COMPLIANT") return "destructive"
  if (type === "INSUFFICIENT_DATA") return "outline"
  return "secondary"
}

// ─── Recorder Tab ──────────────────────────────────────────────────────────────

function RecorderTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [setupOpen, setSetupOpen] = useState(false)
  const [name, setName] = useState("default")
  const [roleArn, setRoleArn] = useState("")
  const [allSupported, setAllSupported] = useState(true)
  const [includeGlobal, setIncludeGlobal] = useState(true)

  const { data: recorders = [], isLoading } = useQuery({
    queryKey: ["config-recorders", instanceId],
    queryFn: () => instancesApi.listConfigRecorders(instanceId).then((r) => r.data as Recorder[]),
  })

  const putMutation = useMutation({
    mutationFn: () =>
      instancesApi.putConfigRecorder(instanceId, {
        name,
        role_arn: roleArn,
        recording_group: { all_supported: allSupported, include_global_resource_types: includeGlobal },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-recorders", instanceId] })
      setSetupOpen(false)
      toast.success("Recorder configured")
    },
    onError: () => toast.error("Failed to configure recorder"),
  })

  const startMutation = useMutation({
    mutationFn: (n: string) => instancesApi.startConfigRecorder(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-recorders", instanceId] })
      toast.success("Recorder started")
    },
    onError: () => toast.error("Failed to start recorder"),
  })

  const stopMutation = useMutation({
    mutationFn: (n: string) => instancesApi.stopConfigRecorder(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-recorders", instanceId] })
      toast.success("Recorder stopped")
    },
    onError: () => toast.error("Failed to stop recorder"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Configuration Recorder</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setSetupOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Configure Recorder
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-24" />
      ) : recorders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No configuration recorder set up</p>
      ) : (
        recorders.map((r) => (
          <div key={r.name} className="border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono">{r.name}</span>
              <Badge variant={r.recording ? "default" : "outline"}>{r.recording ? "Recording" : "Stopped"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono break-all">{r.role_arn}</p>
            <p className="text-xs text-muted-foreground">
              All supported: {r.all_supported ? "Yes" : "No"} · Global resources: {r.include_global_resource_types ? "Yes" : "No"}
            </p>
            {r.last_status && <p className="text-xs text-muted-foreground">Last status: {r.last_status}</p>}
            {canMutate && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={r.recording} onClick={() => startMutation.mutate(r.name)}>
                  <Play className="h-3.5 w-3.5 mr-1" /> Start
                </Button>
                <Button size="sm" variant="outline" disabled={!r.recording} onClick={() => stopMutation.mutate(r.name)}>
                  <Square className="h-3.5 w-3.5 mr-1" /> Stop
                </Button>
              </div>
            )}
          </div>
        ))
      )}

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Configure Recorder</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>IAM Role ARN</Label>
              <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
            </div>
            <div className="flex items-center justify-between">
              <Label>Record all supported resource types</Label>
              <Switch checked={allSupported} onCheckedChange={setAllSupported} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Include global resource types</Label>
              <Switch checked={includeGlobal} onCheckedChange={setIncludeGlobal} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>Cancel</Button>
            <Button onClick={() => putMutation.mutate()} disabled={!name || !roleArn || putMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [addOpen, setAddOpen] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [sourceType, setSourceType] = useState<"AWS" | "CUSTOM_LAMBDA">("AWS")
  const [sourceIdentifier, setSourceIdentifier] = useState("")
  const [description, setDescription] = useState("")

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["config-rules", instanceId],
    queryFn: () => instancesApi.listConfigRules(instanceId).then((r) => r.data as Rule[]),
  })

  const { data: compliance = [] } = useQuery({
    queryKey: ["config-compliance", instanceId],
    queryFn: () => instancesApi.getConfigCompliance(instanceId).then((r) => r.data as Compliance[]),
    enabled: rules.length > 0,
  })

  const complianceByRule = new Map(compliance.map((c) => [c.config_rule_name, c.compliance.compliance_type]))

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.putConfigRule(instanceId, {
        config_rule_name: ruleName,
        description: description || undefined,
        source: { owner: sourceType, source_identifier: sourceIdentifier },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-rules", instanceId] })
      setAddOpen(false); setRuleName(""); setSourceIdentifier(""); setDescription("")
      toast.success("Rule added")
    },
    onError: () => toast.error("Failed to add rule"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteConfigRule(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config-rules", instanceId] })
      toast.success("Rule deleted")
    },
    onError: () => toast.error("Failed to delete rule"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Config Rules ({rules.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Rule
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
                <TableHead>Rule Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Compliance</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No rules found</TableCell></TableRow>
              ) : rules.map((r) => (
                <TableRow key={r.config_rule_name}>
                  <TableCell className="font-mono text-sm">{r.config_rule_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.source.owner === "AWS" ? "AWS Managed" : "Custom Lambda"}</Badge>
                    <span className="block text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{r.source.source_identifier}</span>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{r.config_rule_state}</Badge></TableCell>
                  <TableCell>
                    {complianceByRule.has(r.config_rule_name) ? (
                      <Badge variant={complianceBadge(complianceByRule.get(r.config_rule_name)!)}>
                        {complianceByRule.get(r.config_rule_name)}
                      </Badge>
                    ) : (
                      <Badge variant="outline">UNKNOWN</Badge>
                    )}
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(r.config_rule_name)}>
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Config Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Rule Name</Label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => v && setSourceType(v as "AWS" | "CUSTOM_LAMBDA")}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AWS">AWS Managed Rule</SelectItem>
                  <SelectItem value="CUSTOM_LAMBDA">Custom Lambda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{sourceType === "AWS" ? "Managed Rule Identifier" : "Lambda Function ARN"}</Label>
              <Input
                value={sourceIdentifier}
                onChange={(e) => setSourceIdentifier(e.target.value)}
                className="mt-1"
                placeholder={sourceType === "AWS" ? "S3_BUCKET_PUBLIC_READ_PROHIBITED" : "arn:aws:lambda:..."}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!ruleName || !sourceIdentifier || createMutation.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Resource Inventory Tab ─────────────────────────────────────────────────────

const COMMON_RESOURCE_TYPES = [
  "AWS::EC2::Instance",
  "AWS::S3::Bucket",
  "AWS::IAM::Role",
  "AWS::EC2::SecurityGroup",
  "AWS::EC2::VPC",
  "AWS::RDS::DBInstance",
  "AWS::Lambda::Function",
]

function ResourceInventoryTab({ instanceId }: { instanceId: string }) {
  const [resourceType, setResourceType] = useState(COMMON_RESOURCE_TYPES[0])

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["config-resources", instanceId, resourceType],
    queryFn: () => instancesApi.listDiscoveredResources(instanceId, resourceType).then((r) => r.data as DiscoveredResource[]),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-sm">Resource Type</Label>
        <Select value={resourceType} onValueChange={(v) => v && setResourceType(v)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {COMMON_RESOURCE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground text-sm h-24">No resources discovered</TableCell></TableRow>
              ) : resources.map((r, idx) => (
                <TableRow key={`${r.resource_id}-${idx}`}>
                  <TableCell className="text-sm">{r.resource_type}</TableCell>
                  <TableCell className="font-mono text-xs">{r.resource_id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.resource_name || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AWSConfigPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">AWS Config</h2>
      <Tabs defaultValue="recorder">
        <TabsList>
          <TabsTrigger value="recorder">Recorder</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="inventory">Resource Inventory</TabsTrigger>
        </TabsList>
        <TabsContent value="recorder" className="pt-3">
          <RecorderTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="rules" className="pt-3">
          <RulesTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="inventory" className="pt-3">
          <ResourceInventoryTab instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
