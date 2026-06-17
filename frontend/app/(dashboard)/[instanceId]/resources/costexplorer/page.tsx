"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { RefreshCw } from "lucide-react"
import { format, subDays, addDays } from "date-fns"

const GROUP_BY_OPTIONS = [
  { label: "Service", type: "DIMENSION", key: "SERVICE" },
  { label: "Usage Type", type: "DIMENSION", key: "USAGE_TYPE" },
  { label: "Linked Account", type: "DIMENSION", key: "LINKED_ACCOUNT" },
  { label: "Region", type: "DIMENSION", key: "REGION" },
]

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#84cc16"]

interface ResultByTime {
  time_period: { Start?: string; End?: string }
  total: Record<string, { Amount?: string; Unit?: string }>
  groups: { Keys?: string[]; Metrics?: Record<string, { Amount?: string; Unit?: string }> }[]
}

function CostUsageTab({ instanceId }: { instanceId: string }) {
  const [start, setStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"))
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"))
  const [granularity, setGranularity] = useState<"DAILY" | "MONTHLY">("DAILY")
  const [groupByKey, setGroupByKey] = useState(GROUP_BY_OPTIONS[0].key)
  const [submitted, setSubmitted] = useState(false)

  const groupBy = GROUP_BY_OPTIONS.find((g) => g.key === groupByKey) ?? GROUP_BY_OPTIONS[0]

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["cost-and-usage", instanceId, start, end, granularity, groupByKey],
    queryFn: () =>
      instancesApi
        .getCostAndUsage(instanceId, {
          time_period: { start, end },
          granularity,
          group_by: [{ type: groupBy.type, key: groupBy.key }],
          metrics: ["UnblendedCost"],
        })
        .then((r) => r.data as { results_by_time: ResultByTime[] }),
    enabled: submitted,
  })

  const results = data?.results_by_time ?? []

  const { chartData, groupNames } = useMemo(() => {
    const names = new Set<string>()
    const rows = results.map((r) => {
      const row: Record<string, unknown> = { period: r.time_period.Start ?? "" }
      for (const g of r.groups) {
        const name = (g.Keys ?? []).join(" / ") || "Unknown"
        const amount = parseFloat(g.Metrics?.UnblendedCost?.Amount ?? "0")
        row[name] = amount
        names.add(name)
      }
      if (r.groups.length === 0) {
        const amount = parseFloat(r.total?.UnblendedCost?.Amount ?? "0")
        row["Total"] = amount
        names.add("Total")
      }
      return row
    })
    return { chartData: rows, groupNames: Array.from(names) }
  }, [results])

  const tableRows = useMemo(() => {
    const rows: { period: string; group: string; cost: string; unit: string }[] = []
    for (const r of results) {
      if (r.groups.length === 0) {
        rows.push({
          period: r.time_period.Start ?? "",
          group: "Total",
          cost: r.total?.UnblendedCost?.Amount ?? "0",
          unit: r.total?.UnblendedCost?.Unit ?? "USD",
        })
      } else {
        for (const g of r.groups) {
          rows.push({
            period: r.time_period.Start ?? "",
            group: (g.Keys ?? []).join(" / ") || "Unknown",
            cost: g.Metrics?.UnblendedCost?.Amount ?? "0",
            unit: g.Metrics?.UnblendedCost?.Unit ?? "USD",
          })
        }
      }
    }
    return rows
  }, [results])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Start Date</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">End Date</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Granularity</Label>
          <div className="flex gap-3 text-sm h-9 items-center">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={granularity === "DAILY"} onChange={() => setGranularity("DAILY")} /> Daily
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={granularity === "MONTHLY"} onChange={() => setGranularity("MONTHLY")} /> Monthly
            </label>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Group By</Label>
          <Select value={groupByKey} onValueChange={(v) => v && setGroupByKey(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GROUP_BY_OPTIONS.map((g) => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setSubmitted(true); refetch() }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Get Cost Data
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost by {groupBy.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Set filters and click &quot;Get Cost Data&quot;
            </div>
          ) : isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No data found</div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {groupNames.slice(0, 8).map((name, i) => (
                  <Bar key={name} dataKey={name} stackId="cost" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {submitted && !isLoading && tableRows.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{row.period}</TableCell>
                  <TableCell className="text-sm">{row.group}</TableCell>
                  <TableCell className="font-mono text-sm">{parseFloat(row.cost).toFixed(4)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{row.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface ForecastResult {
  time_period: { Start?: string; End?: string }
  mean_value?: string
  MeanValue?: string
}

function ForecastTab({ instanceId }: { instanceId: string }) {
  const [start, setStart] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"))
  const [end, setEnd] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"))
  const [granularity, setGranularity] = useState<"DAILY" | "MONTHLY">("MONTHLY")
  const [submitted, setSubmitted] = useState(false)

  const { data, isLoading, refetch, error } = useQuery({
    queryKey: ["cost-forecast", instanceId, start, end, granularity],
    queryFn: () =>
      instancesApi
        .getCostForecast(instanceId, {
          time_period: { start, end },
          granularity,
          metric: "UNBLENDED_COST",
        })
        .then((r) => r.data as { total: Record<string, unknown>; forecast_results_by_time: Record<string, unknown>[] }),
    enabled: submitted,
    retry: false,
  })

  const chartData = (data?.forecast_results_by_time ?? []).map((r: any) => ({
    period: r.TimePeriod?.Start ?? "",
    forecast: parseFloat(r.MeanValue ?? "0"),
  }))

  const totalAmount = (data?.total as any)?.Amount

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Start Date (future)</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">End Date</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Granularity</Label>
          <div className="flex gap-3 text-sm h-9 items-center">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={granularity === "DAILY"} onChange={() => setGranularity("DAILY")} /> Daily
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={granularity === "MONTHLY"} onChange={() => setGranularity("MONTHLY")} /> Monthly
            </label>
          </div>
        </div>
        <Button size="sm" onClick={() => { setSubmitted(true); refetch() }}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Forecast
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Forecasted Cost</CardTitle>
          {totalAmount && <p className="text-xs text-muted-foreground">Total forecast: ${parseFloat(totalAmount).toFixed(2)}</p>}
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Set a future date range and click &quot;Forecast&quot;
            </div>
          ) : isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
              Could not generate forecast (insufficient historical data or invalid range)
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No forecast data</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={60} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => typeof v === "number" ? v.toFixed(2) : v} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="forecast" name="Forecasted Cost" stroke="#6366f1" strokeWidth={2} dot activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TagsTab({ instanceId }: { instanceId: string }) {
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["cost-allocation-tags", instanceId],
    queryFn: () => instancesApi.listCostAllocationTags(instanceId).then((r) => r.data as { tag_key: string; status: string }[]),
  })

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag Key</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-sm h-24">No cost allocation tags found</TableCell></TableRow>
              ) : tags.map((t) => (
                <TableRow key={t.tag_key}>
                  <TableCell className="font-mono text-sm">{t.tag_key}</TableCell>
                  <TableCell><Badge variant={t.status === "Active" ? "default" : "outline"}>{t.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default function CostExplorerPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Cost Explorer</h2>
      <Tabs defaultValue="cost-usage">
        <TabsList>
          <TabsTrigger value="cost-usage">Cost & Usage</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="tags">Cost Allocation Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="cost-usage"><CostUsageTab instanceId={instanceId} /></TabsContent>
        <TabsContent value="forecast"><ForecastTab instanceId={instanceId} /></TabsContent>
        <TabsContent value="tags"><TagsTab instanceId={instanceId} /></TabsContent>
      </Tabs>
    </div>
  )
}
