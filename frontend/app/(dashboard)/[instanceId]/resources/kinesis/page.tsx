"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Plus, RefreshCw, Send, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

interface StreamDetail {
  name: string
  arn: string
  status: string
  shard_count: number
  retention_hours: number
  stream_creation_timestamp: string
}

interface Shard {
  shard_id: string
  starting_hash: string
  ending_hash: string
}

export default function KinesisPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [streamName, setStreamName] = useState("")
  const [selectedStream, setSelectedStream] = useState<string | null>(null)

  // Put Record dialog
  const [putRecordOpen, setPutRecordOpen] = useState(false)
  const [partitionKey, setPartitionKey] = useState("")
  const [recordData, setRecordData] = useState("")

  const { data: streams = [], isLoading, refetch } = useQuery({
    queryKey: ["kinesis-streams", instanceId],
    queryFn: () => instancesApi.listStreams(instanceId).then((r) => r.data as string[]),
  })

  const { data: streamDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["kinesis-stream-detail", instanceId, selectedStream],
    queryFn: () =>
      instancesApi.describeStream(instanceId, selectedStream!).then((r) => r.data as StreamDetail),
    enabled: !!selectedStream,
  })

  const { data: shards = [], isLoading: shardsLoading } = useQuery({
    queryKey: ["kinesis-shards", instanceId, selectedStream],
    queryFn: () =>
      instancesApi.listShards(instanceId, selectedStream!).then((r) => r.data as Shard[]),
    enabled: !!selectedStream,
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createStream(instanceId, streamName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kinesis-streams", instanceId] })
      setCreateOpen(false)
      setStreamName("")
      toast.success(`Stream "${streamName}" created`)
    },
    onError: () => toast.error("Failed to create stream"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteStream(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["kinesis-streams", instanceId] })
      if (selectedStream === name) setSelectedStream(null)
      toast.success("Stream deleted")
    },
    onError: () => toast.error("Failed to delete stream"),
  })

  const putRecordMutation = useMutation({
    mutationFn: () =>
      instancesApi.putRecord(instanceId, selectedStream!, {
        data_b64: btoa(recordData),
        partition_key: partitionKey,
      }),
    onSuccess: () => {
      setPutRecordOpen(false)
      setPartitionKey("")
      setRecordData("")
      toast.success("Record put successfully")
    },
    onError: () => toast.error("Failed to put record"),
  })

  function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
    if (status === "ACTIVE") return "default"
    if (status === "CREATING" || status === "UPDATING") return "secondary"
    return "destructive"
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Kinesis Streams</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Stream
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stream List */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Streams ({streams.length})
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : streams.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No Kinesis streams found</div>
          ) : (
            <ul>
              {streams.map((s) => (
                <li
                  key={s}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedStream === s ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedStream(s)}
                >
                  <span className="flex items-center gap-2 text-sm font-mono truncate">
                    <Zap className="h-4 w-4 shrink-0 text-blue-500" />
                    {s}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedStream === s && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {canMutate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(s) }}
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

        {/* Detail Panel */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedStream ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a stream to view details
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedStream}
                </span>
                {canMutate && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { setPartitionKey(""); setRecordData(""); setPutRecordOpen(true) }}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Put Record
                  </Button>
                )}
              </div>

              <Tabs defaultValue="details" className="p-3">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="shards">Shards</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="pt-3">
                  {detailLoading ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6" />)}
                    </div>
                  ) : streamDetail ? (
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Status</div>
                        <Badge variant={statusVariant(streamDetail.status)} className="text-xs">
                          {streamDetail.status}
                        </Badge>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Shard Count</div>
                        <span className="font-mono text-sm">{streamDetail.shard_count}</span>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Retention</div>
                        <span className="font-mono text-sm">{streamDetail.retention_hours}h</span>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-0.5">Created</div>
                        <span className="text-sm">{streamDetail.stream_creation_timestamp ? new Date(streamDetail.stream_creation_timestamp).toLocaleDateString() : "—"}</span>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground mb-0.5">ARN</div>
                        <span className="font-mono text-xs break-all">{streamDetail.arn}</span>
                      </div>
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="shards" className="pt-3">
                  {shardsLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
                    </div>
                  ) : shards.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No shards found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Shard ID</TableHead>
                          <TableHead>Hash Key Range</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shards.map((shard) => (
                          <TableRow key={shard.shard_id}>
                            <TableCell className="font-mono text-xs">{shard.shard_id}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {shard.starting_hash.slice(0, 8)}… – {shard.ending_hash.slice(0, 8)}…
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Create Stream Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Kinesis Stream</DialogTitle></DialogHeader>
          <Input
            placeholder="Stream name"
            value={streamName}
            onChange={(e) => setStreamName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!streamName || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Put Record Dialog */}
      <Dialog open={putRecordOpen} onOpenChange={setPutRecordOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Put Record — {selectedStream}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Partition Key</label>
              <Input
                placeholder="e.g. user-123"
                value={partitionKey}
                onChange={(e) => setPartitionKey(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Data</label>
              <Textarea
                placeholder="Record data (will be base64-encoded)…"
                className="h-28 mt-1"
                value={recordData}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRecordData(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPutRecordOpen(false)}>Cancel</Button>
            <Button
              onClick={() => putRecordMutation.mutate()}
              disabled={!partitionKey || !recordData || putRecordMutation.isPending}
            >
              Put Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
