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
import { ChevronRight, Mail, Plus, RefreshCw, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface EventBus {
  name: string
  arn: string
}

interface Rule {
  name: string
  arn: string
  state: string
  event_pattern: string | null
  schedule_expression: string | null
  description: string | null
}

interface Target {
  id: string
  arn: string
  input: string | null
  input_path: string | null
}

export default function EventBridgePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createBusOpen, setCreateBusOpen] = useState(false)
  const [busName, setBusName] = useState("")
  const [selectedBus, setSelectedBus] = useState<string | null>(null)

  // Rules
  const [createRuleOpen, setCreateRuleOpen] = useState(false)
  const [ruleName, setRuleName] = useState("")
  const [ruleType, setRuleType] = useState<"pattern" | "schedule">("pattern")
  const [rulePattern, setRulePattern] = useState("")
  const [ruleSchedule, setRuleSchedule] = useState("")
  const [ruleState, setRuleState] = useState("ENABLED")
  const [ruleDescription, setRuleDescription] = useState("")

  // Selected rule for targets
  const [selectedRule, setSelectedRule] = useState<string | null>(null)

  // Targets
  const [addTargetOpen, setAddTargetOpen] = useState(false)
  const [targetId, setTargetId] = useState("")
  const [targetArn, setTargetArn] = useState("")
  const [targetInput, setTargetInput] = useState("")

  // Put Event
  const [putEventOpen, setPutEventOpen] = useState(false)
  const [eventSource, setEventSource] = useState("")
  const [eventDetailType, setEventDetailType] = useState("")
  const [eventDetail, setEventDetail] = useState("{}")

  const { data: buses = [], isLoading, refetch } = useQuery({
    queryKey: ["eventbridge-buses", instanceId],
    queryFn: () => instancesApi.listBuses(instanceId).then((r) => r.data as EventBus[]),
  })

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["eventbridge-rules", instanceId, selectedBus],
    queryFn: () =>
      instancesApi.listRules(instanceId, selectedBus!).then((r) => r.data as Rule[]),
    enabled: !!selectedBus,
  })

  const { data: targets = [], isLoading: targetsLoading } = useQuery({
    queryKey: ["eventbridge-targets", instanceId, selectedBus, selectedRule],
    queryFn: () =>
      instancesApi.listRuleTargets(instanceId, selectedBus!, selectedRule!).then((r) => r.data as Target[]),
    enabled: !!selectedBus && !!selectedRule,
  })

  const createBusMutation = useMutation({
    mutationFn: () => instancesApi.createBus(instanceId, busName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventbridge-buses", instanceId] })
      setCreateBusOpen(false)
      setBusName("")
      toast.success(`Bus "${busName}" created`)
    },
    onError: () => toast.error("Failed to create bus"),
  })

  const createRuleMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: ruleName,
        state: ruleState,
      }
      if (ruleType === "pattern" && rulePattern) body.event_pattern = rulePattern
      if (ruleType === "schedule" && ruleSchedule) body.schedule_expression = ruleSchedule
      if (ruleDescription) body.description = ruleDescription
      return instancesApi.createEventBridgeRule(instanceId, selectedBus!, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventbridge-rules", instanceId, selectedBus] })
      setCreateRuleOpen(false)
      setRuleName("")
      setRulePattern("")
      setRuleSchedule("")
      setRuleDescription("")
      toast.success(`Rule "${ruleName}" created`)
    },
    onError: () => toast.error("Failed to create rule"),
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteEventBridgeRule(instanceId, selectedBus!, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["eventbridge-rules", instanceId, selectedBus] })
      if (selectedRule === name) setSelectedRule(null)
      toast.success(`Rule "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete rule"),
  })

  const addTargetMutation = useMutation({
    mutationFn: () => {
      const t: Record<string, unknown> = { Id: targetId, Arn: targetArn }
      if (targetInput) t.Input = targetInput
      return instancesApi.putRuleTargets(instanceId, selectedBus!, selectedRule!, [t])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventbridge-targets", instanceId, selectedBus, selectedRule] })
      setAddTargetOpen(false)
      setTargetId("")
      setTargetArn("")
      setTargetInput("")
      toast.success("Target added")
    },
    onError: () => toast.error("Failed to add target"),
  })

  const putEventMutation = useMutation({
    mutationFn: () => {
      let detail: Record<string, unknown>
      try {
        detail = JSON.parse(eventDetail)
      } catch {
        throw new Error("Invalid JSON in event detail")
      }
      return instancesApi.putEventBridgeEvent(instanceId, selectedBus!, {
        source: eventSource,
        detail_type: eventDetailType,
        detail,
      })
    },
    onSuccess: () => {
      setPutEventOpen(false)
      setEventSource("")
      setEventDetailType("")
      setEventDetail("{}")
      toast.success("Event put successfully")
    },
    onError: (e: Error) =>
      toast.error(e.message === "Invalid JSON in event detail" ? e.message : "Failed to put event"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">EventBridge Buses</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateBusOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Bus
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bus List */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Buses ({buses.length})
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : buses.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No event buses found</div>
          ) : (
            <ul>
              {buses.map((b) => (
                <li
                  key={b.name}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedBus === b.name ? "bg-accent" : ""
                  }`}
                  onClick={() => { setSelectedBus(b.name); setSelectedRule(null) }}
                >
                  <span className="flex items-center gap-2 text-sm truncate">
                    <Mail className="h-4 w-4 shrink-0 text-purple-500" />
                    <span className="font-medium">{b.name}</span>
                    {b.name === "default" && <Badge variant="secondary" className="text-xs">default</Badge>}
                  </span>
                  <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground shrink-0 ${selectedBus === b.name ? "" : "invisible"}`} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedBus ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a bus to manage rules
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedBus}
                </span>
                <div className="flex gap-2">
                  {canMutate && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => { setEventSource(""); setEventDetailType(""); setEventDetail("{}"); setPutEventOpen(true) }}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Put Event
                    </Button>
                  )}
                </div>
              </div>

              <Tabs defaultValue="rules" className="p-3">
                <TabsList>
                  <TabsTrigger value="rules">Rules</TabsTrigger>
                  {selectedRule && <TabsTrigger value="targets">Targets — {selectedRule}</TabsTrigger>}
                </TabsList>

                <TabsContent value="rules" className="pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Rules ({rules.length})</span>
                    {canMutate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRuleName(""); setRulePattern(""); setRuleSchedule("")
                          setRuleDescription(""); setRuleType("pattern"); setRuleState("ENABLED")
                          setCreateRuleOpen(true)
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Create Rule
                      </Button>
                    )}
                  </div>
                  {rulesLoading ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                    </div>
                  ) : rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No rules for this bus</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>State</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((r) => (
                          <TableRow
                            key={r.name}
                            className="cursor-pointer"
                            onClick={() => setSelectedRule(r.name === selectedRule ? null : r.name)}
                          >
                            <TableCell className="font-mono text-xs">{r.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {r.schedule_expression ? "Schedule" : "Event Pattern"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={r.state === "ENABLED" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {r.state}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={(e) => { e.stopPropagation(); setSelectedRule(r.name) }}
                                >
                                  Targets
                                </Button>
                                {canMutate && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => { e.stopPropagation(); deleteRuleMutation.mutate(r.name) }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {selectedRule && (
                  <TabsContent value="targets" className="pt-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Targets ({targets.length})</span>
                      {canMutate && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setTargetId(""); setTargetArn(""); setTargetInput(""); setAddTargetOpen(true) }}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add Target
                        </Button>
                      )}
                    </div>
                    {targetsLoading ? (
                      <div className="space-y-2">
                        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10" />)}
                      </div>
                    ) : targets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No targets for this rule</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>ARN</TableHead>
                            <TableHead>Input</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {targets.map((t) => (
                            <TableRow key={t.id}>
                              <TableCell className="font-mono text-xs">{t.id}</TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                                {t.arn}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {t.input ? t.input.slice(0, 30) + (t.input.length > 30 ? "…" : "") : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Create Bus Dialog */}
      <Dialog open={createBusOpen} onOpenChange={setCreateBusOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Event Bus</DialogTitle></DialogHeader>
          <Input
            placeholder="Bus name"
            value={busName}
            onChange={(e) => setBusName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBusOpen(false)}>Cancel</Button>
            <Button onClick={() => createBusMutation.mutate()} disabled={!busName || createBusMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Rule Dialog */}
      <Dialog open={createRuleOpen} onOpenChange={setCreateRuleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Rule — {selectedBus}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Rule Name</label>
              <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={ruleType === "pattern"}
                    onChange={() => setRuleType("pattern")}
                  />
                  Event Pattern
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={ruleType === "schedule"}
                    onChange={() => setRuleType("schedule")}
                  />
                  Schedule Expression
                </label>
              </div>
            </div>
            {ruleType === "pattern" ? (
              <div>
                <label className="text-sm font-medium">Event Pattern (JSON)</label>
                <Textarea
                  placeholder='{"source": ["aws.ec2"]}'
                  className="h-24 font-mono text-xs mt-1"
                  value={rulePattern}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRulePattern(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Schedule Expression</label>
                <Input
                  placeholder="rate(5 minutes) or cron(0 12 * * ? *)"
                  value={ruleSchedule}
                  onChange={(e) => setRuleSchedule(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">State</label>
              <div className="flex gap-3 mt-1">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={ruleState === "ENABLED"}
                    onChange={() => setRuleState("ENABLED")}
                  />
                  Enabled
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={ruleState === "DISABLED"}
                    onChange={() => setRuleState("DISABLED")}
                  />
                  Disabled
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateRuleOpen(false)}>Cancel</Button>
            <Button onClick={() => createRuleMutation.mutate()} disabled={!ruleName || createRuleMutation.isPending}>
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Target Dialog */}
      <Dialog open={addTargetOpen} onOpenChange={setAddTargetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Target — {selectedRule}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Target ID</label>
              <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Target ARN</label>
              <Input
                placeholder="arn:aws:lambda:…"
                value={targetArn}
                onChange={(e) => setTargetArn(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Input JSON (optional)</label>
              <Textarea
                placeholder='{"key": "value"}'
                className="h-24 font-mono text-xs mt-1"
                value={targetInput}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTargetInput(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTargetOpen(false)}>Cancel</Button>
            <Button
              onClick={() => addTargetMutation.mutate()}
              disabled={!targetId || !targetArn || addTargetMutation.isPending}
            >
              Add Target
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Put Event Dialog */}
      <Dialog open={putEventOpen} onOpenChange={setPutEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Put Event — {selectedBus}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Source</label>
              <Input
                placeholder="e.g. myapp.orders"
                value={eventSource}
                onChange={(e) => setEventSource(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Detail Type</label>
              <Input
                placeholder="e.g. Order Placed"
                value={eventDetailType}
                onChange={(e) => setEventDetailType(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Detail (JSON)</label>
              <Textarea
                placeholder='{"orderId": "123"}'
                className="h-28 font-mono text-xs mt-1"
                value={eventDetail}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEventDetail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPutEventOpen(false)}>Cancel</Button>
            <Button
              onClick={() => putEventMutation.mutate()}
              disabled={!eventSource || !eventDetailType || putEventMutation.isPending}
            >
              <Send className="h-3.5 w-3.5 mr-1" />
              Put Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
