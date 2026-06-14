"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { RefreshCw } from "lucide-react"
import { instancesApi, MetricDef } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { format, subHours } from "date-fns"

const TIME_RANGES = [
  { label: "1h", hours: 1, period: 60 },
  { label: "3h", hours: 3, period: 300 },
  { label: "12h", hours: 12, period: 600 },
  { label: "24h", hours: 24, period: 3600 },
  { label: "7d", hours: 168, period: 86400 },
]

const STATISTICS = ["Average", "Sum", "Minimum", "Maximum", "SampleCount"]

export default function MetricsPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const [namespace, setNamespace] = useState("")
  const [selectedMetric, setSelectedMetric] = useState<MetricDef | null>(null)
  const [statistic, setStatistic] = useState("Average")
  const [timeRange, setTimeRange] = useState(TIME_RANGES[0])

  const { data: namespaces = [], isLoading: nsLoading } = useQuery<string[]>({
    queryKey: ["namespaces", instanceId],
    queryFn: () => instancesApi.listNamespaces(instanceId).then((r) => r.data),
    enabled: !!instanceId,
  })

  const { data: metrics = [], isLoading: metricsLoading } = useQuery<MetricDef[]>({
    queryKey: ["metrics", instanceId, namespace],
    queryFn: () => instancesApi.listMetrics(instanceId, namespace || undefined).then((r) => r.data),
    enabled: !!namespace,
  })

  const now = Date.now()
  const startMs = subHours(now, timeRange.hours).getTime()

  const { data: metricData, isLoading: dataLoading, refetch } = useQuery({
    queryKey: ["metric-data", instanceId, selectedMetric?.namespace, selectedMetric?.name, statistic, timeRange.label],
    queryFn: () =>
      instancesApi.getMetricData(instanceId, {
        namespace: selectedMetric!.namespace,
        metric_name: selectedMetric!.name,
        statistic,
        period: timeRange.period,
        start: startMs,
        end: now,
        dimension_name: selectedMetric!.dimensions[0]?.Name,
        dimension_value: selectedMetric!.dimensions[0]?.Value,
      }).then((r) => r.data),
    enabled: !!selectedMetric,
  })

  const chartData = (metricData?.datapoints ?? []).map((d) => ({
    time: format(new Date(d.timestamp), "HH:mm"),
    value: d.value,
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">CloudWatch Metrics</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!selectedMetric || dataLoading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Namespace</p>
          {nsLoading ? (
            <Skeleton className="h-9 w-48" />
          ) : (
            <Select value={namespace} onValueChange={(v) => { setNamespace(v ?? ""); setSelectedMetric(null) }}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Select namespace" />
              </SelectTrigger>
              <SelectContent>
                {namespaces.map((ns) => (
                  <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Metric</p>
          {metricsLoading && namespace ? (
            <Skeleton className="h-9 w-64" />
          ) : (
            <Select
              value={selectedMetric?.name ?? ""}
              onValueChange={(v) => setSelectedMetric(metrics.find((m) => m.name === v) ?? null)}
              disabled={!namespace || metrics.length === 0}
            >
              <SelectTrigger className="w-64 h-9">
                <SelectValue placeholder={namespace ? "Select metric" : "Select namespace first"} />
              </SelectTrigger>
              <SelectContent>
                {metrics.map((m) => (
                  <SelectItem key={`${m.namespace}-${m.name}`} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Statistic</p>
          <Select value={statistic} onValueChange={(v) => setStatistic(v ?? statistic)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATISTICS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Time Range</p>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <Button
                key={r.label}
                variant={timeRange.label === r.label ? "default" : "outline"}
                size="sm"
                className="h-9 px-3"
                onClick={() => setTimeRange(r)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedMetric ? `${selectedMetric.namespace} / ${selectedMetric.name} (${statistic})` : "Select a metric to display"}
          </CardTitle>
          {metricData && (
            <p className="text-xs text-muted-foreground">Unit: {metricData.unit}</p>
          )}
        </CardHeader>
        <CardContent>
          {!selectedMetric ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Choose a namespace and metric above
            </div>
          ) : dataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              No data points in the selected time range
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(v) => [typeof v === "number" ? v.toFixed(2) : v, selectedMetric.name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={selectedMetric.name}
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={chartData.length < 30}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Metric details */}
      {selectedMetric && selectedMetric.dimensions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Dimensions</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {selectedMetric.dimensions.map((d) => (
                <div key={d.Name} className="flex gap-2">
                  <dt className="text-muted-foreground">{d.Name}:</dt>
                  <dd className="font-mono">{d.Value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
