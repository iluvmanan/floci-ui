"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, RefreshCw, Settings, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { type Instance, instancesApi } from "@/lib/api/instances"
import { StatusBadge } from "./StatusBadge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"

export function InstanceCard({ instance }: { instance: Instance }) {
  const qc = useQueryClient()
  const [checking, setChecking] = useState(false)

  async function runHealthCheck() {
    setChecking(true)
    try {
      const { data } = await instancesApi.healthCheck(instance.id)
      toast.success(`Health check: ${data.status} (${Math.round(data.latency_ms ?? 0)}ms)`)
      qc.invalidateQueries({ queryKey: ["instances"] })
    } catch {
      toast.error("Health check failed")
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{instance.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{instance.endpoint}</p>
          </div>
          <StatusBadge status={instance.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Region</span>
            <span className="font-mono">{instance.region}</span>
          </div>
          <div className="flex justify-between">
            <span>Account</span>
            <span className="font-mono">{instance.account_id}</span>
          </div>
          {instance.last_checked_at && (
            <div className="flex justify-between">
              <span>Last checked</span>
              <span>{formatDistanceToNow(new Date(instance.last_checked_at), { addSuffix: true })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <Button asChild variant="default" size="sm" className="flex-1">
            <Link href={`/${instance.id}/config`}>
              <Settings className="h-3.5 w-3.5 mr-1" />
              Manage
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={runHealthCheck}
            disabled={checking}
            title="Run health check"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
