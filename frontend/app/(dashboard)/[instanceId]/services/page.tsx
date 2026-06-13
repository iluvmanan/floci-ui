"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

export default function ServicesPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ["instance-services", instanceId],
    queryFn: () => instancesApi.listServices(instanceId).then((r) => r.data as { services: Array<{ name: string; display_name: string; category: string; enabled: boolean; status: string; operation_count: number }> }),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const byCategory = (data?.services ?? []).reduce(
    (acc, svc) => {
      if (!acc[svc.category]) acc[svc.category] = []
      acc[svc.category].push(svc)
      return acc
    },
    {} as Record<string, typeof data.services>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Service Control Panel</h2>
        <Badge variant="outline">Phase 4 — Coming Soon</Badge>
      </div>

      {Object.entries(byCategory).map(([category, services]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 capitalize">
            {category}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {services.map((svc) => (
              <Card key={svc.name} className="relative">
                <CardHeader className="pb-2 pt-3 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{svc.display_name}</CardTitle>
                    <Switch checked={svc.enabled} disabled />
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{svc.operation_count} ops</span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        svc.status === "healthy"
                          ? "bg-green-500"
                          : svc.status === "degraded"
                          ? "bg-yellow-500"
                          : "bg-muted-foreground"
                      }`}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
