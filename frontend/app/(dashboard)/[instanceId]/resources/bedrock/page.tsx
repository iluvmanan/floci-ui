"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Send, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface BedrockModel {
  model_id: string
  model_name: string
  provider_name: string
  input_modalities: string[]
  output_modalities: string[]
  response_streaming_supported: boolean
  customizations_supported: string[]
}

interface ChatMessage {
  role: "user" | "assistant"
  text: string
}

export default function BedrockPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const [filter, setFilter] = useState("")
  const [selectedModel, setSelectedModel] = useState<BedrockModel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "user", text: "" }])
  const [rawBody, setRawBody] = useState("{}")
  const [response, setResponse] = useState<unknown>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [invokeError, setInvokeError] = useState<string | null>(null)

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["bedrock-models", instanceId],
    queryFn: () => instancesApi.listBedrockModels(instanceId).then((r) => r.data as BedrockModel[]),
  })

  const grouped = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const filtered = q
      ? models.filter((m) => m.model_name.toLowerCase().includes(q) || m.model_id.toLowerCase().includes(q))
      : models
    const groups: Record<string, BedrockModel[]> = {}
    for (const m of filtered) {
      const key = m.provider_name || "Other"
      groups[key] = groups[key] || []
      groups[key].push(m)
    }
    return groups
  }, [models, filter])

  const isAnthropic = selectedModel?.model_id.toLowerCase().includes("anthropic") ?? false

  const invokeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedModel) throw new Error("No model selected")
      let body: Record<string, unknown>
      if (isAnthropic) {
        body = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1024,
          messages: messages
            .filter((m) => m.text.trim())
            .map((m) => ({ role: m.role, content: m.text })),
        }
      } else {
        body = JSON.parse(rawBody)
      }
      const start = Date.now()
      const r = await instancesApi.invokeBedrockModel(instanceId, selectedModel.model_id, { body })
      setLatencyMs(Date.now() - start)
      return r.data
    },
    onSuccess: (data) => {
      setResponse((data as { body: unknown }).body)
      setInvokeError(null)
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Failed to invoke model"
      setInvokeError(message)
      toast.error(message)
    },
  })

  function handleInvoke() {
    setResponse(null)
    setInvokeError(null)
    if (!isAnthropic) {
      try {
        JSON.parse(rawBody)
      } catch {
        toast.error("Invalid JSON body")
        return
      }
    }
    invokeMutation.mutate()
  }

  function selectModel(m: BedrockModel) {
    setSelectedModel(m)
    setResponse(null)
    setLatencyMs(null)
    setInvokeError(null)
    setMessages([{ role: "user", text: "" }])
    setRawBody("{}")
  }

  return (
    <div className="flex gap-4">
      {/* Left: model browser */}
      <div className="w-72 shrink-0 space-y-3">
        <h2 className="text-lg font-medium">Bedrock</h2>
        <Input placeholder="Filter models..." value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 text-xs" />
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto">
            {Object.entries(grouped).map(([provider, ms]) => (
              <div key={provider}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">{provider}</div>
                <div className="space-y-0.5">
                  {ms.map((m) => (
                    <button
                      key={m.model_id}
                      onClick={() => selectModel(m)}
                      className={`block w-full text-left text-xs px-2 py-1.5 rounded ${
                        selectedModel?.model_id === m.model_id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`}
                    >
                      {m.model_name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No models found</p>
            )}
          </div>
        )}
      </div>

      {/* Right: invocation playground */}
      <div className="flex-1 min-w-0 space-y-3">
        {!selectedModel ? (
          <p className="text-sm text-muted-foreground">Select a model from the list to begin.</p>
        ) : (
          <>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{selectedModel.model_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedModel.model_id}</p>
                </div>
                <div className="flex gap-1.5">
                  {selectedModel.input_modalities.map((m) => (
                    <Badge key={`in-${m}`} variant="outline" className="text-xs">in:{m}</Badge>
                  ))}
                  {selectedModel.output_modalities.map((m) => (
                    <Badge key={`out-${m}`} variant="outline" className="text-xs">out:{m}</Badge>
                  ))}
                  {selectedModel.response_streaming_supported && (
                    <Badge variant="secondary" className="text-xs">streaming</Badge>
                  )}
                  {selectedModel.customizations_supported.length > 0 && (
                    <Badge variant="secondary" className="text-xs">customizable</Badge>
                  )}
                </div>
              </div>
            </div>

            {isAnthropic ? (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Messages</Label>
                {messages.map((m, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <select
                      value={m.role}
                      onChange={(e) => {
                        const next = [...messages]
                        next[i] = { ...next[i], role: e.target.value as "user" | "assistant" }
                        setMessages(next)
                      }}
                      className="h-8 text-xs border rounded px-2 bg-background"
                    >
                      <option value="user">user</option>
                      <option value="assistant">assistant</option>
                    </select>
                    <Textarea
                      value={m.text}
                      onChange={(e) => {
                        const next = [...messages]
                        next[i] = { ...next[i], text: e.target.value }
                        setMessages(next)
                      }}
                      className="flex-1 text-sm"
                      rows={2}
                    />
                    {messages.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMessages(messages.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setMessages([...messages, { role: "user", text: "" }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Message
                </Button>
              </div>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">Request Body (JSON)</Label>
                <Textarea value={rawBody} onChange={(e) => setRawBody(e.target.value)} className="mt-1 font-mono text-xs" rows={8} />
              </div>
            )}

            <Button onClick={handleInvoke} disabled={invokeMutation.isPending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {invokeMutation.isPending ? "Invoking…" : "Invoke"}
            </Button>

            {latencyMs !== null && (
              <p className="text-xs text-muted-foreground">Latency: {latencyMs} ms</p>
            )}

            {invokeError && (
              <div className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2 bg-destructive/5">
                {invokeError}
              </div>
            )}

            {response !== null && response !== undefined ? (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Response</Label>
                <pre className="text-xs bg-muted rounded p-3 overflow-x-auto max-h-96">{JSON.stringify(response, null, 2)}</pre>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
