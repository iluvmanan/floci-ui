"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface HostedZone {
  id: string
  name: string
  config: { comment: string; private_zone: boolean }
  resource_record_set_count: number
}

interface RecordSet {
  name: string
  type: string
  ttl: number | null
  records: string[]
  alias_target?: Record<string, unknown> | null
}

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "SRV", "PTR", "CAA"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function zoneIdShort(id: string) {
  return id.replace("/hostedzone/", "")
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Route53Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedZone, setSelectedZone] = useState<HostedZone | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<HostedZone | null>(null)
  const [nsTarget, setNsTarget] = useState<{ name: string; nameservers: string[] } | null>(null)

  const { data: zones = [], isLoading, refetch } = useQuery({
    queryKey: ["route53-zones", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listHostedZones(instanceId)
      return r.data as HostedZone[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createHostedZone(instanceId, body),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ["route53-zones", instanceId] })
      setCreateOpen(false)
      const data = resp.data as { name: string; nameservers: string[] }
      if (data.nameservers?.length) {
        setNsTarget({ name: data.name, nameservers: data.nameservers })
      }
      toast.success("Hosted zone created")
    },
    onError: () => toast.error("Failed to create hosted zone"),
  })

  const deleteMutation = useMutation({
    mutationFn: (zoneId: string) => instancesApi.deleteHostedZone(instanceId, zoneId),
    onSuccess: (_d, zoneId) => {
      qc.invalidateQueries({ queryKey: ["route53-zones", instanceId] })
      setDeleteTarget(null)
      if (selectedZone?.id === zoneId) setSelectedZone(null)
      toast.success("Hosted zone deleted")
    },
    onError: () => toast.error("Failed to delete hosted zone (zone must be empty of custom records)"),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Route 53</h2>

      <div className="flex gap-4">
        {/* Zone list */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {zones.length} hosted zone{zones.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canMutate && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : zones.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No hosted zones found</div>
            ) : (
              <ul className="divide-y">
                {zones.map((z) => (
                  <li
                    key={z.id}
                    className={`p-3 cursor-pointer hover:bg-accent/40 ${
                      selectedZone?.id === z.id ? "bg-accent/60" : ""
                    }`}
                    onClick={() => setSelectedZone(z)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{z.name}</span>
                      {canMutate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(z)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant={z.config.private_zone ? "secondary" : "outline"} className="text-xs">
                        {z.config.private_zone ? "Private" : "Public"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {z.resource_record_set_count} records
                      </span>
                    </div>
                    {z.config.comment && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{z.config.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Record set browser */}
        <div className="flex-1 min-w-0">
          {!selectedZone ? (
            <div className="border rounded-lg h-64 flex items-center justify-center text-sm text-muted-foreground">
              Select a hosted zone to view record sets
            </div>
          ) : (
            <RecordSetsPanel instanceId={instanceId} zone={selectedZone} canMutate={canMutate} />
          )}
        </div>
      </div>

      {/* Create Hosted Zone Dialog */}
      <CreateZoneDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Hosted Zone</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete hosted zone <span className="font-mono font-medium">{deleteTarget?.name}</span>? The zone
            must not contain any custom record sets besides the default NS/SOA records.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nameservers Dialog (shown after create) */}
      <Dialog open={!!nsTarget} onOpenChange={() => setNsTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nameservers — {nsTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {nsTarget?.nameservers.map((ns) => (
              <div key={ns} className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted rounded p-2 font-mono">{ns}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(ns)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNsTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Create Hosted Zone Dialog ─────────────────────────────────────────────────

function CreateZoneDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [zoneType, setZoneType] = useState<"public" | "private">("public")
  const [vpcId, setVpcId] = useState("")
  const [comment, setComment] = useState("")

  function reset() {
    setName("")
    setZoneType("public")
    setVpcId("")
    setComment("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Hosted Zone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Domain Name</Label>
            <Input placeholder="example.com" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Zone Type</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="zone-type"
                  value="public"
                  checked={zoneType === "public"}
                  onChange={() => setZoneType("public")}
                />
                Public
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="zone-type"
                  value="private"
                  checked={zoneType === "private"}
                  onChange={() => setZoneType("private")}
                />
                Private
              </label>
            </div>
          </div>

          {zoneType === "private" && (
            <div className="space-y-1">
              <Label>VPC ID</Label>
              <Input placeholder="vpc-0123456789abcdef0" value={vpcId} onChange={(e) => setVpcId(e.target.value)} />
            </div>
          )}

          <div className="space-y-1">
            <Label>Comment (optional)</Label>
            <Input value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!name || (zoneType === "private" && !vpcId) || isPending}
            onClick={() =>
              onSubmit({
                name,
                private_zone: zoneType === "private",
                vpc_id: zoneType === "private" ? vpcId : undefined,
                comment: comment || undefined,
              })
            }
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Record Sets Panel ──────────────────────────────────────────────────────────

function RecordSetsPanel({
  instanceId,
  zone,
  canMutate,
}: {
  instanceId: string
  zone: HostedZone
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<RecordSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RecordSet | null>(null)

  const { data: records = [], isLoading, refetch } = useQuery({
    queryKey: ["route53-records", instanceId, zone.id],
    queryFn: async () => {
      const r = await instancesApi.listRecordSets(instanceId, zone.id)
      return r.data as RecordSet[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createRecord(instanceId, zone.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route53-records", instanceId, zone.id] })
      setCreateOpen(false)
      toast.success("Record set created")
    },
    onError: () => toast.error("Failed to create record set"),
  })

  const upsertMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.upsertRecord(instanceId, zone.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route53-records", instanceId, zone.id] })
      setEditTarget(null)
      toast.success("Record set updated")
    },
    onError: () => toast.error("Failed to update record set"),
  })

  const deleteMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.deleteRecord(instanceId, zone.id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["route53-records", instanceId, zone.id] })
      setDeleteTarget(null)
      toast.success("Record set deleted")
    },
    onError: () => toast.error("Failed to delete record set"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium font-mono">{zone.name}</h3>
          <p className="text-xs text-muted-foreground">{zoneIdShort(zone.id)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Record
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
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>TTL</TableHead>
                <TableHead>Values</TableHead>
                {canMutate && <TableHead className="w-24" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground h-24">
                    No record sets found
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r, idx) => (
                  <TableRow key={`${r.name}-${r.type}-${idx}`}>
                    <TableCell className="text-sm font-mono">{r.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{r.ttl ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-xs">
                      {r.alias_target ? (
                        <span className="text-muted-foreground">Alias target</span>
                      ) : (
                        r.records.join(", ")
                      )}
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!!r.alias_target}
                            onClick={() => setEditTarget(r)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={!!r.alias_target || r.type === "NS" || r.type === "SOA"}
                            onClick={() => setDeleteTarget(r)}
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

      {/* Create Record Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Record Set</DialogTitle>
          </DialogHeader>
          <RecordForm
            isPending={createMutation.isPending}
            onSubmit={(body) => createMutation.mutate(body)}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit (Upsert) Record Dialog */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Record Set</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <RecordForm
              initial={editTarget}
              isPending={upsertMutation.isPending}
              onSubmit={(body) => upsertMutation.mutate(body)}
              onCancel={() => setEditTarget(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Record Set</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete record <span className="font-mono font-medium">{deleteTarget?.name}</span> ({deleteTarget?.type})?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleteTarget &&
                deleteMutation.mutate({
                  name: deleteTarget.name,
                  type: deleteTarget.type,
                  ttl: deleteTarget.ttl ?? 300,
                  records: deleteTarget.records,
                })
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Record Form (shared create/edit) ──────────────────────────────────────────

function RecordForm({
  initial,
  isPending,
  onSubmit,
  onCancel,
}: {
  initial?: RecordSet
  isPending: boolean
  onSubmit: (body: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? "")
  const [type, setType] = useState(initial?.type ?? "A")
  const [ttl, setTtl] = useState(String(initial?.ttl ?? 300))
  const [values, setValues] = useState((initial?.records ?? []).join("\n"))

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Record Name</Label>
        <Input placeholder="www.example.com" value={name} onChange={(e) => setName(e.target.value)} disabled={!!initial} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)} disabled={!!initial}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECORD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>TTL (seconds)</Label>
          <Input type="number" value={ttl} onChange={(e) => setTtl(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Values (one per line)</Label>
        <textarea
          className="w-full min-h-24 rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
          placeholder={"192.0.2.1\n192.0.2.2"}
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button
          disabled={!name || !values.trim() || isPending}
          onClick={() =>
            onSubmit({
              name,
              type,
              ttl: parseInt(ttl, 10),
              records: values
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
            })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </div>
  )
}
