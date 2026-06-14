"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, RefreshCw, Trash2, Zap } from "lucide-react"
import { toast } from "sonner"

export default function KinesisPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [streamName, setStreamName] = useState("")

  const { data: streams = [], isLoading, refetch } = useQuery({
    queryKey: ["kinesis-streams", instanceId],
    queryFn: () => instancesApi.listStreams(instanceId).then((r) => r.data as string[]),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kinesis-streams", instanceId] })
      toast.success("Stream deleted")
    },
    onError: () => toast.error("Failed to delete stream"),
  })

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

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : streams.length === 0 ? (
        <div className="border rounded-lg flex items-center justify-center h-48 text-sm text-muted-foreground">
          No Kinesis streams found
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {streams.map((s) => (
            <div key={s} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="font-mono text-sm">{s}</span>
              </div>
              {canMutate && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => deleteMutation.mutate(s)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

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
    </div>
  )
}
