"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function S3Page() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">S3 Buckets</h2>
        <Badge variant="outline">Phase 5 — Coming Soon</Badge>
      </div>
      <Card>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground text-sm">
          S3 bucket browser will be available in Phase 5
        </CardContent>
      </Card>
    </div>
  )
}
