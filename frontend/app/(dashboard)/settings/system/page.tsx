"use client"

import { useQuery } from "@tanstack/react-query"
import { Database, Clock, Users, Server, RefreshCw, ExternalLink } from "lucide-react"
import { settingsApi } from "@/lib/api/settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: React.ReactNode; sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-0.5">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${seconds % 60}s`
}

export default function SystemPage() {
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["system-health"],
    queryFn: () => settingsApi.getHealth().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ["system-info"],
    queryFn: () => settingsApi.getInfo().then((r) => r.data),
    refetchInterval: 30000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">System</h2>
          <p className="text-sm text-muted-foreground">Application health and runtime statistics</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchHealth()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Health status banner */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${
              healthLoading ? "bg-gray-300 animate-pulse" :
              health?.status === "ok" ? "bg-green-500" : "bg-red-500"
            }`} />
            <span className="font-medium">
              {healthLoading ? "Checking…" : health?.status === "ok" ? "All systems operational" : "Degraded"}
            </span>
            <Badge variant="outline" className="ml-auto text-xs">
              v{health?.version ?? "—"}
            </Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Database</span>
              <span className={`ml-auto font-medium ${health?.db ? "text-green-600" : "text-red-600"}`}>
                {healthLoading ? "—" : health?.db ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {infoLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              icon={Clock}
              label="Uptime"
              value={info ? formatUptime(info.uptime_s) : "—"}
              sub={info ? `Started ${new Date(info.started_at).toLocaleString()}` : undefined}
            />
            <StatCard
              icon={Server}
              label="Version"
              value={info?.version ?? "—"}
            />
            <StatCard
              icon={Users}
              label="Users"
              value={info?.user_count ?? "—"}
            />
            <StatCard
              icon={Database}
              label="Instances"
              value={info?.instance_count ?? "—"}
            />
          </>
        )}
      </div>

      {/* Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="https://github.com/anthropics/floci/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            Check for updates on GitHub
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
