"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { ChevronRight, FolderOpen, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Bucket {
  name: string
  creation_date: string
}

interface S3Object {
  key: string
  size: number
  last_modified: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function S3Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [prefix, setPrefix] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [newBucket, setNewBucket] = useState("")

  const { data: buckets = [], isLoading: bucketsLoading, refetch: refetchBuckets } = useQuery({
    queryKey: ["s3-buckets", instanceId],
    queryFn: () => instancesApi.listBuckets(instanceId).then((r) => r.data as Bucket[]),
  })

  const { data: objectsData, isLoading: objectsLoading } = useQuery({
    queryKey: ["s3-objects", instanceId, selectedBucket, prefix],
    queryFn: () =>
      instancesApi.listObjects(instanceId, selectedBucket!, prefix).then((r) => r.data as { objects: S3Object[]; truncated: boolean }),
    enabled: !!selectedBucket,
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createBucket(instanceId, newBucket),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-buckets", instanceId] })
      setCreateOpen(false)
      setNewBucket("")
      toast.success(`Bucket "${newBucket}" created`)
    },
    onError: () => toast.error("Failed to create bucket"),
  })

  const deleteBucketMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteBucket(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["s3-buckets", instanceId] })
      if (selectedBucket === name) setSelectedBucket(null)
      toast.success(`Bucket "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete bucket"),
  })

  const deleteObjectMutation = useMutation({
    mutationFn: (key: string) => instancesApi.deleteObject(instanceId, selectedBucket!, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-objects", instanceId, selectedBucket, prefix] })
      toast.success("Object deleted")
    },
    onError: () => toast.error("Failed to delete object"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">S3 Buckets</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetchBuckets()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Bucket
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bucket list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Buckets ({buckets.length})
          </div>
          {bucketsLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : buckets.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No buckets found</div>
          ) : (
            <ul>
              {buckets.map((b) => (
                <li
                  key={b.name}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedBucket === b.name ? "bg-accent" : ""
                  }`}
                  onClick={() => { setSelectedBucket(b.name); setPrefix("") }}
                >
                  <span className="flex items-center gap-2 text-sm font-mono truncate">
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    {b.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedBucket === b.name && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {canMutate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); deleteBucketMutation.mutate(b.name) }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Object browser */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedBucket ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a bucket to browse objects
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedBucket}
                  {prefix && ` / ${prefix}`}
                </span>
                <Input
                  placeholder="Filter by prefix…"
                  className="h-6 text-xs w-48"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                />
              </div>
              {objectsLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead className="w-24">Size</TableHead>
                      <TableHead className="w-32">Last Modified</TableHead>
                      {canMutate && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(objectsData?.objects ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground text-sm h-32">
                          No objects in this bucket
                        </TableCell>
                      </TableRow>
                    ) : (
                      objectsData!.objects.map((obj) => (
                        <TableRow key={obj.key}>
                          <TableCell className="font-mono text-xs">{obj.key}</TableCell>
                          <TableCell className="text-xs">{formatSize(obj.size)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(obj.last_modified).toLocaleDateString()}
                          </TableCell>
                          {canMutate && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => deleteObjectMutation.mutate(obj.key)}
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
              {objectsData?.truncated && (
                <div className="px-3 py-2 border-t">
                  <Badge variant="outline" className="text-xs">Results truncated</Badge>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create S3 Bucket</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Bucket name"
            value={newBucket}
            onChange={(e) => setNewBucket(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createMutation.mutate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newBucket || createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
