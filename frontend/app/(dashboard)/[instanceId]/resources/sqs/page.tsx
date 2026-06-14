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
import { Download, MessageSquare, Plus, RefreshCw, Send, Trash2 } from "lucide-react"
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

  const { data: queues = [], isLoading, refetch } = useQuery({
    queryKey: ["sqs-queues", instanceId],
    queryFn: () => instancesApi.listQueues(instanceId).then((r) => r.data as Queue[]),
  })

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
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queues.map((q) => (
                <TableRow key={q.name}>
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
                        onClick={() => handleReceive(q.name)}
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
                            onClick={() => { setSelectedQueue(q.name); setMessageBody(""); setSendOpen(true) }}
                          >
                            <Send className="h-3.5 w-3.5 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Purge"
                            onClick={() => purgeMutation.mutate(q.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-amber-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Delete"
                            onClick={() => deleteMutation.mutate(q.name)}
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
    </div>
  )
}
