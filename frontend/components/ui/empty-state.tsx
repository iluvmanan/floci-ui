import { type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-label={title}
      className="flex flex-col items-center justify-center py-24 text-center px-4"
    >
      <div className="rounded-full bg-muted p-4 mb-4" aria-hidden="true">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-base font-semibold mb-1">{title}</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}
