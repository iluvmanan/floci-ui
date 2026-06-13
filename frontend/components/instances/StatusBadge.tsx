import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status = "unknown" | "healthy" | "degraded" | "unreachable"

const styles: Record<Status, string> = {
  healthy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  degraded: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  unreachable: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  unknown: "bg-muted text-muted-foreground",
}

const dots: Record<Status, string> = {
  healthy: "bg-green-500 animate-pulse",
  degraded: "bg-yellow-500 animate-pulse",
  unreachable: "bg-red-500",
  unknown: "bg-muted-foreground",
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", styles[status])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[status])} />
      <span className="capitalize">{status}</span>
    </span>
  )
}
