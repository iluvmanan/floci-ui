"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"

const LABELS: Record<string, string> = {
  instances: "Instances",
  config: "Configuration",
  services: "Services",
  resources: "Resources",
  logs: "Logs",
  metrics: "Metrics",
  settings: "Settings",
  users: "Users",
  audit: "Audit Log",
  "api-keys": "API Keys",
  system: "System",
  s3: "S3",
  dynamodb: "DynamoDB",
  lambda: "Lambda",
  sqs: "SQS",
  sns: "SNS",
  kinesis: "Kinesis",
  eventbridge: "EventBridge",
  cognito: "Cognito",
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export function BreadcrumbNav() {
  const pathname = usePathname()
  const parts = pathname.split("/").filter(Boolean)

  // Build crumb list, collapsing UUIDs to "Instance"
  const crumbs: { label: string; href: string }[] = [{ label: "Home", href: "/" }]
  let href = ""

  for (const part of parts) {
    href += `/${part}`
    if (isUuid(part)) {
      crumbs.push({ label: "Instance", href })
    } else {
      crumbs.push({ label: LABELS[part] ?? part, href })
    }
  }

  if (crumbs.length <= 1) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          {i === crumbs.length - 1 ? (
            <span className="text-foreground font-medium" aria-current="page">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}
