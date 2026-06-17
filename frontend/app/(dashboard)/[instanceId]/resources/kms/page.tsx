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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Copy, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface KMSKey {
  key_id: string
  arn: string
  description: string
  key_usage: string
  key_state: string
  creation_date: string
  enabled: boolean
}

interface KMSAlias {
  alias_name: string
  alias_arn: string
  target_key_id: string
  creation_date: string
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function stateBadge(state: string) {
  const variant = state === "Enabled"
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : state === "PendingDeletion"
    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    : "bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variant}`}>
      {state}
    </span>
  )
}

function truncateArn(arn: string) {
  if (arn.length <= 40) return arn
  return "..." + arn.slice(-37)
}

// ─── Key Detail Dialog ────────────────────────────────────────────────────────

function KeyDetailDialog({
  instanceId,
  keyItem,
  onClose,
}: {
  instanceId: string
  keyItem: KMSKey
  onClose: () => void
}) {
  const [plaintext, setPlaintext] = useState("")
  const [ciphertext, setCiphertext] = useState("")
  const [decryptInput, setDecryptInput] = useState("")
  const [decryptedOutput, setDecryptedOutput] = useState("")

  const encryptMutation = useMutation({
    mutationFn: () => {
      const b64 = btoa(plaintext)
      return instancesApi.kmsEncrypt(instanceId, keyItem.key_id, b64).then((r) => r.data as { ciphertext_base64: string })
    },
    onSuccess: (data) => setCiphertext(data.ciphertext_base64),
    onError: () => toast.error("Encryption failed"),
  })

  const decryptMutation = useMutation({
    mutationFn: () => instancesApi.kmsDecrypt(instanceId, keyItem.key_id, decryptInput).then((r) => r.data as { plaintext_base64: string }),
    onSuccess: (data) => {
      try {
        setDecryptedOutput(atob(data.plaintext_base64))
      } catch {
        setDecryptedOutput(data.plaintext_base64)
      }
    },
    onError: () => toast.error("Decryption failed"),
  })

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm break-all">{keyItem.key_id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">ARN</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs bg-muted rounded px-2 py-1 flex-1 break-all">{keyItem.arn}</p>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(keyItem.arn)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Test Encrypt</p>
            <Textarea value={plaintext} onChange={(e) => setPlaintext(e.target.value)} rows={2} placeholder="Plaintext to encrypt" />
            <Button size="sm" className="mt-2" onClick={() => encryptMutation.mutate()} disabled={!plaintext || encryptMutation.isPending}>
              Encrypt
            </Button>
            {ciphertext && (
              <div className="flex items-center gap-2 mt-2">
                <p className="font-mono text-xs bg-muted rounded px-2 py-1 flex-1 break-all">{ciphertext}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(ciphertext)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Test Decrypt</p>
            <Textarea value={decryptInput} onChange={(e) => setDecryptInput(e.target.value)} rows={2} placeholder="Base64 ciphertext" />
            <Button size="sm" className="mt-2" onClick={() => decryptMutation.mutate()} disabled={!decryptInput || decryptMutation.isPending}>
              Decrypt
            </Button>
            {decryptedOutput && (
              <div className="flex items-center gap-2 mt-2">
                <p className="font-mono text-xs bg-muted rounded px-2 py-1 flex-1 break-all">{decryptedOutput}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(decryptedOutput)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KMSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedKey, setSelectedKey] = useState<KMSKey | null>(null)

  // Create key dialog
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [keyUsage, setKeyUsage] = useState<"ENCRYPT_DECRYPT" | "SIGN_VERIFY">("ENCRYPT_DECRYPT")
  const [keySpec, setKeySpec] = useState("SYMMETRIC_DEFAULT")
  const [keyDescription, setKeyDescription] = useState("")

  // Schedule deletion dialog
  const [scheduleDeleteKey, setScheduleDeleteKey] = useState<KMSKey | null>(null)
  const [pendingDays, setPendingDays] = useState("30")

  // Create alias dialog
  const [createAliasOpen, setCreateAliasOpen] = useState(false)
  const [aliasName, setAliasName] = useState("")
  const [targetKeyId, setTargetKeyId] = useState("")

  // Delete alias confirm
  const [deleteAlias, setDeleteAlias] = useState<KMSAlias | null>(null)

  const { data: keys = [], isLoading: keysLoading, refetch: refetchKeys } = useQuery({
    queryKey: ["kms-keys", instanceId],
    queryFn: () => instancesApi.listKMSKeys(instanceId).then((r) => r.data as KMSKey[]),
  })

  const { data: aliases = [], isLoading: aliasesLoading, refetch: refetchAliases } = useQuery({
    queryKey: ["kms-aliases", instanceId],
    queryFn: () => instancesApi.listKMSAliases(instanceId).then((r) => r.data as KMSAlias[]),
  })

  const createKeyMutation = useMutation({
    mutationFn: () =>
      instancesApi.createKMSKey(instanceId, {
        description: keyDescription || undefined,
        key_usage: keyUsage,
        key_spec: keySpec,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-keys", instanceId] })
      setCreateKeyOpen(false)
      setKeyUsage("ENCRYPT_DECRYPT"); setKeySpec("SYMMETRIC_DEFAULT"); setKeyDescription("")
      toast.success("Key created")
    },
    onError: () => toast.error("Failed to create key"),
  })

  const enableMutation = useMutation({
    mutationFn: (keyId: string) => instancesApi.enableKMSKey(instanceId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-keys", instanceId] })
      toast.success("Key enabled")
    },
    onError: () => toast.error("Failed to enable key"),
  })

  const disableMutation = useMutation({
    mutationFn: (keyId: string) => instancesApi.disableKMSKey(instanceId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-keys", instanceId] })
      toast.success("Key disabled")
    },
    onError: () => toast.error("Failed to disable key"),
  })

  const scheduleDeletionMutation = useMutation({
    mutationFn: () => instancesApi.scheduleKeyDeletion(instanceId, scheduleDeleteKey!.key_id, Number(pendingDays)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-keys", instanceId] })
      setScheduleDeleteKey(null)
      toast.success("Key deletion scheduled")
    },
    onError: () => toast.error("Failed to schedule deletion"),
  })

  const cancelDeletionMutation = useMutation({
    mutationFn: (keyId: string) => instancesApi.cancelKeyDeletion(instanceId, keyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-keys", instanceId] })
      toast.success("Key deletion cancelled")
    },
    onError: () => toast.error("Failed to cancel deletion"),
  })

  const createAliasMutation = useMutation({
    mutationFn: () => instancesApi.createKMSAlias(instanceId, { alias_name: aliasName, target_key_id: targetKeyId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-aliases", instanceId] })
      setCreateAliasOpen(false)
      setAliasName(""); setTargetKeyId("")
      toast.success("Alias created")
    },
    onError: () => toast.error("Failed to create alias"),
  })

  const deleteAliasMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteKMSAlias(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kms-aliases", instanceId] })
      setDeleteAlias(null)
      toast.success("Alias deleted")
    },
    onError: () => toast.error("Failed to delete alias"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">KMS</h2>
        <Button variant="ghost" size="sm" onClick={() => { refetchKeys(); refetchAliases() }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="keys">
        <TabsList>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="aliases">Aliases</TabsTrigger>
        </TabsList>

        {/* ── Keys Tab ── */}
        <TabsContent value="keys" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Keys ({keys.length})</span>
            {canMutate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setKeyUsage("ENCRYPT_DECRYPT"); setKeySpec("SYMMETRIC_DEFAULT"); setKeyDescription(""); setCreateKeyOpen(true) }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Key
              </Button>
            )}
          </div>
          {keysLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>State</TableHead>
                    {canMutate && <TableHead className="w-48">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 5 : 4} className="text-center text-muted-foreground text-sm h-24">No keys found</TableCell>
                    </TableRow>
                  ) : keys.map((k) => (
                    <TableRow key={k.key_id} className="cursor-pointer" onClick={() => setSelectedKey(k)}>
                      <TableCell className="font-mono text-xs">{truncateArn(k.key_id)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{k.description || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{k.key_usage}</TableCell>
                      <TableCell>{stateBadge(k.key_state)}</TableCell>
                      {canMutate && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {k.key_state === "Enabled" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => disableMutation.mutate(k.key_id)}>Disable</Button>
                            )}
                            {k.key_state === "Disabled" && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => enableMutation.mutate(k.key_id)}>Enable</Button>
                            )}
                            {k.key_state === "PendingDeletion" ? (
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => cancelDeletionMutation.mutate(k.key_id)}>Cancel Deletion</Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => { setPendingDays("30"); setScheduleDeleteKey(k) }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Aliases Tab ── */}
        <TabsContent value="aliases" className="pt-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Aliases ({aliases.length})</span>
            {canMutate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setAliasName(""); setTargetKeyId(keys[0]?.key_id ?? ""); setCreateAliasOpen(true) }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Alias
              </Button>
            )}
          </div>
          {aliasesLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alias Name</TableHead>
                    <TableHead>Target Key ID</TableHead>
                    {canMutate && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aliases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canMutate ? 3 : 2} className="text-center text-muted-foreground text-sm h-24">No aliases found</TableCell>
                    </TableRow>
                  ) : aliases.map((a) => (
                    <TableRow key={a.alias_name}>
                      <TableCell className="font-mono text-sm">{a.alias_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{a.target_key_id}</TableCell>
                      {canMutate && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteAlias(a)}>
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
        </TabsContent>
      </Tabs>

      {/* Create Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create KMS Key</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Key Usage</label>
              <div className="flex gap-3 mt-1">
                {(["ENCRYPT_DECRYPT", "SIGN_VERIFY"] as const).map((u) => (
                  <label key={u} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="key-usage" checked={keyUsage === u} onChange={() => setKeyUsage(u)} />
                    {u}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Key Spec</label>
              <Select value={keySpec} onValueChange={(v) => v && setKeySpec(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SYMMETRIC_DEFAULT">SYMMETRIC_DEFAULT</SelectItem>
                  <SelectItem value="RSA_2048">RSA_2048</SelectItem>
                  <SelectItem value="RSA_4096">RSA_4096</SelectItem>
                  <SelectItem value="ECC_NIST_P256">ECC_NIST_P256</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={keyDescription} onChange={(e) => setKeyDescription(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
            <Button onClick={() => createKeyMutation.mutate()} disabled={createKeyMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Deletion Dialog */}
      <Dialog open={!!scheduleDeleteKey} onOpenChange={() => setScheduleDeleteKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Key Deletion</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Schedule deletion of <span className="font-mono font-medium text-foreground">{scheduleDeleteKey?.key_id}</span>. The key can be recovered by cancelling deletion before the waiting period ends.
          </p>
          <div>
            <label className="text-sm font-medium">Waiting Period (days, 7-30)</label>
            <Input type="number" min={7} max={30} value={pendingDays} onChange={(e) => setPendingDays(e.target.value)} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDeleteKey(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => scheduleDeletionMutation.mutate()} disabled={scheduleDeletionMutation.isPending}>
              Schedule Deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Alias Dialog */}
      <Dialog open={createAliasOpen} onOpenChange={setCreateAliasOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Alias</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Alias Name</label>
              <Input value={aliasName} onChange={(e) => setAliasName(e.target.value)} className="mt-1" placeholder="alias/my-key" />
            </div>
            <div>
              <label className="text-sm font-medium">Target Key</label>
              <Select value={targetKeyId} onValueChange={(v) => v && setTargetKeyId(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select a key" />
                </SelectTrigger>
                <SelectContent>
                  {keys.map((k) => (
                    <SelectItem key={k.key_id} value={k.key_id}>{k.key_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAliasOpen(false)}>Cancel</Button>
            <Button onClick={() => createAliasMutation.mutate()} disabled={!aliasName || !targetKeyId || createAliasMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alias Confirm */}
      <Dialog open={!!deleteAlias} onOpenChange={() => setDeleteAlias(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Alias</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-mono font-medium text-foreground">{deleteAlias?.alias_name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAlias(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteAlias && deleteAliasMutation.mutate(deleteAlias.alias_name)} disabled={deleteAliasMutation.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedKey && (
        <KeyDetailDialog instanceId={instanceId} keyItem={selectedKey} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}
