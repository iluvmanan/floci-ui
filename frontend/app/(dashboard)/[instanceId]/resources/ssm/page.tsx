"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, Folder, Lock, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Parameter {
  name: string
  type: string
  last_modified_date: string
  description: string
  version: number
  tier: string
}

interface TreeNode {
  name: string
  fullPath: string
  children: Map<string, TreeNode>
  isLeaf: boolean
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function buildTree(params: Parameter[]): TreeNode {
  const root: TreeNode = { name: "/", fullPath: "/", children: new Map(), isLeaf: false }
  for (const p of params) {
    const segments = p.name.split("/").filter(Boolean)
    let node = root
    let path = ""
    for (const seg of segments) {
      path += "/" + seg
      if (!node.children.has(seg)) {
        node.children.set(seg, { name: seg, fullPath: path, children: new Map(), isLeaf: false })
      }
      node = node.children.get(seg)!
    }
  }
  return root
}

function TreeView({
  node,
  depth,
  selectedPath,
  onSelect,
  expanded,
  onToggle,
}: {
  node: TreeNode
  depth: number
  selectedPath: string
  onSelect: (path: string) => void
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
}) {
  const children = Array.from(node.children.values()).sort((a, b) => a.name.localeCompare(b.name))
  if (children.length === 0) return null
  return (
    <ul className={depth === 0 ? "" : "ml-3 border-l pl-2"}>
      {children.map((child) => {
        const isExpanded = expanded[child.fullPath] ?? false
        const hasChildren = child.children.size > 0
        const isSelected = selectedPath === child.fullPath
        return (
          <li key={child.fullPath}>
            <div
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-sm cursor-pointer ${
                isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50"
              }`}
              onClick={() => onSelect(child.fullPath)}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggle(child.fullPath) }}
                  className="text-muted-foreground"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              ) : (
                <span className="w-3.5" />
              )}
              <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{child.name}</span>
            </div>
            {hasChildren && isExpanded && (
              <TreeView node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} expanded={expanded} onToggle={onToggle} />
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ─── Value Viewer Dialog ──────────────────────────────────────────────────────

function ParameterDialog({
  instanceId,
  param,
  canMutate,
  onClose,
}: {
  instanceId: string
  param: Parameter
  canMutate: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const isSecure = param.type === "SecureString"
  const [revealed, setRevealed] = useState(!isSecure)
  const [value, setValue] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)

  const fetchMutation = useMutation({
    mutationFn: () => instancesApi.getParameterValue(instanceId, param.name).then((r) => r.data as { value: string }),
    onSuccess: (data) => {
      setValue(data.value)
      setRevealed(true)
      setEditValue(data.value)
    },
    onError: () => toast.error("Failed to fetch parameter value"),
  })

  const updateMutation = useMutation({
    mutationFn: () => instancesApi.updateParameter(instanceId, param.name, { value: editValue }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssm-parameters", instanceId] })
      qc.invalidateQueries({ queryKey: ["ssm-by-path", instanceId] })
      setValue(editValue)
      setEditing(false)
      toast.success("Parameter updated")
    },
    onError: () => toast.error("Failed to update parameter"),
  })

  const deleteMutation = useMutation({
    mutationFn: () => instancesApi.deleteParameter(instanceId, param.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssm-parameters", instanceId] })
      qc.invalidateQueries({ queryKey: ["ssm-by-path", instanceId] })
      onClose()
      toast.success("Parameter deleted")
    },
    onError: () => toast.error("Failed to delete parameter"),
  })

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-sm break-all">
              {isSecure && <Lock className="h-4 w-4 shrink-0" />}
              {param.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{param.type}</Badge>
              <span className="text-xs text-muted-foreground">version {param.version}</span>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Value</p>
              {editing ? (
                <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={4} className="font-mono text-sm" />
              ) : revealed ? (
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm bg-muted rounded px-2 py-1 flex-1 break-all">{value}</p>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(value ?? "")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {isSecure && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRevealed(false)}>
                      <EyeOff className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => fetchMutation.mutate()} disabled={fetchMutation.isPending}>
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Reveal Value
                </Button>
              )}
            </div>

            {canMutate && (
              <div className="flex flex-wrap gap-2">
                {editing ? (
                  <>
                    <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (value === null) await fetchMutation.mutateAsync()
                      setEditValue(value ?? "")
                      setEditing(true)
                    }}
                  >
                    Edit
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Parameter</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-mono font-medium text-foreground">{param.name}</span>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SSMPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [selectedPath, setSelectedPath] = useState("/")
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selectedParam, setSelectedParam] = useState<Parameter | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<"String" | "StringList" | "SecureString">("String")
  const [value, setValue] = useState("")
  const [description, setDescription] = useState("")
  const [overwrite, setOverwrite] = useState(false)

  const { data: parameters = [], isLoading, refetch } = useQuery({
    queryKey: ["ssm-parameters", instanceId],
    queryFn: () => instancesApi.listParameters(instanceId).then((r) => r.data as Parameter[]),
  })

  const tree = useMemo(() => buildTree(parameters), [parameters])

  const filteredParams = useMemo(() => {
    if (selectedPath === "/") return parameters
    return parameters.filter((p) => p.name === selectedPath || p.name.startsWith(selectedPath + "/"))
  }, [parameters, selectedPath])

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createParameter(instanceId, {
        name,
        value,
        type,
        description: description || undefined,
        overwrite,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ssm-parameters", instanceId] })
      setCreateOpen(false)
      setName(""); setType("String"); setValue(""); setDescription(""); setOverwrite(false)
      toast.success("Parameter created")
    },
    onError: () => toast.error("Failed to create parameter"),
  })

  function toggle(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">SSM Parameter Store</h2>
        <div className="flex items-center gap-2">
          {canMutate && (
            <Button size="sm" variant="outline" onClick={() => { setName(""); setType("String"); setValue(""); setDescription(""); setOverwrite(false); setCreateOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create Parameter
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="w-56 shrink-0 border rounded-lg p-2">
          <div
            className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-sm cursor-pointer mb-1 ${
              selectedPath === "/" ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50"
            }`}
            onClick={() => setSelectedPath("/")}
          >
            <Folder className="h-3.5 w-3.5 text-muted-foreground" />
            All Parameters
          </div>
          {isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <TreeView node={tree} depth={0} selectedPath={selectedPath} onSelect={setSelectedPath} expanded={expanded} onToggle={toggle} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead>Version</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParams.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-24">No parameters found</TableCell>
                    </TableRow>
                  ) : filteredParams.map((p) => (
                    <TableRow key={p.name} className="cursor-pointer" onClick={() => setSelectedParam(p)}>
                      <TableCell className="font-mono text-sm">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="secondary">{p.type}</Badge>
                          {p.type === "SecureString" && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.last_modified_date && p.last_modified_date !== "None" ? new Date(p.last_modified_date).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.version}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Create Parameter Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Parameter</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 font-mono" placeholder="/app/db/password" />
              <p className="text-xs text-muted-foreground mt-1">Use &quot;/&quot; to create a hierarchy, e.g. /app/db/password</p>
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <div className="flex gap-3 mt-1">
                {(["String", "StringList", "SecureString"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="param-type" checked={type === t} onChange={() => setType(t)} />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Value</label>
              <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="mt-1 font-mono text-sm" rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Overwrite if exists</label>
              <Switch checked={overwrite} onCheckedChange={setOverwrite} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!name || !value || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedParam && (
        <ParameterDialog
          instanceId={instanceId}
          param={selectedParam}
          canMutate={canMutate}
          onClose={() => setSelectedParam(null)}
        />
      )}
    </div>
  )
}
