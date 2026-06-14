"use client"

import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Search } from "lucide-react"
import { instancesApi } from "@/lib/api/instances"
import { ServiceCard, type Service } from "@/components/services/ServiceCard"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

const CATEGORIES = [
  { key: "compute", label: "Compute" },
  { key: "storage", label: "Storage" },
  { key: "messaging", label: "Messaging" },
  { key: "security", label: "Security & Identity" },
  { key: "analytics", label: "Analytics" },
  { key: "infrastructure", label: "Infrastructure" },
]

export default function ServicesPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const [search, setSearch] = useState("")

  const canToggle = user?.role === "admin" || user?.role === "superadmin" || user?.role === "operator"

  const { data, isLoading } = useQuery({
    queryKey: ["instance-services", instanceId],
    queryFn: () =>
      instancesApi
        .listServices(instanceId)
        .then((r) => (r.data as { services: Service[] }).services),
    refetchInterval: 60_000,
  })

  const services = data ?? []

  const filtered = useMemo(() => {
    if (!search) return services
    const q = search.toLowerCase()
    return services.filter(
      (s) => s.name.includes(q) || s.display_name.toLowerCase().includes(q)
    )
  }, [services, search])

  const byCategory = useMemo(() => {
    const map: Record<string, Service[]> = {}
    for (const svc of filtered) {
      if (!map[svc.category]) map[svc.category] = []
      map[svc.category].push(svc)
    }
    return map
  }, [filtered])

  const batchMutation = useMutation({
    mutationFn: (payload: { name: string; enabled: boolean }[]) =>
      instancesApi.batchUpdateServices(instanceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instance-services", instanceId] })
      toast.success("Services updated")
    },
    onError: () => toast.error("Batch update failed"),
  })

  function enableAll() {
    batchMutation.mutate(services.map((s) => ({ name: s.name, enabled: true })))
  }

  function disableAll() {
    batchMutation.mutate(services.map((s) => ({ name: s.name, enabled: false })))
  }

  function enableCategory(category: string) {
    const catServices = services.filter((s) => s.category === category)
    batchMutation.mutate(catServices.map((s) => ({ name: s.name, enabled: true })))
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 15 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const enabledCount = services.filter((s) => s.enabled).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {enabledCount}/{services.length} enabled
        </span>
        {canToggle && (
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={enableAll}
              disabled={batchMutation.isPending}
            >
              Enable All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={disableAll}
              disabled={batchMutation.isPending}
            >
              Disable All
            </Button>
          </div>
        )}
      </div>

      {/* Category groups */}
      {CATEGORIES.map(({ key, label }) => {
        const catServices = byCategory[key]
        if (!catServices?.length) return null
        const allEnabled = catServices.every((s) => s.enabled)
        return (
          <div key={key}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {catServices.filter((s) => s.enabled).length}/{catServices.length}
              </span>
              {canToggle && !allEnabled && (
                <button
                  className="text-xs text-primary hover:underline ml-auto"
                  onClick={() => enableCategory(key)}
                  disabled={batchMutation.isPending}
                >
                  Enable all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {catServices.map((svc) => (
                <ServiceCard
                  key={svc.name}
                  service={svc}
                  instanceId={instanceId}
                  canToggle={canToggle}
                />
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && search && (
        <p className="text-sm text-muted-foreground text-center py-12">
          No services matching &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  )
}
