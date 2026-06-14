"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, ChevronDown, RefreshCw, Play, Square, Download } from "lucide-react"
import { instancesApi, LogGroup, LogStream, LogEvent } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function levelColor(msg: string) {
  if (/\b(ERROR|FATAL|EXCEPTION)\b/i.test(msg)) return "text-red-400"
  if (/\b(WARN|WARNING)\b/i.test(msg)) return "text-yellow-400"
  if (/\bDEBUG\b/i.test(msg)) return "text-gray-400"
  return "text-green-400"
}

interface StreamEntry extends LogEvent {
  id: string
}

export default function LogsPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [filter, setFilter] = useState("")
  const [liveEvents, setLiveEvents] = useState<StreamEntry[]>([])
  const [tailing, setTailing] = useState(false)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const esRef = useRef<EventSource | null>(null)

  const { data: groups = [], isLoading: groupsLoading, refetch: refetchGroups } = useQuery<LogGroup[]>({
    queryKey: ["log-groups", instanceId],
    queryFn: () => instancesApi.listLogGroups(instanceId).then((r) => r.data),
    enabled: !!instanceId,
  })

  const { data: streams = [] } = useQuery<LogStream[]>({
    queryKey: ["log-streams", instanceId, selectedGroup],
    queryFn: () => instancesApi.listLogStreams(instanceId, selectedGroup!).then((r) => r.data),
    enabled: !!selectedGroup,
  })

  const fetchEvents = useCallback(async () => {
    if (!selectedGroup) return
    setLoadingEvents(true)
    try {
      const resp = await instancesApi.getLogEvents(instanceId, selectedGroup, {
        stream: selectedStream ?? undefined,
        filter: filter || undefined,
        limit: 500,
      })
      setEvents(resp.data.events)
    } finally {
      setLoadingEvents(false)
    }
  }, [instanceId, selectedGroup, selectedStream, filter])

  useEffect(() => {
    if (selectedGroup) fetchEvents()
  }, [selectedGroup, selectedStream, fetchEvents])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [events, liveEvents])

  const startTail = useCallback(() => {
    if (!selectedGroup || esRef.current) return
    setLiveEvents([])
    const url = `${BASE_URL}/api/instances/${instanceId}/monitoring/log-groups/${encodeURIComponent(selectedGroup)}/tail` +
      (filter ? `?filter=${encodeURIComponent(filter)}` : "")
    const es = new EventSource(url, { withCredentials: true })
    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as LogEvent
        setLiveEvents((prev) => [...prev.slice(-999), { ...parsed, id: `${parsed.timestamp}-${Math.random()}` }])
      } catch {
        // ignore ping events
      }
    }
    esRef.current = es
    setTailing(true)
  }, [instanceId, selectedGroup, filter])

  const stopTail = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
    setTailing(false)
  }, [])

  useEffect(() => () => esRef.current?.close(), [])

  const displayedEvents: (LogEvent & { id?: string })[] = tailing ? liveEvents : events

  const download = () => {
    const text = displayedEvents.map((e) =>
      `[${format(new Date(e.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}] ${e.message}`
    ).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }))
    a.download = `${selectedGroup?.replace(/\//g, "_") ?? "logs"}.txt`
    a.click()
  }

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
    setSelectedGroup(name)
    setSelectedStream(null)
    stopTail()
    setEvents([])
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-4">
      {/* Left: log group tree */}
      <div className="w-64 flex-shrink-0 border rounded-md flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <span className="text-sm font-medium">Log Groups</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchGroups()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {groupsLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
            </div>
          ) : groups.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">No log groups found</p>
          ) : (
            <div className="py-1">
              {groups.map((g) => (
                <div key={g.name}>
                  <button
                    className={`w-full flex items-center gap-1 px-3 py-1.5 text-xs hover:bg-accent text-left truncate ${selectedGroup === g.name ? "bg-accent font-medium" : ""}`}
                    onClick={() => toggleGroup(g.name)}
                  >
                    {expandedGroups.has(g.name) ? <ChevronDown className="h-3 w-3 flex-shrink-0" /> : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                    <span className="truncate font-mono">{g.name}</span>
                  </button>
                  {expandedGroups.has(g.name) && (
                    <div className="ml-4">
                      <button
                        className={`w-full px-3 py-1 text-xs hover:bg-accent text-left truncate ${!selectedStream && selectedGroup === g.name ? "text-primary font-medium" : "text-muted-foreground"}`}
                        onClick={() => { setSelectedGroup(g.name); setSelectedStream(null) }}
                      >
                        All streams
                      </button>
                      {streams.filter(() => selectedGroup === g.name).map((s) => (
                        <button
                          key={s.name}
                          className={`w-full px-3 py-1 text-xs hover:bg-accent text-left truncate ${selectedStream === s.name ? "text-primary font-medium" : "text-muted-foreground"}`}
                          onClick={() => { setSelectedGroup(g.name); setSelectedStream(s.name) }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: log viewer */}
      <div className="flex-1 border rounded-md flex flex-col min-w-0">
        <div className="p-3 border-b flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-7 text-xs w-48"
          />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchEvents} disabled={!selectedGroup || loadingEvents}>
            <RefreshCw className="h-3 w-3 mr-1" /> Refresh
          </Button>
          {!tailing ? (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={startTail} disabled={!selectedGroup}>
              <Play className="h-3 w-3 mr-1" /> Live Tail
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-xs text-red-500" onClick={stopTail}>
              <Square className="h-3 w-3 mr-1" /> Stop
            </Button>
          )}
          {tailing && <Badge variant="outline" className="text-xs text-green-500 border-green-500 animate-pulse">LIVE</Badge>}
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto" onClick={download} disabled={displayedEvents.length === 0}>
            <Download className="h-3 w-3" />
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-black/90 font-mono text-xs p-3 space-y-0.5"
        >
          {!selectedGroup ? (
            <p className="text-gray-500 text-center mt-16">Select a log group to view events</p>
          ) : loadingEvents ? (
            <p className="text-gray-500">Loading...</p>
          ) : displayedEvents.length === 0 ? (
            <p className="text-gray-500">No log events found{filter ? ` matching "${filter}"` : ""}</p>
          ) : (
            displayedEvents.map((e, i) => (
              <div key={(e as StreamEntry).id ?? i} className="flex gap-3 hover:bg-white/5 rounded px-1">
                <span className="text-gray-500 flex-shrink-0 select-none">
                  {format(new Date(e.timestamp), "HH:mm:ss.SSS")}
                </span>
                <span className={`break-all ${levelColor(e.message)}`}>{e.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
