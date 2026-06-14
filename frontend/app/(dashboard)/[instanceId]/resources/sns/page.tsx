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
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Radio, RefreshCw, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Topic {
  arn: string
  name: string
}

export default function SNSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [newTopic, setNewTopic] = useState("")
  const [selectedArn, setSelectedArn] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  const { data: topics = [], isLoading, refetch } = useQuery({
    queryKey: ["sns-topics", instanceId],
    queryFn: () => instancesApi.listTopics(instanceId).then((r) => r.data as Topic[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createTopic(instanceId, newTopic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sns-topics", instanceId] })
      setCreateOpen(false)
      setNewTopic("")
      toast.success(`Topic "${newTopic}" created`)
    },
    onError: () => toast.error("Failed to create topic"),
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteTopic(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sns-topics", instanceId] })
      toast.success("Topic deleted")
    },
    onError: () => toast.error("Failed to delete topic"),
  })

  const publishMutation = useMutation({
    mutationFn: () => instancesApi.publishMessage(instanceId, selectedArn!, message),
    onSuccess: () => {
      setPublishOpen(false)
      setMessage("")
      toast.success("Message published")
    },
    onError: () => toast.error("Failed to publish message"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">SNS Topics</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Topic
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : topics.length === 0 ? (
        <div className="border rounded-lg flex items-center justify-center h-48 text-sm text-muted-foreground">
          No SNS topics found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Topic</TableHead>
                <TableHead className="font-mono text-xs">ARN</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {topics.map((t) => (
                <TableRow key={t.arn}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Radio className="h-4 w-4 text-pink-500 shrink-0" />
                      <span className="font-medium text-sm">{t.name}</span>
                      {t.name.endsWith(".fifo") && <Badge variant="outline" className="text-xs">FIFO</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-sm">{t.arn}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {canMutate && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Publish"
                            onClick={() => { setSelectedArn(t.arn); setSelectedName(t.name); setMessage(""); setPublishOpen(true) }}
                          >
                            <Send className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Delete"
                            onClick={() => deleteMutation.mutate(t.arn)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create SNS Topic</DialogTitle></DialogHeader>
          <Input
            placeholder="Topic name"
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTopic || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish — {selectedName}</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Message…"
            className="h-32"
            value={message}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button>
            <Button onClick={() => publishMutation.mutate()} disabled={!message || publishMutation.isPending}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
