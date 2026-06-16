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
import { Copy, Plus, Tags, XCircle } from "lucide-react"
import { toast } from "sonner"

interface TaggedResource {
  resource_arn: string
  tags: { Key: string; Value: string }[]
}

function truncateArn(arn: string) {
  if (arn.length <= 50) return arn
  return `${arn.slice(0, 25)}…${arn.slice(-20)}`
}

function resourceTypeFromArn(arn: string) {
  const parts = arn.split(":")
  return parts.length > 2 ? parts[2] : "—"
}

export default function TaggingPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [tagKey, setTagKey] = useState("")
  const [tagValue, setTagValue] = useState("")
  const [resourceTypeFilter, setResourceTypeFilter] = useState("")
  const [appliedFilters, setAppliedFilters] = useState<{ tag_key?: string; tag_value?: string; resource_type?: string }>({})
  const [selectedArns, setSelectedArns] = useState<Set<string>>(new Set())

  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [newTagKey, setNewTagKey] = useState("")
  const [newTagValue, setNewTagValue] = useState("")

  const [untagDialogOpen, setUntagDialogOpen] = useState(false)
  const [untagKeys, setUntagKeys] = useState("")

  const { data: tagKeys = [] } = useQuery({
    queryKey: ["tag-keys", instanceId],
    queryFn: () => instancesApi.getTagKeys(instanceId).then((r) => r.data as string[]),
  })

  const { data: tagValues = [] } = useQuery({
    queryKey: ["tag-values", instanceId, tagKey],
    queryFn: () => instancesApi.getTagValues(instanceId, tagKey).then((r) => r.data as string[]),
    enabled: !!tagKey,
  })

  const { data: resources = [], isLoading, refetch } = useQuery({
    queryKey: ["tagged-resources", instanceId, appliedFilters],
    queryFn: () => instancesApi.getTaggedResources(instanceId, appliedFilters).then((r) => r.data as TaggedResource[]),
  })

  const tagMutation = useMutation({
    mutationFn: () =>
      instancesApi.tagResources(instanceId, {
        resource_arns: Array.from(selectedArns),
        tags: { [newTagKey]: newTagValue },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagged-resources", instanceId] })
      setTagDialogOpen(false); setNewTagKey(""); setNewTagValue("")
      toast.success("Tags applied")
    },
    onError: () => toast.error("Failed to apply tags"),
  })

  const untagMutation = useMutation({
    mutationFn: () =>
      instancesApi.untagResources(instanceId, {
        resource_arns: Array.from(selectedArns),
        tag_keys: untagKeys.split(",").map((k) => k.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tagged-resources", instanceId] })
      setUntagDialogOpen(false); setUntagKeys("")
      toast.success("Tags removed")
    },
    onError: () => toast.error("Failed to remove tags"),
  })

  const toggleSelect = (arn: string) => {
    setSelectedArns((prev) => {
      const next = new Set(prev)
      if (next.has(arn)) next.delete(arn)
      else next.add(arn)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedArns.size === resources.length) {
      setSelectedArns(new Set())
    } else {
      setSelectedArns(new Set(resources.map((r) => r.resource_arn)))
    }
  }

  const applyFilters = () => {
    setAppliedFilters({
      tag_key: tagKey || undefined,
      tag_value: tagValue || undefined,
      resource_type: resourceTypeFilter || undefined,
    })
  }

  const clearFilters = () => {
    setTagKey(""); setTagValue(""); setResourceTypeFilter("")
    setAppliedFilters({})
  }

  const copyArn = (arn: string) => {
    navigator.clipboard.writeText(arn)
    toast.success("ARN copied")
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Resource Groups Tagging</h2>

      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tag Key</Label>
          <Select value={tagKey} onValueChange={(v) => { setTagKey(v ?? ""); setTagValue("") }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Any key" /></SelectTrigger>
            <SelectContent>
              {tagKeys.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tag Value</Label>
          <Select value={tagValue} onValueChange={(v) => setTagValue(v ?? "")} disabled={!tagKey}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Any value" /></SelectTrigger>
            <SelectContent>
              {tagValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Resource Type Filter</Label>
          <Input
            value={resourceTypeFilter}
            onChange={(e) => setResourceTypeFilter(e.target.value)}
            className="w-56"
            placeholder="e.g. s3,ec2:instance"
          />
        </div>
        <Button size="sm" onClick={applyFilters}>Search</Button>
        <Button size="sm" variant="outline" onClick={clearFilters}>Clear Filters</Button>
      </div>

      {canMutate && selectedArns.size > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{selectedArns.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setTagDialogOpen(true)}>
            <Tags className="h-3.5 w-3.5 mr-1" /> Add Tags
          </Button>
          <Button size="sm" variant="outline" onClick={() => setUntagDialogOpen(true)}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Remove Tags
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {canMutate && (
                  <TableHead className="w-8">
                    <input type="checkbox" checked={resources.length > 0 && selectedArns.size === resources.length} onChange={toggleSelectAll} />
                  </TableHead>
                )}
                <TableHead>Resource ARN</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resources.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground text-sm h-24">No resources found</TableCell></TableRow>
              ) : resources.map((r) => (
                <TableRow key={r.resource_arn}>
                  {canMutate && (
                    <TableCell>
                      <input type="checkbox" checked={selectedArns.has(r.resource_arn)} onChange={() => toggleSelect(r.resource_arn)} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs" title={r.resource_arn}>{truncateArn(r.resource_arn)}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => copyArn(r.resource_arn)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{resourceTypeFromArn(r.resource_arn)}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.tags.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : r.tags.map((t) => (
                        <Badge key={t.Key} variant="secondary" className="text-[10px]">{t.Key}={t.Value}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tags to {selectedArns.size} Resource(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tag Key</Label>
              <Input value={newTagKey} onChange={(e) => setNewTagKey(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Tag Value</Label>
              <Input value={newTagValue} onChange={(e) => setNewTagValue(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => tagMutation.mutate()} disabled={!newTagKey || tagMutation.isPending}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={untagDialogOpen} onOpenChange={setUntagDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove Tags from {selectedArns.size} Resource(s)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tag Keys (comma-separated)</Label>
              <Input value={untagKeys} onChange={(e) => setUntagKeys(e.target.value)} className="mt-1" placeholder="Environment, Owner" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUntagDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => untagMutation.mutate()} disabled={!untagKeys || untagMutation.isPending}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
