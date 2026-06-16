"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
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
import { Copy, Plus, RefreshCw, Terminal, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Repository {
  repository_name: string
  repository_uri: string
  registry_id: string
  created_at: string
  image_tag_mutability: string
  image_scanning_configuration: { scanOnPush?: boolean }
}

interface ECRImage {
  image_digest: string
  image_tags: string[]
  image_size_in_bytes: number
  image_pushed_at: string
  image_scan_status: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function truncateMid(s: string, len = 28) {
  if (s.length <= len) return s
  return `${s.slice(0, len / 2)}…${s.slice(-len / 2)}`
}

function formatMB(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(2) + " MB"
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ECRPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedRepo, setSelectedRepo] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [loginCmdOpen, setLoginCmdOpen] = useState(false)

  const { data: repos = [], isLoading, refetch } = useQuery({
    queryKey: ["ecr-repos", instanceId],
    queryFn: async () => {
      const r = await instancesApi.listECRRepos(instanceId)
      return r.data as Repository[]
    },
  })

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => instancesApi.createECRRepo(instanceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecr-repos", instanceId] })
      setCreateOpen(false)
      toast.success("Repository created")
    },
    onError: () => toast.error("Failed to create repository"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteECRRepo(instanceId, name),
    onSuccess: (_d, name) => {
      qc.invalidateQueries({ queryKey: ["ecr-repos", instanceId] })
      setDeleteTarget(null)
      if (selectedRepo === name) setSelectedRepo(null)
      toast.success("Repository deleted")
    },
    onError: () => toast.error("Failed to delete repository"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">ECR</h2>
        <Button variant="outline" size="sm" onClick={() => setLoginCmdOpen(true)}>
          <Terminal className="h-4 w-4 mr-1" />
          Docker Login Command
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Repo list */}
        <div className="w-80 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {repos.length} repositor{repos.length !== 1 ? "ies" : "y"}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              {canMutate && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : repos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No repositories found</div>
            ) : (
              <ul className="divide-y">
                {repos.map((r) => (
                  <li
                    key={r.repository_name}
                    className={`p-3 cursor-pointer hover:bg-accent/40 ${
                      selectedRepo === r.repository_name ? "bg-accent/60" : ""
                    }`}
                    onClick={() => setSelectedRepo(r.repository_name)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{r.repository_name}</span>
                      {canMutate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(r.repository_name)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-mono text-muted-foreground truncate">
                        {truncateMid(r.repository_uri, 30)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(r.repository_uri)
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {r.image_tag_mutability}
                      </Badge>
                      {r.image_scanning_configuration?.scanOnPush && (
                        <Badge variant="outline" className="text-xs">
                          Scan on push
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Image browser */}
        <div className="flex-1 min-w-0">
          {!selectedRepo ? (
            <div className="border rounded-lg h-64 flex items-center justify-center text-sm text-muted-foreground">
              Select a repository to view images
            </div>
          ) : (
            <ImagesPanel
              instanceId={instanceId}
              repoName={selectedRepo}
              canMutate={canMutate}
              onOpenPolicy={() => setPolicyOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Create Repository Dialog */}
      <CreateRepoDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Repository</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete repository <span className="font-mono font-medium">{deleteTarget}</span> and all its
            images? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repository Policy Dialog */}
      {selectedRepo && (
        <RepoPolicyDialog
          open={policyOpen}
          onClose={() => setPolicyOpen(false)}
          instanceId={instanceId}
          repoName={selectedRepo}
          canMutate={canMutate}
        />
      )}

      {/* Docker Login Command Dialog */}
      <DockerLoginDialog open={loginCmdOpen} onClose={() => setLoginCmdOpen(false)} instanceId={instanceId} />
    </div>
  )
}

// ─── Create Repository Dialog ──────────────────────────────────────────────────

function CreateRepoDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (body: Record<string, unknown>) => void
  isPending: boolean
}) {
  const [name, setName] = useState("")
  const [mutability, setMutability] = useState("MUTABLE")
  const [scanOnPush, setScanOnPush] = useState(false)

  function reset() {
    setName("")
    setMutability("MUTABLE")
    setScanOnPush(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          reset()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Repository Name</Label>
            <Input placeholder="my-app" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Image Tag Mutability</Label>
            <Select value={mutability} onValueChange={(v) => v && setMutability(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MUTABLE">MUTABLE</SelectItem>
                <SelectItem value="IMMUTABLE">IMMUTABLE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Scan on Push</Label>
            <Switch checked={scanOnPush} onCheckedChange={setScanOnPush} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() =>
              onSubmit({
                repository_name: name,
                image_tag_mutability: mutability,
                scan_on_push: scanOnPush,
              })
            }
            disabled={!name || isPending}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Images Panel ──────────────────────────────────────────────────────────────

function ImagesPanel({
  instanceId,
  repoName,
  canMutate,
  onOpenPolicy,
}: {
  instanceId: string
  repoName: string
  canMutate: boolean
  onOpenPolicy: () => void
}) {
  const qc = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { data: images = [], isLoading, refetch } = useQuery({
    queryKey: ["ecr-images", instanceId, repoName],
    queryFn: async () => {
      const r = await instancesApi.listECRImages(instanceId, repoName)
      return r.data as ECRImage[]
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (digest: string) => instancesApi.deleteECRImages(instanceId, repoName, [{ imageDigest: digest }]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecr-images", instanceId, repoName] })
      setDeleteTarget(null)
      toast.success("Image deleted")
    },
    onError: () => toast.error("Failed to delete image"),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium font-mono">{repoName}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onOpenPolicy}>
            Repository Policy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tags</TableHead>
                <TableHead>Digest</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Pushed At</TableHead>
                <TableHead>Scan Status</TableHead>
                {canMutate && <TableHead className="w-16" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canMutate ? 6 : 5} className="text-center text-muted-foreground h-24">
                    No images found
                  </TableCell>
                </TableRow>
              ) : (
                images.map((img) => (
                  <TableRow key={img.image_digest}>
                    <TableCell className="text-xs">{(img.image_tags ?? []).join(", ") || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1">
                        <span>{truncateMid(img.image_digest, 22)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => copyToClipboard(img.image_digest)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{formatMB(img.image_size_in_bytes)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {img.image_pushed_at && img.image_pushed_at !== "" ? img.image_pushed_at : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {String(img.image_scan_status?.status ?? "—")}
                      </Badge>
                    </TableCell>
                    {canMutate && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setDeleteTarget(img.image_digest)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Image Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete image <span className="font-mono font-medium">{deleteTarget && truncateMid(deleteTarget, 40)}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Repository Policy Dialog ───────────────────────────────────────────────────

function RepoPolicyDialog({
  open,
  onClose,
  instanceId,
  repoName,
  canMutate,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
  repoName: string
  canMutate: boolean
}) {
  const qc = useQueryClient()
  const [policyText, setPolicyText] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["ecr-policy", instanceId, repoName],
    queryFn: async () => {
      const r = await instancesApi.getECRPolicy(instanceId, repoName)
      return r.data as { policy_text: string | null }
    },
    enabled: open,
  })

  const saveMutation = useMutation({
    mutationFn: () => instancesApi.setECRPolicy(instanceId, repoName, policyText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecr-policy", instanceId, repoName] })
      toast.success("Policy saved")
    },
    onError: () => toast.error("Failed to save policy"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => instancesApi.deleteECRPolicy(instanceId, repoName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ecr-policy", instanceId, repoName] })
      setPolicyText("")
      toast.success("Policy deleted")
    },
    onError: () => toast.error("Failed to delete policy"),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
        else if (data?.policy_text) setPolicyText(data.policy_text)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Repository Policy — {repoName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-48" />
        ) : (
          <Textarea
            className="font-mono text-xs min-h-48"
            placeholder='{"Version": "2012-10-17", "Statement": []}'
            value={policyText || data?.policy_text || ""}
            onChange={(e) => setPolicyText(e.target.value)}
            readOnly={!canMutate}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {canMutate && (
            <>
              {data?.policy_text && (
                <Button
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate()}
                >
                  Delete Policy
                </Button>
              )}
              <Button
                disabled={!policyText || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                Save
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Docker Login Command Dialog ───────────────────────────────────────────────

function DockerLoginDialog({
  open,
  onClose,
  instanceId,
}: {
  open: boolean
  onClose: () => void
  instanceId: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["ecr-auth-token", instanceId],
    queryFn: async () => {
      const r = await instancesApi.getECRAuthToken(instanceId)
      return r.data as { docker_login_command: string; proxy_endpoint: string; expires_at: string }
    },
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Docker Login Command</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-16" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted rounded p-2 font-mono break-all">
                {data?.docker_login_command}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => data && copyToClipboard(data.docker_login_command)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Token expires at {data?.expires_at || "—"}.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
