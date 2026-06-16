"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, Copy, Send } from "lucide-react"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface Identity {
  identity: string
  verification_status: string
  verification_token?: string | null
}

interface Template {
  name: string
  subject_part: string
  html_part: string
  text_part: string
}

interface SendStat {
  timestamp: string
  delivery_attempts: number
  bounces: number
  complaints: number
  rejects: number
}

interface Quota {
  max_24_hour_send: number
  max_send_rate: number
  sent_last_24_hours: number
}

function verificationBadge(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Success") return "default"
  if (status === "Pending") return "secondary"
  if (status === "Failed") return "destructive"
  return "outline"
}

function isDomain(identity: string) {
  return !identity.includes("@")
}

// ─── Identities Tab ────────────────────────────────────────────────────────────

function IdentitiesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [emailOpen, setEmailOpen] = useState(false)
  const [domainOpen, setDomainOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [domain, setDomain] = useState("")
  const [domainToken, setDomainToken] = useState<string | null>(null)

  const { data: identities = [], isLoading } = useQuery({
    queryKey: ["ses-identities", instanceId],
    queryFn: () => instancesApi.listSESIdentities(instanceId).then((r) => r.data as Identity[]),
  })

  const verifyEmailMutation = useMutation({
    mutationFn: () => instancesApi.verifySESEmail(instanceId, email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ses-identities", instanceId] })
      setEmailOpen(false)
      setEmail("")
      toast.success("Verification email sent")
    },
    onError: () => toast.error("Failed to send verification email"),
  })

  const verifyDomainMutation = useMutation({
    mutationFn: () => instancesApi.verifySESDomain(instanceId, domain),
    onSuccess: (r) => {
      const data = r.data as { verification_token: string }
      setDomainToken(data.verification_token)
      qc.invalidateQueries({ queryKey: ["ses-identities", instanceId] })
      toast.success("Domain verification initiated")
    },
    onError: () => toast.error("Failed to verify domain"),
  })

  const deleteMutation = useMutation({
    mutationFn: (identity: string) => instancesApi.deleteSESIdentity(instanceId, identity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ses-identities", instanceId] })
      toast.success("Identity deleted")
    },
    onError: () => toast.error("Failed to delete identity"),
  })

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success("TXT record value copied")
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Identities ({identities.length})</span>
        {canMutate && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Verify Email
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setDomainOpen(true); setDomainToken(null) }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Verify Domain
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Verification Status</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {identities.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 4 : 3} className="text-center text-muted-foreground text-sm h-24">No identities found</TableCell></TableRow>
              ) : identities.map((i) => (
                <TableRow key={i.identity}>
                  <TableCell className="font-mono text-sm">{i.identity}</TableCell>
                  <TableCell><Badge variant="outline">{isDomain(i.identity) ? "Domain" : "Email"}</Badge></TableCell>
                  <TableCell><Badge variant={verificationBadge(i.verification_status)}>{i.verification_status}</Badge></TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(i.identity)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify Email Identity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Email Address</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" placeholder="user@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>Cancel</Button>
            <Button onClick={() => verifyEmailMutation.mutate()} disabled={!email || verifyEmailMutation.isPending}>Send Verification</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={domainOpen} onOpenChange={setDomainOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify Domain Identity</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Domain</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1" placeholder="example.com" />
            </div>
            {domainToken && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Add this TXT record to your DNS</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted rounded px-2 py-1.5 break-all">{domainToken}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToken(domainToken)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainOpen(false)}>Close</Button>
            {!domainToken && (
              <Button onClick={() => verifyDomainMutation.mutate()} disabled={!domain || verifyDomainMutation.isPending}>Verify</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Templates Tab ─────────────────────────────────────────────────────────────

function TemplatesTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlBody, setHtmlBody] = useState("")
  const [textBody, setTextBody] = useState("")

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["ses-templates", instanceId],
    queryFn: () => instancesApi.listSESTemplates(instanceId).then((r) => r.data as Template[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createSESTemplate(instanceId, {
        name,
        subject_part: subject,
        html_part: htmlBody || undefined,
        text_part: textBody || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ses-templates", instanceId] })
      setCreateOpen(false)
      setName(""); setSubject(""); setHtmlBody(""); setTextBody("")
      toast.success("Template created")
    },
    onError: () => toast.error("Failed to create template"),
  })

  const deleteMutation = useMutation({
    mutationFn: (n: string) => instancesApi.deleteSESTemplate(instanceId, n),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ses-templates", instanceId] })
      toast.success("Template deleted")
    },
    onError: () => toast.error("Failed to delete template"),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Templates ({templates.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create Template
          </Button>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow><TableCell colSpan={canMutate ? 3 : 2} className="text-center text-muted-foreground text-sm h-24">No templates found</TableCell></TableRow>
              ) : templates.map((t) => (
                <TableRow key={t.name} className="cursor-pointer" onClick={() => setPreviewTemplate(t)}>
                  <TableCell className="font-mono text-sm">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">{t.subject_part}</TableCell>
                  {canMutate && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(t.name)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>HTML Body</Label>
              <Textarea value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} className="mt-1 font-mono text-xs" rows={5} />
            </div>
            <div>
              <Label>Text Body</Label>
              <Textarea value={textBody} onChange={(e) => setTextBody(e.target.value)} className="mt-1 font-mono text-xs" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || !subject || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{previewTemplate?.name}</DialogTitle></DialogHeader>
          {previewTemplate && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Subject: {previewTemplate.subject_part}</p>
              {previewTemplate.html_part ? (
                <iframe
                  srcDoc={previewTemplate.html_part}
                  className="w-full h-72 border rounded"
                  sandbox=""
                />
              ) : (
                <pre className="text-xs whitespace-pre-wrap bg-muted rounded p-3">{previewTemplate.text_part}</pre>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Send Email Tab ────────────────────────────────────────────────────────────

function SendEmailTab({ instanceId, canMutate }: { instanceId: string; canMutate: boolean }) {
  const [source, setSource] = useState("")
  const [destinations, setDestinations] = useState("")
  const [subject, setSubject] = useState("")
  const [bodyMode, setBodyMode] = useState<"text" | "html">("text")
  const [body, setBody] = useState("")
  const [useTemplate, setUseTemplate] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [templateData, setTemplateData] = useState("{}")
  const [lastMessageId, setLastMessageId] = useState<string | null>(null)

  const { data: identities = [] } = useQuery({
    queryKey: ["ses-identities", instanceId],
    queryFn: () => instancesApi.listSESIdentities(instanceId).then((r) => r.data as Identity[]),
  })

  const { data: templates = [] } = useQuery({
    queryKey: ["ses-templates", instanceId],
    queryFn: () => instancesApi.listSESTemplates(instanceId).then((r) => r.data as Template[]),
    enabled: useTemplate,
  })

  const verifiedIdentities = identities.filter((i) => i.verification_status === "Success")

  const sendMutation = useMutation({
    mutationFn: () => {
      const destList = destinations.split(",").map((d) => d.trim()).filter(Boolean)
      if (useTemplate) {
        return instancesApi.sendSESTemplatedEmail(instanceId, {
          source,
          destinations: destList,
          template: templateName,
          template_data: templateData,
        })
      }
      return instancesApi.sendSESEmail(instanceId, {
        source,
        destinations: destList,
        subject,
        body_text: bodyMode === "text" ? body : undefined,
        body_html: bodyMode === "html" ? body : undefined,
      })
    },
    onSuccess: (r) => {
      const data = r.data as { message_id: string }
      setLastMessageId(data.message_id)
      toast.success("Email sent")
    },
    onError: () => toast.error("Failed to send email"),
  })

  if (!canMutate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to send email.</p>
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2">
        <Button variant={!useTemplate ? "default" : "outline"} size="sm" onClick={() => setUseTemplate(false)}>Plain Email</Button>
        <Button variant={useTemplate ? "default" : "outline"} size="sm" onClick={() => setUseTemplate(true)}>Use Template</Button>
      </div>

      <div>
        <Label>From (verified identity)</Label>
        <Select value={source} onValueChange={(v) => v && setSource(v)}>
          <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select source identity" /></SelectTrigger>
          <SelectContent>
            {verifiedIdentities.map((i) => (
              <SelectItem key={i.identity} value={i.identity}>{i.identity}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>To (comma-separated)</Label>
        <Input value={destinations} onChange={(e) => setDestinations(e.target.value)} className="mt-1" placeholder="a@example.com, b@example.com" />
      </div>

      {useTemplate ? (
        <>
          <div>
            <Label>Template</Label>
            <Select value={templateName} onValueChange={(v) => v && setTemplateName(v)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Template Data (JSON)</Label>
            <Textarea value={templateData} onChange={(e) => setTemplateData(e.target.value)} className="mt-1 font-mono text-xs" rows={4} />
          </div>
        </>
      ) : (
        <>
          <div>
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <div className="flex gap-1">
                <Button variant={bodyMode === "text" ? "default" : "outline"} size="sm" className="h-6 text-xs px-2" onClick={() => setBodyMode("text")}>Text</Button>
                <Button variant={bodyMode === "html" ? "default" : "outline"} size="sm" className="h-6 text-xs px-2" onClick={() => setBodyMode("html")}>HTML</Button>
              </div>
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="mt-1 font-mono text-xs" rows={6} />
          </div>
        </>
      )}

      {lastMessageId && (
        <p className="text-xs text-muted-foreground">Message ID: <span className="font-mono">{lastMessageId}</span></p>
      )}

      <Button
        onClick={() => sendMutation.mutate()}
        disabled={!source || !destinations || (useTemplate ? !templateName : !subject || !body) || sendMutation.isPending}
      >
        <Send className="h-3.5 w-3.5 mr-1.5" /> Send
      </Button>
    </div>
  )
}

// ─── Statistics Tab ─────────────────────────────────────────────────────────────

function StatisticsTab({ instanceId }: { instanceId: string }) {
  const { data: stats = [], isLoading: statsLoading } = useQuery({
    queryKey: ["ses-statistics", instanceId],
    queryFn: () => instancesApi.getSESStatistics(instanceId).then((r) => r.data as SendStat[]),
  })

  const { data: quota, isLoading: quotaLoading } = useQuery({
    queryKey: ["ses-quota", instanceId],
    queryFn: () => instancesApi.getSESQuota(instanceId).then((r) => r.data as Quota),
  })

  const chartData = stats.slice(-14).map((s) => ({
    time: s.timestamp ? new Date(s.timestamp).toLocaleDateString() : "",
    Deliveries: s.delivery_attempts,
    Bounces: s.bounces,
    Complaints: s.complaints,
  }))

  return (
    <div className="space-y-4">
      {quotaLoading ? (
        <Skeleton className="h-16" />
      ) : quota ? (
        <div className="border rounded-lg p-4 flex gap-8 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Sent (last 24h)</p>
            <p className="text-lg font-medium">{quota.sent_last_24_hours} / {quota.max_24_hour_send}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Max Send Rate</p>
            <p className="text-lg font-medium">{quota.max_send_rate}/s</p>
          </div>
        </div>
      ) : null}

      {statsLoading ? (
        <Skeleton className="h-64" />
      ) : chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">No statistics available</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Deliveries" fill="#6366f1" />
            <Bar dataKey="Bounces" fill="#ef4444" />
            <Bar dataKey="Complaints" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SESPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Simple Email Service (SES)</h2>
      </div>
      <Tabs defaultValue="identities">
        <TabsList>
          <TabsTrigger value="identities">Identities</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Send Email</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="identities" className="pt-3">
          <IdentitiesTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="templates" className="pt-3">
          <TemplatesTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="send" className="pt-3">
          <SendEmailTab instanceId={instanceId} canMutate={canMutate} />
        </TabsContent>
        <TabsContent value="statistics" className="pt-3">
          <StatisticsTab instanceId={instanceId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
