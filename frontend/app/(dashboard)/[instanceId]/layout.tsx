"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { StatusBadge } from "@/components/instances/StatusBadge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

const tabs = [
  { label: "Config", href: "config" },
  { label: "Services", href: "services" },
  { label: "Resources", href: "resources/s3" },
  { label: "Logs", href: "logs" },
  { label: "Metrics", href: "metrics" },
]

export default function InstanceLayout({ children }: { children: React.ReactNode }) {
  const { instanceId } = useParams<{ instanceId: string }>()
  const pathname = usePathname()

  const { data: instance, isLoading } = useQuery({
    queryKey: ["instance", instanceId],
    queryFn: () => instancesApi.get(instanceId).then((r) => r.data),
  })

  const activeTab = tabs.find((t) => pathname.includes(`/${t.href.split("/")[0]}`))?.href.split("/")[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <>
            <h1 className="text-xl font-semibold">{instance?.name}</h1>
            {instance && <StatusBadge status={instance.status} />}
            <span className="text-xs text-muted-foreground font-mono">{instance?.endpoint}</span>
          </>
        )}
      </div>

      <Tabs value={activeTab ?? "config"}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.href} value={tab.href.split("/")[0]} asChild>
              <Link href={`/${instanceId}/${tab.href}`}>{tab.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {children}
    </div>
  )
}
