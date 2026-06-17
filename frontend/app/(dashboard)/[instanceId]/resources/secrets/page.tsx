"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Copy, Eye, EyeOff, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Secret {
  arn: string
  name: string
  description: string
  last_rotated_date: string | null
  rotation_enabled: boolean
  created_date: string
  last_changed_date: string
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

// ─── Detail Dialog ────────────────────────────────────────────────────────────

function SecretDetailDialog({
  instanceId,
  secret,
  canMutate,
  onClose,
}: {
  instanceId: string
  secret: Secret
  canMutate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [revealed, setRevealed] = useState(false)
  const [value, setValue] = useState<string | null>(null)
  const [updateOpen, setUpdateOpen] = useState(false)
  const [newValue, setNewValue] = useState("")
  const [rotateOpen, setRotateOpen] = useState(false)
  const [lambdaArn, setLambdaArn] = useState("")
  const [rotateDays, setRotateDays] = useState("30")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const revealMutation = useMutation({
    mutationFn: () => instancesApi.getSecretValue(instanceId, secret.name).then((r) => r.data as { secret_string: string }),
    onSuccess: (data) => {
      setValue(data.secret_string)
      setRevealed(true)
    },
    onError: () => toast.error("Failed to fetch secret value"),
  })

  const updateMutation = useMutation({
    mutationFn: () => instancesApi.updateSecret(instanceId, secret.name, { secret_string: newValue }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secrets", instanceId] })
      setUpdateOpen(false)
      setValue(newValue)
      setNewValue("")
      toast.success("Secret value updated")
    },
    onError: () => toast.error("Failed to update secret"),
  })

  const rotateMutation = useMutation({
    mutationFn: () =>
      instancesApi.rotateSecret(instanceId, secret.name, {
        rotation_lambda_arn: lambdaArn || undefined,
        automatically_after_days: rotateDays ? Number(rotateDays) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secrets", instanceId] })
      setRotateOpen(false)
      toast.success("Rotation configured")
    },
    onError: () => toast.error("Failed to enable rotation"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => instancesApi.deleteSecret(instanceId, secret.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secrets", instanceId] })
      onClose()
      toast.success("Secret deleted")
    },
    onError: () => toast.error("Failed to delete secret"),
  })

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{secret.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">ARN</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-xs bg-muted rounded px-2 py-1 flex-1 break-all">{secret.arn}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(secret.arn)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Secret Value</p>
              {revealed ? (
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm bg-muted rounded px-2 py-1 flex-1 break-all">{value}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(value ?? "")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRevealed(false)}>
                    <EyeOff className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revealMutation.mutate()}
                  disabled={revealMutation.isPending}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Reveal Value
                </Button>
              )}
            </div>

            {canMutate && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setNewValue(value ?? ""); setUpdateOpen(true) }}>
                  Update Value
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setLambdaArn(""); setRotateDays("30"); setRotateOpen(true) }}>
                  Enable Rotation
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update value dialog */}
      <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Secret Value</DialogTitle></DialogHeader>
          <Textarea value={newValue} onChange={(e) => setNewValue(e.target.value)} rows={5} className="font-mono text-sm" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateOpen(false)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotation dialog */}
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enable Rotation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Rotation Lambda ARN</label>
              <Input value={lambdaArn} onChange={(e) => setLambdaArn(e.target.value)} className="mt-1" placeholder="arn:aws:lambda:..." />
            </div>
            <div>
              <label className="text-sm font-medium">Rotate Every (days)</label>
              <Input type="number" min={1} value={rotateDays} onChange={(e) => setRotateDays(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateOpen(false)}>Cancel</Button>
            <Button onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Secret</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently and immediately delete <span className="font-mono font-medium text-foreground">{secret.name}</span> without a recovery window. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecretsPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [secretValue, setSecretValue] = useState("")
  const [description, setDescription] = useState("")
  const [kmsKeyId, setKmsKeyId] = useState("")
  const [selected, setSelected] = useState<Secret | null>(null)

  const { data: secrets = [], isLoading, refetch } = useQuery({
    queryKey: ["secrets", instanceId],
    queryFn: () => instancesApi.listSecrets(instanceId).then((r) => r.data as Secret[]),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createSecret(instanceId, {
        name,
        secret_string: secretValue || undefined,
        description: description || undefined,
        kms_key_id: kmsKeyId || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["secrets", instanceId] })
      setCreateOpen(false)
      setName(""); setSecretValue(""); setDescription(""); setKmsKeyId("")
      toast.success("Secret created")
    },
    onError: () => toast.error("Failed to create secret"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Secrets Manager</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">Secrets ({secrets.length})</span>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => { setName(""); setSecretValue(""); setDescription(""); setKmsKeyId(""); setCreateOpen(true) }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Create Secret
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
                <TableHead>Description</TableHead>
                <TableHead>Last Rotated</TableHead>
                <TableHead>Rotation</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {secrets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-sm h-24">No secrets found</TableCell>
                </TableRow>
              ) : secrets.map((s) => (
                <TableRow key={s.arn} className="cursor-pointer" onClick={() => setSelected(s)}>
                  <TableCell className="font-mono text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{s.description || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.last_rotated_date ? new Date(s.last_rotated_date).toLocaleDateString() : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.rotation_enabled ? "default" : "secondary"}>
                      {s.rotation_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.created_date && s.created_date !== "None" ? new Date(s.created_date).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Secret Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Secret</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Secret Value</label>
              <Textarea value={secretValue} onChange={(e) => setSecretValue(e.target.value)} className="mt-1 font-mono text-sm" rows={4} />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">KMS Key ID (optional)</label>
              <Input value={kmsKeyId} onChange={(e) => setKmsKeyId(e.target.value)} className="mt-1" placeholder="arn:aws:kms:... or alias/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <SecretDetailDialog
          instanceId={instanceId}
          secret={selected}
          canMutate={canMutate}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
