"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Trash2, Copy, Check, KeyRound, RefreshCw } from "lucide-react"
import { settingsApi, ApiKeyCreate } from "@/lib/api/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { format, formatDistanceToNow } from "date-fns"

const SCOPES = ["read", "write", "admin"]

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-2 text-muted-foreground hover:text-foreground"
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  )
}

export default function ApiKeysPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)

  const [form, setForm] = useState<ApiKeyCreate>({ name: "", scopes: [], expires_at: undefined })

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => settingsApi.listApiKeys().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body: ApiKeyCreate) => settingsApi.createApiKey(body).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] })
      setShowCreate(false)
      setNewKeyValue(data.key)
      setForm({ name: "", scopes: [] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => settingsApi.revokeApiKey(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  })

  const toggleScope = (scope: string) => {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s) => s !== scope) : [...f.scopes, scope],
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">API Keys</h2>
          <p className="text-sm text-muted-foreground">Bearer tokens for programmatic access</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> Generate Key
        </Button>
      </div>

      {/* Keys list */}
      <div className="border rounded-md divide-y">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No API keys yet. Generate one to get started.
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="p-4 flex items-center gap-4">
              <div className="rounded-full bg-muted p-2 flex-shrink-0">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{key.name}</span>
                  {key.scopes.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                  {key.expires_at && new Date(key.expires_at) < new Date() && (
                    <Badge variant="destructive" className="text-xs">Expired</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {format(new Date(key.created_at), "MMM d, yyyy")}
                  {key.last_used_at && ` · Last used ${formatDistanceToNow(new Date(key.last_used_at))} ago`}
                  {key.expires_at && ` · Expires ${format(new Date(key.expires_at), "MMM d, yyyy")}`}
                </p>
              </div>
              <Button
                variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => revokeMutation.mutate(key.id)}
                disabled={revokeMutation.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate API Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g. CI pipeline"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Scopes</label>
              <div className="flex gap-2">
                {SCOPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleScope(s)}
                    className={`px-3 py-1 rounded text-xs border transition-colors ${
                      form.scopes.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Expires at <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                type="datetime-local"
                onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value ? new Date(e.target.value).toISOString() : undefined }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time key display */}
      <Dialog open={!!newKeyValue} onOpenChange={() => setNewKeyValue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
              Copy this key now — it will not be shown again.
            </p>
            <div className="flex items-center bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
              {newKeyValue}
              {newKeyValue && <CopyButton value={newKeyValue} />}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewKeyValue(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
