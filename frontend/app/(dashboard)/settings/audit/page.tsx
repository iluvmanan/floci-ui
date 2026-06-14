"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Download, RefreshCw } from "lucide-react"
import { settingsApi, AuditParams } from "@/lib/api/settings"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { format } from "date-fns"

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-600",
  update: "bg-blue-500/10 text-blue-600",
  delete: "bg-red-500/10 text-red-600",
  login: "bg-purple-500/10 text-purple-600",
}

function actionColor(action: string) {
  const verb = action.split("_")[0]
  return ACTION_COLORS[verb] ?? "bg-muted text-muted-foreground"
}

const PAGE_SIZE = 50

export default function AuditPage() {
  const [params, setParams] = useState<AuditParams>({ limit: PAGE_SIZE, offset: 0 })
  const [filterEmail, setFilterEmail] = useState("")
  const [filterAction, setFilterAction] = useState("")

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["audit", params],
    queryFn: () => settingsApi.listAudit(params).then((r) => r.data),
  })

  const applyFilters = () => {
    setParams((p) => ({
      ...p,
      offset: 0,
      user_email: filterEmail || undefined,
      action: filterAction || undefined,
    }))
  }

  const clearFilters = () => {
    setFilterEmail("")
    setFilterAction("")
    setParams({ limit: PAGE_SIZE, offset: 0 })
  }

  const exportCsv = async () => {
    const resp = await settingsApi.exportAuditCsv({
      user_email: params.user_email,
      action: params.action,
    })
    const url = URL.createObjectURL(resp.data as Blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const total = data?.total ?? 0
  const offset = params.offset ?? 0
  const pages = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Audit Log</h2>
          <p className="text-sm text-muted-foreground">All mutating API actions performed by users</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Input
          placeholder="Filter by email"
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="h-8 text-xs w-48"
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
        <Input
          placeholder="Filter by action"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="h-8 text-xs w-48"
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />
        <Button size="sm" className="h-8 text-xs" onClick={applyFilters}>Apply</Button>
        {(params.user_email || params.action) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>Clear</Button>
        )}
        {total > 0 && (
          <span className="text-xs text-muted-foreground self-center ml-auto">
            {total} entries
          </span>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Time</th>
              <th className="text-left p-3 font-medium">User</th>
              <th className="text-left p-3 font-medium">Action</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Instance</th>
              <th className="text-left p-3 font-medium hidden lg:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="p-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="p-3 hidden md:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="p-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                </tr>
              ))
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">No audit entries found</td>
              </tr>
            ) : (
              data?.items.map((entry) => (
                <tr key={entry.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-muted-foreground whitespace-nowrap">
                    {format(new Date(entry.created_at), "MM-dd HH:mm:ss")}
                  </td>
                  <td className="p-3 truncate max-w-[180px]">
                    {entry.user_email ?? <span className="text-muted-foreground italic">system</span>}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColor(entry.action)}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3 hidden md:table-cell font-mono text-muted-foreground truncate max-w-[120px]">
                    {entry.instance_id ? entry.instance_id.slice(0, 8) + "…" : "—"}
                  </td>
                  <td className="p-3 hidden lg:table-cell font-mono text-muted-foreground">
                    {entry.ip_address ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-2 justify-end text-xs">
          <Button
            variant="outline" size="sm" className="h-7"
            disabled={offset === 0}
            onClick={() => setParams((p) => ({ ...p, offset: Math.max(0, (p.offset ?? 0) - PAGE_SIZE) }))}
          >
            Previous
          </Button>
          <span className="text-muted-foreground">Page {currentPage} of {pages}</span>
          <Button
            variant="outline" size="sm" className="h-7"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setParams((p) => ({ ...p, offset: (p.offset ?? 0) + PAGE_SIZE }))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
