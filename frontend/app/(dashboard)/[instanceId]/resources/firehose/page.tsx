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
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Send } from "lucide-react"
import { toast } from "sonner"

interface DeliveryStream {
  delivery_stream_name: string
  delivery_stream_arn: string
  delivery_stream_status: string
  delivery_stream_type: string
  destinations: Record<string, unknown>[]
  create_timestamp: string
}

function statusBadge(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACTIVE") return "default"
  if (status === "CREATING" || status === "CREATING_FAILED") return "secondary"
  if (status === "DELETING" || status === "DELETING_FAILED") return "destructive"
  return "outline"
}

export default function FirehosePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [streamName, setStreamName] = useState("")
  const [streamType, setStreamType] = useState("DirectPut")
  const [bucketArn, setBucketArn] = useState("")
  const [roleArn, setRoleArn] = useState("")
  const [prefix, setPrefix] = useState("")
  const [bufferSizeMb, setBufferSizeMb] = useState(5)
  const [bufferIntervalSeconds, setBufferIntervalSeconds] = useState(300)

  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [testData, setTestData] = useState("")
  const [lastRecordId, setLastRecordId] = useState<string | null>(null)

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ["firehose-streams", instanceId],
    queryFn: () => instancesApi.listFirehoseStreams(instanceId).then((r) => r.data as DeliveryStream[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createFirehoseStream(instanceId, {
        delivery_stream_name: streamName,
        delivery_stream_type: streamType,
        s3_config: {
          role_arn: roleArn,
          bucket_arn: bucketArn,
          prefix: prefix || undefined,
          buffer_size_mb: bufferSizeMb,
          buffer_interval_seconds: bufferIntervalSeconds,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firehose-streams", instanceId] })
      setCreateOpen(false)
      setStreamName(""); setBucketArn(""); setRoleArn(""); setPrefix("")
      toast.success("Delivery stream created")
    },
    onError: () => toast.error("Failed to create delivery stream"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteFirehoseStream(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["firehose-streams", instanceId] })
      setSelectedStream(null)
      toast.success("Delivery stream deleted")
    },
    onError: () => toast.error("Failed to delete delivery stream"),
  })

  const putRecordMutation = useMutation({
    mutationFn: () =>
      instancesApi.firehosePutRecord(instanceId, selectedStream as string, {
        data_base64: btoa(testData),
      }),
    onSuccess: (r) => {
      const data = r.data as { record_id: string }
      setLastRecordId(data.record_id)
      toast.success("Record sent")
    },
    onError: () => toast.error("Failed to send record"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Data Firehose</h2>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Delivery Stream
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
                <TableHead>Status</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Created</TableHead>
                {canMutate && <TableHead className="w-28" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {streams.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground text-sm h-24">No delivery streams found</TableCell></TableRow>
              ) : streams.map((s) => (
                <TableRow key={s.delivery_stream_name} className="cursor-pointer" onClick={() => { setSelectedStream(s.delivery_stream_name); setTestData(""); setLastRecordId(null) }}>
                  <TableCell className="font-mono text-sm">{s.delivery_stream_name}</TableCell>
                  <TableCell><Badge variant="outline">{s.delivery_stream_type}</Badge></TableCell>
                  <TableCell><Badge variant={statusBadge(s.delivery_stream_status)}>{s.delivery_stream_status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">S3</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.create_timestamp ? new Date(s.create_timestamp).toLocaleDateString() : "—"}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(s.delivery_stream_name)}>
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

      {/* Create Delivery Stream Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Delivery Stream</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={streamName} onChange={(e) => setStreamName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="mb-1 block">Source Type</Label>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="streamType" checked={streamType === "DirectPut"} onChange={() => setStreamType("DirectPut")} />
                  Direct PUT
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" name="streamType" checked={streamType === "KinesisStreamAsSource"} onChange={() => setStreamType("KinesisStreamAsSource")} />
                  Kinesis Stream as Source
                </label>
              </div>
            </div>
            <div>
              <Label>S3 Bucket ARN</Label>
              <Input value={bucketArn} onChange={(e) => setBucketArn(e.target.value)} className="mt-1" placeholder="arn:aws:s3:::my-bucket" />
            </div>
            <div>
              <Label>IAM Role ARN</Label>
              <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} className="mt-1" placeholder="arn:aws:iam::..." />
            </div>
            <div>
              <Label>Prefix (optional)</Label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Buffer Size (MB)</Label>
                <Input type="number" min={1} value={bufferSizeMb} onChange={(e) => setBufferSizeMb(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label>Buffer Interval (s)</Label>
                <Input type="number" min={60} value={bufferIntervalSeconds} onChange={(e) => setBufferIntervalSeconds(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!streamName || !bucketArn || !roleArn || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stream Detail / Test Record Dialog */}
      <Dialog open={!!selectedStream} onOpenChange={() => setSelectedStream(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedStream}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Test Record Data (plain text)</Label>
              <Textarea value={testData} onChange={(e) => setTestData(e.target.value)} className="mt-1 font-mono text-xs" rows={5} placeholder='{"key": "value"}' />
            </div>
            {lastRecordId && (
              <p className="text-xs text-muted-foreground">Record ID: <span className="font-mono">{lastRecordId}</span></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStream(null)}>Close</Button>
            {canMutate && (
              <Button onClick={() => putRecordMutation.mutate()} disabled={!testData || putRecordMutation.isPending}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Put Record
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
