"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LogsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CloudWatch Logs</h2>
        <Badge variant="outline">Phase 6 — Coming Soon</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Log Viewer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            Live log streaming via SSE will be available in Phase 6
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
