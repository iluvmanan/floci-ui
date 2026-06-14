"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EC2Instance {
  instance_id: string
  name: string
  state: string
  instance_type: string
  public_ip: string
  private_ip: string
  key_name: string
  availability_zone: string
  launch_time: string
  vpc_id: string
  subnet_id: string
  security_groups: { group_id: string; group_name: string }[]
  image_id: string
  iam_instance_profile: string
}

interface KeyPair {
  key_pair_id: string
  name: string
  fingerprint: string
  created_at: string
}

interface SecurityGroup {
  group_id: string
  name: string
  description: string
  vpc_id: string
  inbound_rules_count: number
  outbound_rules_count: number
}

interface SGRule {
  protocol: string
  from_port: number
  to_port: number
  cidr?: string
  source_group?: string
  description: string
}

interface Volume {
  volume_id: string
  size: number
  state: string
  volume_type: string
  availability_zone: string
  encrypted: boolean
  attached_to: string | null
  device: string | null
  create_time: string
}

interface ElasticIP {
  allocation_id: string
  public_ip: string
  association_id: string | null
  instance_id: string | null
  domain: string
}

interface Subnet {
  subnet_id: string
  vpc_id: string
  cidr: string
  availability_zone: string
  available_ips: number
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stateBadge(state: string) {
  const variants: Record<string, string> = {
    running: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    stopped: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    stopping: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    "shutting-down": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    terminated: "bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400",
    available: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    "in-use": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    deleting: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        variants[state] ?? "bg-gray-100 text-gray-600"
      }`}
    >
      {state}
    </span>
  )
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EC2Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">EC2</h2>
      <Tabs defaultValue="instances">
        <TabsList>
          <TabsTrigger value="instances">Instances</TabsTrigger>
          <TabsTrigger value="key-pairs">Key Pairs</TabsTrigger>
          <TabsTrigger value="security-groups">Security Groups</TabsTrigger>
          <TabsTrigger value="volumes">Volumes</TabsTrigger>
          <TabsTrigger value="elastic-ips">Elastic IPs</TabsTrigger>
        </TabsList>
        <TabsContent value="instances" className="mt-4">
          <InstancesTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
        <TabsContent value="key-pairs" className="mt-4">
          <KeyPairsTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
        <TabsContent value="security-groups" className="mt-4">
          <SecurityGroupsTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
        <TabsContent value="volumes" className="mt-4">
          <VolumesTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
        <TabsContent value="elastic-ips" className="mt-4">
          <ElasticIPsTab instanceId={instanceId} canMutate={!!canMutate} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Instances Tab ────────────────────────────────────────────────────────────

function InstancesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [launchOpen, setLaunchOpen] = useState(false)
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null)
  const [connectTarget, setConnectTarget] = useState<string | null>(null)
  const [consoleTarget, setConsoleTarget] = useState<string | null>(null)

  const { data: instances = [], isLoading, refetch } = useQuery({
    queryKey: ["ec2-instances", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listEC2Instances(instanceId)
      return r.data as EC2Instance[]
    },
  })

  const { data: keyPairs = [] } = useQuery({
    queryKey: ["ec2-key-pairs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listKeyPairs(instanceId)
      return r.data as KeyPair[]
    },
  })

  const { data: securityGroups = [] } = useQuery({
    queryKey: ["ec2-security-groups", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listSecurityGroups(instanceId)
      return r.data as SecurityGroup[]
    },
  })

  const { data: subnets = [] } = useQuery({
    queryKey: ["ec2-subnets", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listSubnets(instanceId)
      return r.data as Subnet[]
    },
  })

  const startMutation = useMutation({
    mutationFn: (iid: string) => instancesApi.startEC2Instance(instanceId, iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-instances", instanceId] })
      toast.success("Instance starting")
    },
    onError: () => toast.error("Failed to start instance"),
  })

  const stopMutation = useMutation({
    mutationFn: (iid: string) => instancesApi.stopEC2Instance(instanceId, iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-instances", instanceId] })
      toast.success("Instance stopping")
    },
    onError: () => toast.error("Failed to stop instance"),
  })

  const rebootMutation = useMutation({
    mutationFn: (iid: string) => instancesApi.rebootEC2Instance(instanceId, iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-instances", instanceId] })
      toast.success("Instance rebooting")
    },
    onError: () => toast.error("Failed to reboot instance"),
  })

  const terminateMutation = useMutation({
    mutationFn: (iid: string) => instancesApi.terminateEC2Instance(instanceId, iid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-instances", instanceId] })
      setTerminateTarget(null)
      toast.success("Instance terminating")
    },
    onError: () => toast.error("Failed to terminate instance"),
  })

  function toggleRow(iid: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(iid)) next.delete(iid)
      else next.add(iid)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {instances.length} instance{instances.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setLaunchOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Launch Instance
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
                <TableHead className="w-8" />
                <TableHead>Instance ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Public IP</TableHead>
                <TableHead>AZ</TableHead>
                <TableHead>Key Pair</TableHead>
                <TableHead>Launch Time</TableHead>
                {canMutate && <TableHead className="w-64">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 10 : 9} className="text-center text-muted-foreground h-24">
                    No instances found
                  </TableCell>
                </TableRow>
              ) : (
                instances.map((inst) => {
                  const expanded = expandedRows.has(inst.instance_id)
                  const isRunning = inst.state === "running"
                  const isStopped = inst.state === "stopped"
                  const isTerminated = inst.state === "terminated"
                  return (
                    <>
                      <TableRow
                        key={inst.instance_id}
                        className="cursor-pointer hover:bg-accent/40"
                        onClick={() => toggleRow(inst.instance_id)}
                      >
                        <TableCell>
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{inst.instance_id}</TableCell>
                        <TableCell className="text-sm">{inst.name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{stateBadge(inst.state)}</TableCell>
                        <TableCell className="text-xs">{inst.instance_type}</TableCell>
                        <TableCell className="font-mono text-xs">{inst.public_ip || "—"}</TableCell>
                        <TableCell className="text-xs">{inst.availability_zone}</TableCell>
                        <TableCell className="text-xs">{inst.key_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {inst.launch_time ? new Date(inst.launch_time).toLocaleDateString() : "—"}
                        </TableCell>
                        {canMutate && (
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {!isTerminated && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  disabled={isRunning || startMutation.isPending}
                                  onClick={() => startMutation.mutate(inst.instance_id)}
                                >
                                  Start
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  disabled={isStopped || stopMutation.isPending}
                                  onClick={() => stopMutation.mutate(inst.instance_id)}
                                >
                                  Stop
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  disabled={isStopped || rebootMutation.isPending}
                                  onClick={() => rebootMutation.mutate(inst.instance_id)}
                                >
                                  Reboot
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2 text-destructive border-destructive/50"
                                  onClick={() => setTerminateTarget(inst.instance_id)}
                                >
                                  Terminate
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setConnectTarget(inst.instance_id)}
                                >
                                  Connect
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setConsoleTarget(inst.instance_id)}
                                >
                                  Console
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                      {expanded && (
                        <TableRow key={`${inst.instance_id}-expanded`} className="bg-muted/20">
                          <TableCell />
                          <TableCell colSpan={canMutate ? 9 : 8}>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs py-1">
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">AMI ID</span>
                                <span className="font-mono">{inst.image_id || "—"}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">VPC ID</span>
                                <span className="font-mono">{inst.vpc_id || "—"}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">Subnet ID</span>
                                <span className="font-mono">{inst.subnet_id || "—"}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">Private IP</span>
                                <span className="font-mono">{inst.private_ip || "—"}</span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">Security Groups</span>
                                <span>
                                  {inst.security_groups.length > 0
                                    ? inst.security_groups
                                        .map((sg) => `${sg.group_name} (${sg.group_id})`)
                                        .join(", ")
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <span className="text-muted-foreground w-32">IAM Profile</span>
                                <span className="font-mono truncate">{inst.iam_instance_profile || "—"}</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Launch Instance Dialog */}
      <LaunchInstanceDialog
        open={launchOpen}
        onClose={() => setLaunchOpen(false)}
        instanceId={instanceId}
        keyPairs={keyPairs}
        securityGroups={securityGroups}
        subnets={subnets}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["ec2-instances", instanceId] })
          setLaunchOpen(false)
        }}
      />

      {/* Terminate Confirmation */}
      <Dialog open={!!terminateTarget} onOpenChange={() => setTerminateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate Instance</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to terminate{" "}
            <span className="font-mono font-medium">{terminateTarget}</span>? This action cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={terminateMutation.isPending}
              onClick={() => terminateTarget && terminateMutation.mutate(terminateTarget)}
            >
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Dialog */}
      <ConnectDialog
        open={!!connectTarget}
        instanceId={connectTarget}
        flociInstanceId={instanceId}
        onClose={() => setConnectTarget(null)}
      />

      {/* Console Output Dialog */}
      <ConsoleOutputDialog
        open={!!consoleTarget}
        instanceId={consoleTarget}
        flociInstanceId={instanceId}
        onClose={() => setConsoleTarget(null)}
      />
    </div>
  )
}

// ─── Launch Instance Dialog ───────────────────────────────────────────────────

interface LaunchDialogProps {
  open: boolean
  onClose: () => void
  instanceId: string
  keyPairs: KeyPair[]
  securityGroups: SecurityGroup[]
  subnets: Subnet[]
  onSuccess: () => void
}

interface TagRow {
  key: string
  value: string
}

function LaunchInstanceDialog({
  open,
  onClose,
  instanceId,
  keyPairs,
  securityGroups,
  subnets,
  onSuccess,
}: LaunchDialogProps) {
  const [step, setStep] = useState(1)
  // Step 1
  const [name, setName] = useState("")
  const [amiId, setAmiId] = useState("")
  const [instanceType, setInstanceType] = useState("t3.micro")
  const [keyName, setKeyName] = useState("")
  // Step 2
  const [selectedSGs, setSelectedSGs] = useState<string[]>([])
  const [subnetId, setSubnetId] = useState("")
  // Step 3
  const [volumeSize, setVolumeSize] = useState("8")
  const [userData, setUserData] = useState("")
  const [iamArn, setIamArn] = useState("")
  // Step 4
  const [tags, setTags] = useState<TagRow[]>([{ key: "Name", value: name }])
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setName("")
      setAmiId("")
      setInstanceType("t3.micro")
      setKeyName("")
      setSelectedSGs([])
      setSubnetId("")
      setVolumeSize("8")
      setUserData("")
      setIamArn("")
      setTags([{ key: "Name", value: "" }])
    }
  }, [open])

  async function handleLaunch() {
    setIsPending(true)
    try {
      const body: Record<string, unknown> = {
        image_id: amiId,
        instance_type: instanceType,
      }
      if (keyName) body.key_name = keyName
      if (selectedSGs.length > 0) body.security_group_ids = selectedSGs
      if (subnetId) body.subnet_id = subnetId
      if (volumeSize && parseInt(volumeSize) > 0) body.volume_size = parseInt(volumeSize)
      if (userData) body.user_data = userData
      if (iamArn) body.iam_instance_profile_arn = iamArn
      const filteredTags = tags.filter((t) => t.key && t.value)
      if (filteredTags.length > 0) body.tags = filteredTags.map((t) => ({ Key: t.key, Value: t.value }))
      await instancesApi.launchEC2Instance(instanceId, body)
      toast.success("Instance launched successfully")
      onSuccess()
    } catch {
      toast.error("Failed to launch instance")
    } finally {
      setIsPending(false)
    }
  }

  function toggleSG(id: string) {
    setSelectedSGs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch EC2 Instance — Step {step} of 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="my-instance" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>AMI ID *</Label>
              <Input placeholder="ami-xxxxxxxxxxxxxxxxx" value={amiId} onChange={(e) => setAmiId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Instance Type</Label>
              <Select value={instanceType} onValueChange={(v) => v && setInstanceType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["t3.micro", "t3.small", "t3.medium", "t3.large", "m5.xlarge", "c5.xlarge", "r5.xlarge"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Key Pair</Label>
              <Select value={keyName} onValueChange={(v) => v && setKeyName(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select key pair (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {keyPairs.map((kp) => (
                    <SelectItem key={kp.name} value={kp.name}>{kp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Security Groups</Label>
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {securityGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">No security groups found</p>
                ) : (
                  securityGroups.map((sg) => (
                    <label key={sg.group_id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent/40 px-1 py-0.5 rounded">
                      <input
                        type="checkbox"
                        checked={selectedSGs.includes(sg.group_id)}
                        onChange={() => toggleSG(sg.group_id)}
                        className="rounded"
                      />
                      <span className="font-mono text-xs">{sg.group_id}</span>
                      <span className="text-muted-foreground truncate">{sg.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Subnet</Label>
              <Select value={subnetId} onValueChange={(v) => v && setSubnetId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subnet (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {subnets.map((s) => (
                    <SelectItem key={s.subnet_id} value={s.subnet_id}>
                      {s.subnet_id} ({s.availability_zone}) {s.name ? `— ${s.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Root Volume Size (GB)</Label>
              <Input
                type="number"
                min={1}
                value={volumeSize}
                onChange={(e) => setVolumeSize(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>User Data (optional)</Label>
              <Textarea
                className="font-mono text-xs min-h-24"
                placeholder="#!/bin/bash&#10;yum update -y"
                value={userData}
                onChange={(e) => setUserData(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>IAM Instance Profile ARN (optional)</Label>
              <Input
                placeholder="arn:aws:iam::123456789012:instance-profile/MyProfile"
                value={iamArn}
                onChange={(e) => setIamArn(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="space-y-2">
              {tags.map((tag, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    placeholder="Key"
                    className="h-7 text-xs"
                    value={tag.key}
                    onChange={(e) => {
                      const updated = [...tags]
                      updated[i] = { ...updated[i], key: e.target.value }
                      setTags(updated)
                    }}
                  />
                  <Input
                    placeholder="Value"
                    className="h-7 text-xs"
                    value={tag.value}
                    onChange={(e) => {
                      const updated = [...tags]
                      updated[i] = { ...updated[i], value: e.target.value }
                      setTags(updated)
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => setTags(tags.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTags([...tags, { key: "", value: "" }])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Tag
              </Button>
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs space-y-1">
              <p className="font-medium text-sm mb-2">Review</p>
              <p><span className="text-muted-foreground">AMI:</span> {amiId}</p>
              <p><span className="text-muted-foreground">Type:</span> {instanceType}</p>
              <p><span className="text-muted-foreground">Key Pair:</span> {keyName || "—"}</p>
              <p><span className="text-muted-foreground">Security Groups:</span> {selectedSGs.join(", ") || "—"}</p>
              <p><span className="text-muted-foreground">Subnet:</span> {subnetId || "—"}</p>
              <p><span className="text-muted-foreground">Volume:</span> {volumeSize} GB</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !amiId}>
              Next
            </Button>
          ) : (
            <Button onClick={handleLaunch} disabled={isPending}>
              {isPending ? "Launching…" : "Launch Instance"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Connect Dialog ───────────────────────────────────────────────────────────

function ConnectDialog({
  open,
  instanceId,
  flociInstanceId,
  onClose,
}: {
  open: boolean
  instanceId: string | null
  flociInstanceId: string
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ec2-connect", flociInstanceId, instanceId],
    queryFn: async () => {
      const r = await instancesApi.getEC2ConnectInfo(flociInstanceId, instanceId!)
      return r.data as { public_ip: string; key_name: string; ssh_command: string }
    },
    enabled: open && !!instanceId,
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to Instance</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-10" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Public IP</span>
              <span className="font-mono">{data?.public_ip || "—"}</span>
              <span className="text-muted-foreground">Key Pair</span>
              <span className="font-mono">{data?.key_name || "—"}</span>
            </div>
            {data?.ssh_command ? (
              <div className="space-y-1">
                <Label>SSH Command</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded p-2 font-mono break-all">
                    {data.ssh_command}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(data.ssh_command)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No SSH command available. The instance may not have a public IP or key pair assigned.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Ensure port 22 is open in the security group and the instance is running.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Console Output Dialog ────────────────────────────────────────────────────

function ConsoleOutputDialog({
  open,
  instanceId,
  flociInstanceId,
  onClose,
}: {
  open: boolean
  instanceId: string | null
  flociInstanceId: string
  onClose: () => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ec2-console", flociInstanceId, instanceId],
    queryFn: async () => {
      const r = await instancesApi.getEC2ConsoleOutput(flociInstanceId, instanceId!)
      return r.data as { output: string }
    },
    enabled: open && !!instanceId,
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Console Output — {instanceId}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <pre className="text-xs bg-black text-green-400 rounded-md p-3 max-h-96 overflow-auto whitespace-pre-wrap font-mono">
            {data?.output || "No console output available yet. Output may take a few minutes after launch."}
          </pre>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Key Pairs Tab ────────────────────────────────────────────────────────────

function KeyPairsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [newKeyName, setNewKeyName] = useState("")
  const [importName, setImportName] = useState("")
  const [importPublicKey, setImportPublicKey] = useState("")
  const [createdKeyMaterial, setCreatedKeyMaterial] = useState<string | null>(null)

  const { data: keyPairs = [], isLoading, refetch } = useQuery({
    queryKey: ["ec2-key-pairs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listKeyPairs(instanceId)
      return r.data as KeyPair[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createKeyPair(instanceId, newKeyName),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ec2-key-pairs", instanceId] })
      const data = r.data as { name: string; key_material: string }
      setCreatedKeyMaterial(data.key_material)
      setCreateOpen(false)
      setNewKeyName("")
      toast.success("Key pair created")
    },
    onError: () => toast.error("Failed to create key pair"),
  })

  const importMutation = useMutation({
    mutationFn: () => instancesApi.importKeyPair(instanceId, importName, importPublicKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-key-pairs", instanceId] })
      setImportOpen(false)
      setImportName("")
      setImportPublicKey("")
      toast.success("Key pair imported")
    },
    onError: () => toast.error("Failed to import key pair"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteKeyPair(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-key-pairs", instanceId] })
      setDeleteTarget(null)
      toast.success("Key pair deleted")
    },
    onError: () => toast.error("Failed to delete key pair"),
  })

  function downloadPEM(name: string, material: string) {
    const blob = new Blob([material], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${name}.pem`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{keyPairs.length} key pair{keyPairs.length !== 1 ? "s" : ""}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                Import Key Pair
              </Button>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Create Key Pair
              </Button>
            </>
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
                <TableHead>Name</TableHead>
                <TableHead>Key Pair ID</TableHead>
                <TableHead>Fingerprint</TableHead>
                <TableHead>Created At</TableHead>
                {canMutate && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {keyPairs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">
                    No key pairs found
                  </TableCell>
                </TableRow>
              ) : (
                keyPairs.map((kp) => (
                  <TableRow key={kp.key_pair_id}>
                    <TableCell className="font-medium">{kp.name}</TableCell>
                    <TableCell className="font-mono text-xs">{kp.key_pair_id}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-xs">
                      {kp.fingerprint || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {kp.created_at ? new Date(kp.created_at).toLocaleDateString() : "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(kp.name)}
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

      {/* Create Key Pair Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Key Pair</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Key Pair Name</Label>
            <Input
              placeholder="my-key-pair"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newKeyName && createMutation.mutate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newKeyName || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show .pem content dialog */}
      <Dialog open={!!createdKeyMaterial} onOpenChange={() => setCreatedKeyMaterial(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Private Key — Save Now</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            This key material is shown only once. Download or copy it now.
          </p>
          <Textarea
            className="font-mono text-xs min-h-48"
            readOnly
            value={createdKeyMaterial ?? ""}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => downloadPEM(newKeyName || "key", createdKeyMaterial ?? "")}
            >
              <Download className="h-4 w-4 mr-1" />
              Download .pem
            </Button>
            <Button onClick={() => setCreatedKeyMaterial(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Key Pair Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Key Pair</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Key Pair Name</Label>
              <Input
                placeholder="my-imported-key"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Public Key (OpenSSH format)</Label>
              <Textarea
                className="font-mono text-xs min-h-24"
                placeholder="ssh-rsa AAAA..."
                value={importPublicKey}
                onChange={(e) => setImportPublicKey(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={!importName || !importPublicKey || importMutation.isPending}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Key Pair</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete key pair <span className="font-mono font-medium">{deleteTarget}</span>? Any instances
            using this key pair will no longer be accessible via this key.
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

// ─── Security Groups Tab ──────────────────────────────────────────────────────

function SecurityGroupsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [addRuleOpen, setAddRuleOpen] = useState<string | null>(null)

  // Create form
  const [sgName, setSgName] = useState("")
  const [sgDesc, setSgDesc] = useState("")
  const [sgVpc, setSgVpc] = useState("")

  // Add rule form
  const [ruleProtocol, setRuleProtocol] = useState("tcp")
  const [ruleFromPort, setRuleFromPort] = useState("80")
  const [ruleToPort, setRuleToPort] = useState("80")
  const [ruleCidr, setRuleCidr] = useState("0.0.0.0/0")

  const { data: securityGroups = [], isLoading, refetch } = useQuery({
    queryKey: ["ec2-security-groups", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listSecurityGroups(instanceId)
      return r.data as SecurityGroup[]
    },
  })

  const { data: rulesData } = useQuery({
    queryKey: ["ec2-sg-rules", instanceId, expandedGroup],
    queryFn: async () => {
      const r = await instancesApi.getSecurityGroupRules(instanceId, expandedGroup!)
      return r.data as { inbound: SGRule[]; outbound: SGRule[] }
    },
    enabled: !!expandedGroup,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createSecurityGroup(instanceId, {
        name: sgName,
        description: sgDesc,
        vpc_id: sgVpc || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-security-groups", instanceId] })
      setCreateOpen(false)
      setSgName("")
      setSgDesc("")
      setSgVpc("")
      toast.success("Security group created")
    },
    onError: () => toast.error("Failed to create security group"),
  })

  const deleteMutation = useMutation({
    mutationFn: (gid: string) => instancesApi.deleteSecurityGroup(instanceId, gid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-security-groups", instanceId] })
      setDeleteTarget(null)
      if (expandedGroup === deleteTarget) setExpandedGroup(null)
      toast.success("Security group deleted")
    },
    onError: () => toast.error("Failed to delete security group"),
  })

  const addRuleMutation = useMutation({
    mutationFn: () =>
      instancesApi.addIngressRule(instanceId, addRuleOpen!, {
        protocol: ruleProtocol,
        from_port: parseInt(ruleFromPort),
        to_port: parseInt(ruleToPort),
        cidr: ruleCidr,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-sg-rules", instanceId, addRuleOpen] })
      qc.invalidateQueries({ queryKey: ["ec2-security-groups", instanceId] })
      setAddRuleOpen(null)
      toast.success("Ingress rule added")
    },
    onError: () => toast.error("Failed to add rule"),
  })

  const revokeRuleMutation = useMutation({
    mutationFn: (rule: SGRule & { groupId: string }) =>
      instancesApi.revokeIngressRule(instanceId, rule.groupId, {
        protocol: rule.protocol,
        from_port: rule.from_port,
        to_port: rule.to_port,
        cidr: rule.cidr!,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-sg-rules", instanceId, expandedGroup] })
      qc.invalidateQueries({ queryKey: ["ec2-security-groups", instanceId] })
      toast.success("Ingress rule revoked")
    },
    onError: () => toast.error("Failed to revoke rule"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {securityGroups.length} security group{securityGroups.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Security Group
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
                <TableHead className="w-8" />
                <TableHead>Group ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>VPC ID</TableHead>
                <TableHead>Inbound</TableHead>
                <TableHead>Outbound</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {securityGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 8 : 7} className="text-center text-muted-foreground h-24">
                    No security groups found
                  </TableCell>
                </TableRow>
              ) : (
                securityGroups.flatMap((sg) => {
                  const expanded = expandedGroup === sg.group_id
                  return [
                    <TableRow
                      key={sg.group_id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => setExpandedGroup(expanded ? null : sg.group_id)}
                    >
                      <TableCell>
                        {expanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sg.group_id}</TableCell>
                      <TableCell className="font-medium text-sm">{sg.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{sg.description}</TableCell>
                      <TableCell className="font-mono text-xs">{sg.vpc_id || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{sg.inbound_rules_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{sg.outbound_rules_count}</Badge>
                      </TableCell>
                      {canMutate && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setDeleteTarget(sg.group_id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>,
                    expanded ? (
                      <TableRow key={`${sg.group_id}-rules`} className="bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={canMutate ? 7 : 6} className="py-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">Inbound Rules</p>
                              {canMutate && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-xs px-2"
                                  onClick={() => setAddRuleOpen(sg.group_id)}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Add Rule
                                </Button>
                              )}
                            </div>
                            {!rulesData ? (
                              <Skeleton className="h-20" />
                            ) : rulesData.inbound.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No inbound rules</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Protocol</TableHead>
                                    <TableHead className="text-xs">Port Range</TableHead>
                                    <TableHead className="text-xs">Source</TableHead>
                                    <TableHead className="text-xs">Description</TableHead>
                                    {canMutate && <TableHead className="w-16" />}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rulesData.inbound.map((rule, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs">{rule.protocol === "-1" ? "All" : rule.protocol.toUpperCase()}</TableCell>
                                      <TableCell className="text-xs font-mono">
                                        {rule.protocol === "-1"
                                          ? "All"
                                          : rule.from_port === rule.to_port
                                          ? rule.from_port
                                          : `${rule.from_port}–${rule.to_port}`}
                                      </TableCell>
                                      <TableCell className="text-xs font-mono">{rule.cidr || rule.source_group || "—"}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{rule.description || "—"}</TableCell>
                                      {canMutate && rule.cidr && (
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() =>
                                              revokeRuleMutation.mutate({
                                                ...rule,
                                                groupId: sg.group_id,
                                              })
                                            }
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </TableCell>
                                      )}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                            <p className="text-xs font-medium mt-2">Outbound Rules</p>
                            {!rulesData ? (
                              <Skeleton className="h-12" />
                            ) : rulesData.outbound.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No outbound rules</p>
                            ) : (
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Protocol</TableHead>
                                    <TableHead className="text-xs">Port Range</TableHead>
                                    <TableHead className="text-xs">Destination</TableHead>
                                    <TableHead className="text-xs">Description</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {rulesData.outbound.map((rule, i) => (
                                    <TableRow key={i}>
                                      <TableCell className="text-xs">{rule.protocol === "-1" ? "All" : rule.protocol.toUpperCase()}</TableCell>
                                      <TableCell className="text-xs font-mono">
                                        {rule.protocol === "-1"
                                          ? "All"
                                          : rule.from_port === rule.to_port
                                          ? rule.from_port
                                          : `${rule.from_port}–${rule.to_port}`}
                                      </TableCell>
                                      <TableCell className="text-xs font-mono">{rule.cidr || rule.source_group || "—"}</TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{rule.description || "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null,
                  ].filter(Boolean)
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create Security Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Security Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input placeholder="my-security-group" value={sgName} onChange={(e) => setSgName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input placeholder="Allow HTTP traffic" value={sgDesc} onChange={(e) => setSgDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>VPC ID (optional)</Label>
              <Input placeholder="vpc-xxxxxxxxx" value={sgVpc} onChange={(e) => setSgVpc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!sgName || !sgDesc || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete SG Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Security Group</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete security group <span className="font-mono font-medium">{deleteTarget}</span>?
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

      {/* Add Ingress Rule Dialog */}
      <Dialog open={!!addRuleOpen} onOpenChange={() => setAddRuleOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Inbound Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Protocol</Label>
              <Select value={ruleProtocol} onValueChange={(v) => v && setRuleProtocol(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="icmp">ICMP</SelectItem>
                  <SelectItem value="-1">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>From Port</Label>
                <Input type="number" value={ruleFromPort} onChange={(e) => setRuleFromPort(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>To Port</Label>
                <Input type="number" value={ruleToPort} onChange={(e) => setRuleToPort(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>CIDR</Label>
              <Input value={ruleCidr} onChange={(e) => setRuleCidr(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddRuleOpen(null)}>Cancel</Button>
            <Button
              onClick={() => addRuleMutation.mutate()}
              disabled={addRuleMutation.isPending}
            >
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Volumes Tab ──────────────────────────────────────────────────────────────

function VolumesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [attachTarget, setAttachTarget] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Create form
  const [volSize, setVolSize] = useState("20")
  const [volAz, setVolAz] = useState("")
  const [volType, setVolType] = useState("gp3")
  const [volSnapshot, setVolSnapshot] = useState("")

  // Attach form
  const [attachInstanceId, setAttachInstanceId] = useState("")
  const [attachDevice, setAttachDevice] = useState("/dev/xvdf")

  const { data: volumes = [], isLoading, refetch } = useQuery({
    queryKey: ["ec2-volumes", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listVolumes(instanceId)
      return r.data as Volume[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createVolume(instanceId, {
        size: parseInt(volSize),
        availability_zone: volAz,
        volume_type: volType,
        snapshot_id: volSnapshot || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] })
      setCreateOpen(false)
      setVolSize("20")
      setVolAz("")
      setVolType("gp3")
      setVolSnapshot("")
      toast.success("Volume created")
    },
    onError: () => toast.error("Failed to create volume"),
  })

  const attachMutation = useMutation({
    mutationFn: () =>
      instancesApi.attachVolume(instanceId, attachTarget!, {
        instance_id: attachInstanceId,
        device: attachDevice,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] })
      setAttachTarget(null)
      setAttachInstanceId("")
      setAttachDevice("/dev/xvdf")
      toast.success("Volume attached")
    },
    onError: () => toast.error("Failed to attach volume"),
  })

  const detachMutation = useMutation({
    mutationFn: (vid: string) => instancesApi.detachVolume(instanceId, vid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] })
      toast.success("Volume detached")
    },
    onError: () => toast.error("Failed to detach volume"),
  })

  const deleteMutation = useMutation({
    mutationFn: (vid: string) => instancesApi.deleteVolume(instanceId, vid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] })
      setDeleteTarget(null)
      toast.success("Volume deleted")
    },
    onError: () => toast.error("Failed to delete volume"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {volumes.length} volume{volumes.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Volume
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
                <TableHead>Volume ID</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>AZ</TableHead>
                <TableHead>Attached To</TableHead>
                <TableHead>Device</TableHead>
                {canMutate && <TableHead className="w-40" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {volumes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 8 : 7} className="text-center text-muted-foreground h-24">
                    No volumes found
                  </TableCell>
                </TableRow>
              ) : (
                volumes.map((vol) => (
                  <TableRow key={vol.volume_id}>
                    <TableCell className="font-mono text-xs">{vol.volume_id}</TableCell>
                    <TableCell className="text-sm">{vol.size} GB</TableCell>
                    <TableCell className="text-xs">{vol.volume_type}</TableCell>
                    <TableCell>{stateBadge(vol.state)}</TableCell>
                    <TableCell className="text-xs">{vol.availability_zone}</TableCell>
                    <TableCell className="font-mono text-xs">{vol.attached_to || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{vol.device || "—"}</TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {vol.state === "available" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => setAttachTarget(vol.volume_id)}
                            >
                              Attach
                            </Button>
                          )}
                          {vol.state === "in-use" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => detachMutation.mutate(vol.volume_id)}
                              disabled={detachMutation.isPending}
                            >
                              Detach
                            </Button>
                          )}
                          {vol.state === "available" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setDeleteTarget(vol.volume_id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
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

      {/* Create Volume Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Volume</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Size (GB)</Label>
              <Input type="number" min={1} value={volSize} onChange={(e) => setVolSize(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Availability Zone</Label>
              <Input placeholder="us-east-1a" value={volAz} onChange={(e) => setVolAz(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Volume Type</Label>
              <Select value={volType} onValueChange={(v) => v && setVolType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["gp3", "gp2", "io1", "sc1", "st1"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Snapshot ID (optional)</Label>
              <Input placeholder="snap-xxxxxxxxx" value={volSnapshot} onChange={(e) => setVolSnapshot(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!volSize || !volAz || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attach Volume Dialog */}
      <Dialog open={!!attachTarget} onOpenChange={() => setAttachTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Volume</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Instance ID</Label>
              <Input
                placeholder="i-xxxxxxxxxxxxxxxxx"
                value={attachInstanceId}
                onChange={(e) => setAttachInstanceId(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Device Name</Label>
              <Input value={attachDevice} onChange={(e) => setAttachDevice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachTarget(null)}>Cancel</Button>
            <Button
              onClick={() => attachMutation.mutate()}
              disabled={!attachInstanceId || attachMutation.isPending}
            >
              Attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Volume Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Volume</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete volume <span className="font-mono font-medium">{deleteTarget}</span>? This action cannot be undone.
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

// ─── Elastic IPs Tab ──────────────────────────────────────────────────────────

function ElasticIPsTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [associateTarget, setAssociateTarget] = useState<string | null>(null)
  const [releaseTarget, setReleaseTarget] = useState<string | null>(null)
  const [associateInstanceId, setAssociateInstanceId] = useState("")

  const { data: eips = [], isLoading, refetch } = useQuery({
    queryKey: ["ec2-elastic-ips", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listElasticIPs(instanceId)
      return r.data as ElasticIP[]
    },
  })

  const allocateMutation = useMutation({
    mutationFn: () => instancesApi.allocateElasticIP(instanceId),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["ec2-elastic-ips", instanceId] })
      const data = r.data as { public_ip: string }
      toast.success(`Elastic IP ${data.public_ip} allocated`)
    },
    onError: () => toast.error("Failed to allocate Elastic IP"),
  })

  const associateMutation = useMutation({
    mutationFn: () =>
      instancesApi.associateElasticIP(instanceId, associateTarget!, associateInstanceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-elastic-ips", instanceId] })
      setAssociateTarget(null)
      setAssociateInstanceId("")
      toast.success("Elastic IP associated")
    },
    onError: () => toast.error("Failed to associate Elastic IP"),
  })

  const disassociateMutation = useMutation({
    mutationFn: (allocId: string) => instancesApi.disassociateElasticIP(instanceId, allocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-elastic-ips", instanceId] })
      toast.success("Elastic IP disassociated")
    },
    onError: () => toast.error("Failed to disassociate Elastic IP"),
  })

  const releaseMutation = useMutation({
    mutationFn: (allocId: string) => instancesApi.releaseElasticIP(instanceId, allocId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ec2-elastic-ips", instanceId] })
      setReleaseTarget(null)
      toast.success("Elastic IP released")
    },
    onError: () => toast.error("Failed to release Elastic IP"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {eips.length} elastic IP{eips.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => allocateMutation.mutate()} disabled={allocateMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Allocate Elastic IP
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
                <TableHead>Allocation ID</TableHead>
                <TableHead>Public IP</TableHead>
                <TableHead>Associated Instance</TableHead>
                <TableHead>Association ID</TableHead>
                {canMutate && <TableHead className="w-48" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {eips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">
                    No Elastic IPs found
                  </TableCell>
                </TableRow>
              ) : (
                eips.map((eip) => (
                  <TableRow key={eip.allocation_id}>
                    <TableCell className="font-mono text-xs">{eip.allocation_id}</TableCell>
                    <TableCell className="font-mono text-sm">{eip.public_ip}</TableCell>
                    <TableCell className="font-mono text-xs">{eip.instance_id || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {eip.association_id || "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!eip.association_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => setAssociateTarget(eip.allocation_id)}
                            >
                              Associate
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => disassociateMutation.mutate(eip.allocation_id)}
                              disabled={disassociateMutation.isPending}
                            >
                              Disassociate
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setReleaseTarget(eip.allocation_id)}
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

      {/* Associate Dialog */}
      <Dialog open={!!associateTarget} onOpenChange={() => setAssociateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Associate Elastic IP</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Instance ID</Label>
            <Input
              placeholder="i-xxxxxxxxxxxxxxxxx"
              value={associateInstanceId}
              onChange={(e) => setAssociateInstanceId(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssociateTarget(null)}>Cancel</Button>
            <Button
              onClick={() => associateMutation.mutate()}
              disabled={!associateInstanceId || associateMutation.isPending}
            >
              Associate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release Confirmation */}
      <Dialog open={!!releaseTarget} onOpenChange={() => setReleaseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Elastic IP</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Release <span className="font-mono font-medium">{releaseTarget}</span>? The IP address will
            be returned to AWS and may be allocated to another account.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={releaseMutation.isPending}
              onClick={() => releaseTarget && releaseMutation.mutate(releaseTarget)}
            >
              Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
