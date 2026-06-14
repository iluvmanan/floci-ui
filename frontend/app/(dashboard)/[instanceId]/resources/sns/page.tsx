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
import { Plus, Radio, RefreshCw, Send, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

interface Topic {
  arn: string
  name: string
}

interface Subscription {
  arn: string
  protocol: string
  endpoint: string
  topic_arn: string
  owner: string
}

interface TopicAttributes {
  arn: string
  subscriptions_confirmed: string
  subscriptions_pending: string
  subscriptions_deleted: string
}

const PROTOCOLS = ["email", "sqs", "http", "https", "lambda", "sms"]

export default function SNSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [newTopic, setNewTopic] = useState("")
  const [selectedArn, setSelectedArn] = useState<string | null>(null)
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [message, setMessage] = useState("")

  // Subscribe form
  const [subProtocol, setSubProtocol] = useState("email")
  const [subEndpoint, setSubEndpoint] = useState("")

  const { data: topics = [], isLoading, refetch } = useQuery({
    queryKey: ["sns-topics", instanceId],
    queryFn: () => instancesApi.listTopics(instanceId).then((r) => r.data as Topic[]),
  })

  const { data: allSubscriptions = [] } = useQuery({
    queryKey: ["sns-subscriptions", instanceId],
    queryFn: () => instancesApi.listSubscriptions(instanceId).then((r) => r.data as Subscription[]),
    enabled: !!selectedArn,
  })

  const { data: topicAttrs } = useQuery({
    queryKey: ["sns-topic-attrs", instanceId, selectedArn],
    queryFn: () =>
      instancesApi.getTopicAttributes(instanceId, selectedArn!).then((r) => r.data as TopicAttributes),
    enabled: !!selectedArn,
  })

  const topicSubscriptions = allSubscriptions.filter((s) => s.topic_arn === selectedArn)

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
      if (selectedArn) setSelectedArn(null)
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

  const subscribeMutation = useMutation({
    mutationFn: () =>
      instancesApi.subscribeToTopic(instanceId, selectedArn!, { protocol: subProtocol, endpoint: subEndpoint }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sns-subscriptions", instanceId] })
      setSubscribeOpen(false)
      setSubEndpoint("")
      toast.success("Subscribed successfully")
    },
    onError: () => toast.error("Failed to subscribe"),
  })

  const unsubscribeMutation = useMutation({
    mutationFn: (subArn: string) => instancesApi.unsubscribe(instanceId, subArn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sns-subscriptions", instanceId] })
      toast.success("Unsubscribed")
    },
    onError: () => toast.error("Failed to unsubscribe"),
  })

  function selectTopic(t: Topic) {
    setSelectedArn(t.arn)
    setSelectedName(t.name)
  }

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Topic List */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Topics ({topics.length})
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : topics.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No SNS topics found</div>
          ) : (
            <ul>
              {topics.map((t) => (
                <li
                  key={t.arn}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedArn === t.arn ? "bg-accent" : ""
                  }`}
                  onClick={() => selectTopic(t)}
                >
                  <span className="flex items-center gap-2 text-sm truncate">
                    <Radio className="h-4 w-4 shrink-0 text-pink-500" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{t.name}</div>
                      {t.name.endsWith(".fifo") && <Badge variant="outline" className="text-xs">FIFO</Badge>}
                    </div>
                  </span>
                  {canMutate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(t.arn) }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedArn ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a topic to view details
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    {selectedName}
                  </span>
                  {topicAttrs && (
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        {topicAttrs.subscriptions_confirmed} confirmed
                      </Badge>
                      {Number(topicAttrs.subscriptions_pending) > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {topicAttrs.subscriptions_pending} pending
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="publish" className="p-3">
                <TabsList>
                  <TabsTrigger value="publish">Publish</TabsTrigger>
                  <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
                </TabsList>

                <TabsContent value="publish" className="pt-3 space-y-3">
                  <Textarea
                    placeholder="Message to publish…"
                    className="h-32"
                    value={message}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                  />
                  {canMutate && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate()}
                        disabled={!message || publishMutation.isPending}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Publish
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="subscriptions" className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Subscriptions ({topicSubscriptions.length})</span>
                    {canMutate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setSubEndpoint(""); setSubProtocol("email"); setSubscribeOpen(true) }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Subscribe
                      </Button>
                    )}
                  </div>
                  {topicSubscriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No subscriptions for this topic</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Protocol</TableHead>
                          <TableHead>Endpoint</TableHead>
                          <TableHead className="font-mono text-xs">ARN</TableHead>
                          {canMutate && <TableHead className="w-16" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topicSubscriptions.map((s) => (
                          <TableRow key={s.arn}>
                            <TableCell>
                              <Badge variant="outline" className="text-xs uppercase">{s.protocol}</Badge>
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[200px]">{s.endpoint}</TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">
                              {s.arn.length > 40 ? `…${s.arn.slice(-30)}` : s.arn}
                            </TableCell>
                            {canMutate && (
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={s.arn === "PendingConfirmation"}
                                  onClick={() => unsubscribeMutation.mutate(s.arn)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
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

      {/* Create Topic Dialog */}
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

      {/* Subscribe Dialog */}
      <Dialog open={subscribeOpen} onOpenChange={setSubscribeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Subscribe — {selectedName}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Protocol</label>
              <select
                className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
                value={subProtocol}
                onChange={(e) => setSubProtocol(e.target.value)}
              >
                {PROTOCOLS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Endpoint</label>
              <Input
                placeholder="e.g. email@example.com or arn:aws:sqs:…"
                value={subEndpoint}
                onChange={(e) => setSubEndpoint(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscribeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => subscribeMutation.mutate()}
              disabled={!subEndpoint || subscribeMutation.isPending}
            >
              Subscribe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
