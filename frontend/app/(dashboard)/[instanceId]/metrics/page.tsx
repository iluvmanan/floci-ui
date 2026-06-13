"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function MetricsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CloudWatch Metrics</h2>
        <Badge variant="outline">Phase 6 — Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Metrics Charts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Recharts-based metrics visualization will be available in Phase 6
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
