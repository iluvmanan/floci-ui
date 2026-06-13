"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { instancesApi, type InstanceCreate } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface Props {
  open: boolean
  onClose: () => void
}

const DEFAULTS: InstanceCreate = {
  name: "",
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  access_key: "test",
  secret_key: "test",
  account_id: "000000000000",
  tls_verify: false,
}

export function InstanceFormDialog({ open, onClose }: Props) {
  const qc = useQueryClient()
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(false)

  function update(key: keyof InstanceCreate, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await instancesApi.create(form)
      toast.success(`Instance "${form.name}" added`)
      qc.invalidateQueries({ queryKey: ["instances"] })
      setForm(DEFAULTS)
      onClose()
    } catch {
      toast.error("Failed to add instance")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Floci Instance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Local Dev"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endpoint">Endpoint *</Label>
            <Input
              id="endpoint"
              placeholder="http://localhost:4566"
              value={form.endpoint}
              onChange={(e) => update("endpoint", e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={form.region}
                onChange={(e) => update("region", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_id">Account ID</Label>
              <Input
                id="account_id"
                value={form.account_id}
                onChange={(e) => update("account_id", e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="access_key">Access Key</Label>
              <Input
                id="access_key"
                value={form.access_key}
                onChange={(e) => update("access_key", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret_key">Secret Key</Label>
              <Input
                id="secret_key"
                type="password"
                value={form.secret_key}
                onChange={(e) => update("secret_key", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="tls_verify"
              checked={form.tls_verify}
              onCheckedChange={(v) => update("tls_verify", v)}
            />
            <Label htmlFor="tls_verify">Verify TLS</Label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Instance"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
