"use client"

import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  // Compute
  Server,
  SquareFunction,
  Container,
  Layers,
  TrendingUp,
  // Storage
  HardDrive,
  Box,
  Archive,
  // Database
  Database,
  Cpu,
  GitBranch,
  // Messaging
  MessageSquare,
  Radio,
  Zap,
  Mail,
  Flame,
  // Networking
  Globe,
  Globe2,
  SplitSquareHorizontal,
  Map,
  // Security
  Shield,
  Key,
  BadgeCheck,
  Lock,
  User,
  // Developer
  Layers2,
  GitMerge,
  Webhook,
  Settings2,
  Hammer,
  Rocket,
  // Analytics
  Search,
  Combine,
  SearchCode,
  DollarSign,
  PieChart,
  // AI / ML
  Brain,
  FileSearch,
  Mic,
  // Other
  Settings,
  UserCheck,
  MailOpen,
  ArrowRightLeft,
  Network,
  ClipboardCheck,
  Tag,
  // UI
  ChevronRight,
} from "lucide-react"
import type { ComponentType } from "react"

interface ServiceEntry {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

interface ServiceGroup {
  label: string
  services: ServiceEntry[]
}

const serviceGroups: ServiceGroup[] = [
  {
    label: "Compute",
    services: [
      { label: "EC2", href: "ec2", icon: Server },
      { label: "Lambda", href: "lambda", icon: SquareFunction },
      { label: "ECS", href: "ecs", icon: Container },
      { label: "EKS", href: "eks", icon: Layers },
      { label: "Auto Scaling", href: "autoscaling", icon: TrendingUp },
    ],
  },
  {
    label: "Storage",
    services: [
      { label: "S3", href: "s3", icon: HardDrive },
      { label: "ECR", href: "ecr", icon: Box },
      { label: "Backup", href: "backup", icon: Archive },
    ],
  },
  {
    label: "Database",
    services: [
      { label: "DynamoDB", href: "dynamodb", icon: Database },
      { label: "RDS", href: "rds", icon: Database },
      { label: "ElastiCache", href: "elasticache", icon: Cpu },
      { label: "Neptune", href: "neptune", icon: GitBranch },
    ],
  },
  {
    label: "Messaging",
    services: [
      { label: "SQS", href: "sqs", icon: MessageSquare },
      { label: "SNS", href: "sns", icon: Radio },
      { label: "Kinesis", href: "kinesis", icon: Zap },
      { label: "MSK", href: "msk", icon: Layers },
      { label: "EventBridge", href: "eventbridge", icon: Mail },
      { label: "Data Firehose", href: "firehose", icon: Flame },
    ],
  },
  {
    label: "Networking",
    services: [
      { label: "API Gateway", href: "apigw", icon: Globe },
      { label: "API Gateway v2", href: "apigwv2", icon: Zap },
      { label: "CloudFront", href: "cloudfront", icon: Globe2 },
      { label: "Load Balancers", href: "elbv2", icon: SplitSquareHorizontal },
      { label: "Route 53", href: "route53", icon: Map },
    ],
  },
  {
    label: "Security",
    services: [
      { label: "IAM", href: "iam", icon: Shield },
      { label: "KMS", href: "kms", icon: Key },
      { label: "ACM", href: "acm", icon: BadgeCheck },
      { label: "Secrets Manager", href: "secrets", icon: Lock },
      { label: "Cognito", href: "cognito", icon: User },
    ],
  },
  {
    label: "Developer",
    services: [
      { label: "CloudFormation", href: "cfn", icon: Layers2 },
      { label: "Step Functions", href: "stepfunctions", icon: GitMerge },
      { label: "AppSync", href: "appsync", icon: Webhook },
      { label: "AppConfig", href: "appconfig", icon: Settings2 },
      { label: "CodeBuild", href: "codebuild", icon: Hammer },
      { label: "CodeDeploy", href: "codedeploy", icon: Rocket },
    ],
  },
  {
    label: "Analytics",
    services: [
      { label: "Athena", href: "athena", icon: Search },
      { label: "Glue", href: "glue", icon: Combine },
      { label: "OpenSearch", href: "opensearch", icon: SearchCode },
      { label: "Cost Explorer", href: "costexplorer", icon: DollarSign },
      { label: "Pricing", href: "pricing", icon: PieChart },
    ],
  },
  {
    label: "AI / ML",
    services: [
      { label: "Bedrock", href: "bedrock", icon: Brain },
      { label: "Textract", href: "textract", icon: FileSearch },
      { label: "Transcribe", href: "transcribe", icon: Mic },
    ],
  },
  {
    label: "Other",
    services: [
      { label: "SSM", href: "ssm", icon: Settings },
      { label: "STS", href: "sts", icon: UserCheck },
      { label: "SES", href: "ses", icon: MailOpen },
      { label: "Transfer Family", href: "transfer", icon: ArrowRightLeft },
      { label: "Cloud Map", href: "cloudmap", icon: Network },
      { label: "AWS Config", href: "awsconfig", icon: ClipboardCheck },
      { label: "Resource Groups", href: "tagging", icon: Tag },
    ],
  },
]

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  const { instanceId } = useParams<{ instanceId: string }>()
  const pathname = usePathname()
  const [filter, setFilter] = useState("")
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const query = filter.trim().toLowerCase()

  const toggleGroup = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="flex gap-6">
      <nav className="w-52 shrink-0">
        <div className="mb-3">
          <Input
            placeholder="Filter services..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-3">
          {serviceGroups.map((group) => {
            const visibleServices = query
              ? group.services.filter((s) =>
                  s.label.toLowerCase().includes(query)
                )
              : group.services

            if (visibleServices.length === 0) return null

            const isCollapsed = query.trim() ? false : (collapsed[group.label] ?? false)

            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between px-1 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{group.label}</span>
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 shrink-0 transition-transform duration-150",
                      !isCollapsed && "rotate-90"
                    )}
                  />
                </button>
                {!isCollapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {visibleServices.map(({ label, href, icon: Icon }) => {
                      const active = pathname.includes(`/resources/${href}/`) || pathname.endsWith(`/resources/${href}`)
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
                )}
              </div>
            )
          })}
        </div>
      </nav>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
