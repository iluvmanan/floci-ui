"use client"

import { useEffect, useState } from "react"
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
import { Download, MessageSquare, Plus, RefreshCw, Send, Settings2, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface Queue {
  name: string
  url: string
  arn: string
  message_count: number
}

interface Message {
  message_id: string
  body: string
  receipt_handle: string
}

interface QueueAttributes {
  arn: string
  visibility_timeout: number
  delay_seconds: number
  receive_wait_time: number
  max_message_size: number
  retention_period: number
  approximate_message_count: number
  dlq_arn: string | null
  max_receive_count: string | null
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`
}

export default function SQSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [newQueue, setNewQueue] = useState("")
  const [sendOpen, setSendOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)
  const [messageBody, setMessageBody] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [receiving, setReceiving] = useState(false)

  // Attributes panel
  const [attrsQueue, setAttrsQueue] = useState<string | null>(null)

  // Edit attributes dialog
  const [editAttrsOpen, setEditAttrsOpen] = useState(false)
  const [editVisibility, setEditVisibility] = useState("")
  const [editDelay, setEditDelay] = useState("")
  const [editWaitTime, setEditWaitTime] = useState("")

  const { data: queues = [], isLoading, refetch } = useQuery({
    queryKey: ["sqs-queues", instanceId],
    queryFn: () => instancesApi.listQueues(instanceId).then((r) => r.data as Queue[]),
  })

  const { data: queueAttrs, isLoading: attrsLoading } = useQuery({
    queryKey: ["sqs-attrs", instanceId, attrsQueue],
    queryFn: () =>
      instancesApi.getQueueAttributes(instanceId, attrsQueue!).then((r) => r.data as QueueAttributes),
    enabled: !!attrsQueue,
  })

  // Pre-fill edit form when attrs load
  useEffect(() => {
    if (queueAttrs) {
      setEditVisibility(String(queueAttrs.visibility_timeout))
      setEditDelay(String(queueAttrs.delay_seconds))
      setEditWaitTime(String(queueAttrs.receive_wait_time))
    }
  }, [queueAttrs])

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createQueue(instanceId, newQueue),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sqs-queues", instanceId] })
      setCreateOpen(false)
      setNewQueue("")
      toast.success(`Queue "${newQueue}" created`)
    },
    onError: () => toast.error("Failed to create queue"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteQueue(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["sqs-queues", instanceId] })
      if (attrsQueue === name) setAttrsQueue(null)
      toast.success(`Queue "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete queue"),
  })

  const purgeMutation = useMutation({
    mutationFn: (name: string) => instancesApi.purgeQueue(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sqs-queues", instanceId] })
      toast.success("Queue purged")
    },
    onError: () => toast.error("Failed to purge queue"),
  })

  const sendMutation = useMutation({
    mutationFn: () => instancesApi.sendMessage(instanceId, selectedQueue!, messageBody),
    onSuccess: () => {
      setSendOpen(false)
      setMessageBody("")
      toast.success("Message sent")
    },
    onError: () => toast.error("Failed to send message"),
  })

  const setAttrsMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, number> = {}
      if (editVisibility !== "") body.visibility_timeout = Number(editVisibility)
      if (editDelay !== "") body.delay_seconds = Number(editDelay)
      if (editWaitTime !== "") body.receive_wait_time = Number(editWaitTime)
      return instancesApi.setQueueAttributes(instanceId, attrsQueue!, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sqs-attrs", instanceId, attrsQueue] })
      setEditAttrsOpen(false)
      toast.success("Queue attributes updated")
    },
    onError: () => toast.error("Failed to update attributes"),
  })

  async function handleReceive(name: string) {
    setSelectedQueue(name)
    setReceiving(true)
    setReceiveOpen(true)
    try {
      const r = await instancesApi.receiveMessages(instanceId, name)
      setMessages(r.data as Message[])
    } catch {
      toast.error("Failed to receive messages")
    } finally {
      setReceiving(false)
    }
  }

  function handleSelectQueue(name: string) {
    setAttrsQueue(name)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">SQS Queues</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Queue
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : queues.length === 0 ? (
        <div className="border rounded-lg flex items-center justify-center h-48 text-sm text-muted-foreground">
          No SQS queues found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead className="w-32">Messages</TableHead>
                <TableHead className="w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((q) => (
                <>
                  <TableRow
                    key={q.name}
                    className={`cursor-pointer ${attrsQueue === q.name ? "bg-accent" : ""}`}
                    onClick={() => handleSelectQueue(q.name)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-orange-500 shrink-0" />
                        <span className="font-mono text-sm">{q.name}</span>
                        {q.name.endsWith(".fifo") && <Badge variant="outline" className="text-xs">FIFO</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{q.message_count} msgs</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Receive"
                          onClick={(e) => { e.stopPropagation(); handleReceive(q.name) }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {canMutate && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Send"
                              onClick={(e) => { e.stopPropagation(); setSelectedQueue(q.name); setMessageBody(""); setSendOpen(true) }}
                            >
                              <Send className="h-3.5 w-3.5 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Edit Attributes"
                              onClick={(e) => { e.stopPropagation(); setAttrsQueue(q.name); setEditAttrsOpen(true) }}
                            >
                              <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Purge"
                              onClick={(e) => { e.stopPropagation(); purgeMutation.mutate(q.name) }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-amber-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Delete"
                              onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(q.name) }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {attrsQueue === q.name && (
                    <TableRow key={`${q.name}-attrs`}>
                      <TableCell colSpan={3} className="bg-muted/30 p-0">
                        <div className="px-4 py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Queue Attributes</span>
                            {canMutate && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-xs"
                                onClick={() => setEditAttrsOpen(true)}
                              >
                                <Settings2 className="h-3 w-3 mr-1" />
                                Edit Attributes
                              </Button>
                            )}
                          </div>
                          {attrsLoading ? (
                            <div className="space-y-1">
                              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                            </div>
                          ) : queueAttrs ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground text-xs">Visibility Timeout</span>
                                <span className="text-xs font-mono">{queueAttrs.visibility_timeout}s</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground text-xs">Delay Seconds</span>
                                <span className="text-xs font-mono">{queueAttrs.delay_seconds}s</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground text-xs">Receive Wait Time</span>
                                <span className="text-xs font-mono">{queueAttrs.receive_wait_time}s</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground text-xs">Max Message Size</span>
                                <span className="text-xs font-mono">{(queueAttrs.max_message_size / 1024).toFixed(0)} KB</span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground text-xs">Retention Period</span>
                                <span className="text-xs font-mono">{formatSeconds(queueAttrs.retention_period)}</span>
                              </div>
                              {queueAttrs.dlq_arn && (
                                <div className="col-span-2 md:col-span-3 flex justify-between gap-2">
                                  <span className="text-muted-foreground text-xs">DLQ ARN</span>
                                  <span className="text-xs font-mono truncate max-w-xs">{queueAttrs.dlq_arn}</span>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Queue Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create SQS Queue</DialogTitle></DialogHeader>
          <Input
            placeholder="Queue name"
            value={newQueue}
            onChange={(e) => setNewQueue(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newQueue || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Message Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Message — {selectedQueue}</DialogTitle></DialogHeader>
          <Textarea
            placeholder="Message body…"
            className="h-32"
            value={messageBody}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessageBody(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={() => sendMutation.mutate()} disabled={!messageBody || sendMutation.isPending}>
              <Send className="h-3.5 w-3.5 mr-1" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Messages Dialog */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Messages — {selectedQueue}</DialogTitle></DialogHeader>
          {receiving ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages available</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {messages.map((m) => (
                <div key={m.message_id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className="text-xs font-mono">{m.message_id}</Badge>
                  </div>
                  <p className="text-sm">{m.body}</p>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Attributes Dialog */}
      <Dialog open={editAttrsOpen} onOpenChange={setEditAttrsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Attributes — {attrsQueue}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Visibility Timeout (0–43200 s)</label>
              <Input
                type="number"
                min={0}
                max={43200}
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Delay Seconds (0–900)</label>
              <Input
                type="number"
                min={0}
                max={900}
                value={editDelay}
                onChange={(e) => setEditDelay(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Receive Wait Time (0–20 s)</label>
              <Input
                type="number"
                min={0}
                max={20}
                value={editWaitTime}
                onChange={(e) => setEditWaitTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAttrsOpen(false)}>Cancel</Button>
            <Button onClick={() => setAttrsMutation.mutate()} disabled={setAttrsMutation.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
