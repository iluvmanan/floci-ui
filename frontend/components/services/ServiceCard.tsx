"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export interface Service {
  name: string
  display_name: string
  category: string
  description: string
  operation_count: number
  env_key: string
  enabled: boolean
  status: "unknown" | "healthy" | "degraded" | "unreachable"
  status_checked_at: string | null
}

interface Props {
  service: Service
  instanceId: string
  canToggle: boolean
}

function StatusDot({ status, enabled }: { status: Service["status"]; enabled: boolean }) {
  if (!enabled) {
    return <span className="h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
  }
  const classes = {
    healthy: "bg-green-500 animate-pulse",
    degraded: "bg-yellow-500 animate-pulse",
    unreachable: "bg-red-500",
    unknown: "bg-muted-foreground/60",
  }
  return <span className={cn("h-2 w-2 rounded-full flex-shrink-0", classes[status])} />
}

export function ServiceCard({ service, instanceId, canToggle }: Props) {
  const qc = useQueryClient()
  const [pending, setPending] = useState(false)

  async function handleToggle(enabled: boolean) {
    setPending(true)
    try {
      await instancesApi.updateService(instanceId, service.name, enabled)
      qc.invalidateQueries({ queryKey: ["instance-services", instanceId] })
      toast.success(`${service.display_name} ${enabled ? "enabled" : "disabled"}`)
    } catch {
      toast.error(`Failed to update ${service.display_name}`)
    } finally {
      setPending(false)
    }
  }

  return (
    <Card className={cn("transition-opacity", !service.enabled && "opacity-60")}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{service.display_name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
              {service.description}
            </p>
          </div>
          <Switch
            checked={service.enabled}
            onCheckedChange={handleToggle}
            disabled={!canToggle || pending}
            className="flex-shrink-0 mt-0.5"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{service.operation_count} ops</span>
          <StatusDot status={service.status} enabled={service.enabled} />
        </div>
      </CardContent>
    </Card>
  )
}
