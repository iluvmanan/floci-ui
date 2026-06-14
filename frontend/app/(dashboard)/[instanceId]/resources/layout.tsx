"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Database,
  SquareFunction,
  HardDrive,
  Mail,
  MessageSquare,
  Radio,
  User,
  Zap,
} from "lucide-react"

const services = [
  { label: "S3", href: "s3", icon: HardDrive },
  { label: "DynamoDB", href: "dynamodb", icon: Database },
  { label: "Lambda", href: "lambda", icon: SquareFunction },
  { label: "SQS", href: "sqs", icon: MessageSquare },
  { label: "SNS", href: "sns", icon: Radio },
  { label: "Kinesis", href: "kinesis", icon: Zap },
  { label: "EventBridge", href: "eventbridge", icon: Mail },
  { label: "Cognito", href: "cognito", icon: User },
]

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  const { instanceId } = useParams<{ instanceId: string }>()
  const pathname = usePathname()

  return (
    <div className="flex gap-6">
      <nav className="w-44 shrink-0">
        <ul className="space-y-0.5">
          {services.map(({ label, href, icon: Icon }) => {
            const active = pathname.includes(`/resources/${href}`)
            return (
              <li key={href}>
                <Link
                  href={`/${instanceId}/resources/${href}`}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
