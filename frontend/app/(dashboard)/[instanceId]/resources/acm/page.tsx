"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Certificate {
  certificate_arn: string
  domain_name: string
  status: string
  type: string
  in_use_by: string[]
  not_after: string
  subject_alternative_names: string[]
  created_at: string
  issued_at: string
}

interface DomainValidationOption {
  DomainName: string
  ValidationStatus?: string
  ResourceRecord?: { Name: string; Type: string; Value: string }
}

interface CertificateDetail extends Certificate {
  domain_validation_options: DomainValidationOption[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    ISSUED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    PENDING_VALIDATION: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    REVOKED: "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  )
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ACMPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Certificate | null>(null)

  const [domainName, setDomainName] = useState("")
  const [validationMethod, setValidationMethod] = useState<"DNS" | "EMAIL">("DNS")
  const [sans, setSans] = useState("")

  const { data: certs = [], isLoading, refetch } = useQuery({
    queryKey: ["acm-certs", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listCertificates(instanceId)
      return r.data as Certificate[]
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        domain_name: domainName,
        validation_method: validationMethod,
      }
      const sanList = sans.split(",").map((s) => s.trim()).filter(Boolean)
      if (sanList.length > 0) body.subject_alternative_names = sanList
      return instancesApi.requestCertificate(instanceId, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acm-certs", instanceId] })
      setCreateOpen(false)
      setDomainName(""); setValidationMethod("DNS"); setSans("")
      toast.success("Certificate requested")
    },
    onError: () => toast.error("Failed to request certificate"),
  })

  const deleteMutation = useMutation({
    mutationFn: (arn: string) => instancesApi.deleteCertificate(instanceId, arn),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acm-certs", instanceId] })
      setDeleteTarget(null)
      if (selected === deleteTarget?.certificate_arn) setSelected(null)
      toast.success("Certificate deleted")
    },
    onError: () => toast.error("Failed to delete certificate"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">ACM Certificates</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Request Certificate
            </Button>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>SANs</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>In Use By</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {certs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 7 : 6} className="text-center text-muted-foreground h-24">No certificates found</TableCell>
                </TableRow>
              ) : certs.map((c) => {
                const days = daysUntil(c.not_after)
                return (
                  <TableRow key={c.certificate_arn} className="cursor-pointer hover:bg-accent/40" onClick={() => setSelected(c.certificate_arn)}>
                    <TableCell className="font-mono text-sm">{c.domain_name}</TableCell>
                    <TableCell className="text-xs">{c.subject_alternative_names?.length ?? 0}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell className="text-xs">{c.type}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <span>{c.not_after ? new Date(c.not_after).toLocaleDateString() : "—"}</span>
                        {days !== null && days < 30 && (
                          <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            {days < 0 ? "Expired" : `${days}d`}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{c.in_use_by?.length ?? 0}</TableCell>
                    {canMutate && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {selected && (
        <CertificateDetailPanel instanceId={instanceId} certArn={selected} onClose={() => setSelected(null)} />
      )}

      {/* Request Certificate Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Request Certificate</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Primary Domain</Label>
              <Input value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="example.com" />
            </div>
            <div className="space-y-1">
              <Label>Validation Method</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="validation-method" checked={validationMethod === "DNS"} onChange={() => setValidationMethod("DNS")} />
                  DNS
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="validation-method" checked={validationMethod === "EMAIL"} onChange={() => setValidationMethod("EMAIL")} />
                  Email
                </label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Additional SANs (comma-separated, optional)</Label>
              <Input value={sans} onChange={(e) => setSans(e.target.value)} placeholder="www.example.com, api.example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!domainName || createMutation.isPending}>Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Certificate</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete certificate <span className="font-mono font-medium">{deleteTarget?.domain_name}</span>?
            {deleteTarget?.in_use_by && deleteTarget.in_use_by.length > 0 && (
              <span className="block mt-2 text-destructive">
                Warning: this certificate is currently in use by {deleteTarget.in_use_by.length} resource(s). AWS will reject the deletion until it is no longer in use.
              </span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.certificate_arn)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function CertificateDetailPanel({ instanceId, certArn, onClose }: { instanceId: string; certArn: string; onClose: () => void }) {
  const [resendOpen, setResendOpen] = useState(false)
  const [resendDomain, setResendDomain] = useState("")
  const [resendValidationDomain, setResendValidationDomain] = useState("")

  const { data: cert, isLoading } = useQuery({
    queryKey: ["acm-cert-detail", instanceId, certArn],
    queryFn: async () => {
      const r = await instancesApi.describeCertificate(instanceId, certArn)
      return r.data as CertificateDetail
    },
  })

  const resendMutation = useMutation({
    mutationFn: () =>
      instancesApi.resendValidationEmail(instanceId, certArn, {
        domain: resendDomain,
        validation_domain: resendValidationDomain,
      }),
    onSuccess: () => {
      setResendOpen(false)
      toast.success("Validation email resent")
    },
    onError: () => toast.error("Failed to resend validation email"),
  })

  if (isLoading || !cert) {
    return (
      <div className="border rounded-lg p-4">
        <Skeleton className="h-32" />
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium font-mono">{cert.domain_name}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <span className="text-muted-foreground">Status</span>
        <span>{statusBadge(cert.status)}</span>
        <span className="text-muted-foreground">Type</span>
        <span>{cert.type}</span>
        <span className="text-muted-foreground">Expiry</span>
        <span>{cert.not_after ? new Date(cert.not_after).toLocaleString() : "—"}</span>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Subject Alternative Names</p>
        {cert.subject_alternative_names?.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          <ul className="space-y-1">
            {cert.subject_alternative_names?.map((san) => (
              <li key={san} className="text-xs font-mono bg-muted/40 rounded px-2 py-1">{san}</li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">In Use By</p>
        {cert.in_use_by?.length === 0 ? (
          <p className="text-xs text-muted-foreground">Not in use</p>
        ) : (
          <ul className="space-y-1">
            {cert.in_use_by?.map((arn) => (
              <li key={arn} className="text-xs font-mono bg-muted/40 rounded px-2 py-1 truncate">{arn}</li>
            ))}
          </ul>
        )}
      </div>

      {cert.domain_validation_options?.some((o) => o.ResourceRecord) && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">DNS Validation Records</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Domain</TableHead>
                <TableHead className="text-xs">CNAME Name</TableHead>
                <TableHead className="text-xs">CNAME Value</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cert.domain_validation_options.filter((o) => o.ResourceRecord).map((o) => (
                <TableRow key={o.DomainName}>
                  <TableCell className="text-xs font-mono">{o.DomainName}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[200px]">{o.ResourceRecord?.Name}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[200px]">{o.ResourceRecord?.Value}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(o.ResourceRecord?.Name ?? "")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(o.ResourceRecord?.Value ?? "")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {cert.status === "PENDING_VALIDATION" && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setResendDomain(cert.domain_name)
            setResendValidationDomain(cert.domain_name)
            setResendOpen(true)
          }}
        >
          Resend Validation Email
        </Button>
      )}

      <Dialog open={resendOpen} onOpenChange={setResendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resend Validation Email</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Domain</Label>
              <Input value={resendDomain} onChange={(e) => setResendDomain(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Validation Domain</Label>
              <Input value={resendValidationDomain} onChange={(e) => setResendValidationDomain(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendOpen(false)}>Cancel</Button>
            <Button onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}>Resend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
