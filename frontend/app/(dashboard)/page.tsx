"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus, Server } from "lucide-react"
import { instancesApi } from "@/lib/api/instances"
import { InstanceCard } from "@/components/instances/InstanceCard"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InstanceFormDialog } from "@/components/instances/InstanceFormDialog"

export default function DashboardPage() {
  const [addOpen, setAddOpen] = useState(false)

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["instances"],
    queryFn: () => instancesApi.list().then((r) => r.data),
    refetchInterval: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instances</h1>
          <p className="text-muted-foreground text-sm">
            {instances.length} Floci instance{instances.length !== 1 ? "s" : ""} registered
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Instance
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium mb-1">No instances yet</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Add a Floci instance to start managing your local AWS emulation.
          </p>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add your first instance
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((instance) => (
            <InstanceCard key={instance.id} instance={instance} />
          ))}
        </div>
      )}

      <InstanceFormDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
