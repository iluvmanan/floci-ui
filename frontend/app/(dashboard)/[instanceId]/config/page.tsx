"use client"

import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

export default function ConfigPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const { data: config, isLoading } = useQuery({
    queryKey: ["instance-config", instanceId],
    queryFn: () => instancesApi.getConfig(instanceId).then((r) => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Manage environment variables for this Floci instance
          </p>
        </div>
        <Badge variant="outline">Phase 3 — Coming Soon</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current Config</CardTitle>
          <CardDescription>Stored configuration values</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
            {JSON.stringify(config, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
