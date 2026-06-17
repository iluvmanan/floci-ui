"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ChevronRight, Download, FolderOpen, Plus, RefreshCw, Settings2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

interface Bucket {
  name: string
  creation_date: string
}

interface S3Object {
  key: string
  size: number
  last_modified: string
}

interface TagRow {
  Key: string
  Value: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function S3Page() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [selectedBucket, setSelectedBucket] = useState<string | null>(null)
  const [prefix, setPrefix] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [newBucket, setNewBucket] = useState("")

  // Settings dialog state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedSettingsBucket, setSelectedSettingsBucket] = useState<string | null>(null)

  // Policy editor state
  const [policyText, setPolicyText] = useState("")
  // CORS editor state
  const [corsText, setCorsText] = useState("")
  // Tags editor state
  const [tagRows, setTagRows] = useState<TagRow[]>([])

  // File upload ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Queries ─────────────────────────────────────────────────────────────────

  const { data: buckets = [], isLoading: bucketsLoading, refetch: refetchBuckets } = useQuery({
    queryKey: ["s3-buckets", instanceId],
    queryFn: () => instancesApi.listBuckets(instanceId).then((r) => r.data as Bucket[]),
  })

  const { data: objectsData, isLoading: objectsLoading } = useQuery({
    queryKey: ["s3-objects", instanceId, selectedBucket, prefix],
    queryFn: () =>
      instancesApi.listObjects(instanceId, selectedBucket!, prefix).then((r) => r.data as { objects: S3Object[]; truncated: boolean }),
    enabled: !!selectedBucket,
  })

  const { data: versioningData } = useQuery({
    queryKey: ["s3-versioning", instanceId, selectedSettingsBucket],
    queryFn: () =>
      instancesApi.getBucketVersioning(instanceId, selectedSettingsBucket!).then((r) => r.data as { status: string }),
    enabled: settingsOpen && !!selectedSettingsBucket,
  })

  const { data: policyData } = useQuery({
    queryKey: ["s3-policy", instanceId, selectedSettingsBucket],
    queryFn: () =>
      instancesApi.getBucketPolicy(instanceId, selectedSettingsBucket!).then((r) => r.data as { policy: string | null }),
    enabled: settingsOpen && !!selectedSettingsBucket,
  })

  const { data: corsData } = useQuery({
    queryKey: ["s3-cors", instanceId, selectedSettingsBucket],
    queryFn: () =>
      instancesApi.getBucketCors(instanceId, selectedSettingsBucket!).then((r) => r.data as { rules: unknown[] }),
    enabled: settingsOpen && !!selectedSettingsBucket,
  })

  const { data: tagsData } = useQuery({
    queryKey: ["s3-tags", instanceId, selectedSettingsBucket],
    queryFn: () =>
      instancesApi.getBucketTags(instanceId, selectedSettingsBucket!).then((r) => r.data as { tags: TagRow[] }),
    enabled: settingsOpen && !!selectedSettingsBucket,
  })

  // Sync fetched data into local editor state
  useEffect(() => {
    if (policyData !== undefined) {
      const p = (policyData as { policy: string | null }).policy
      try {
        setPolicyText(p ? JSON.stringify(JSON.parse(p), null, 2) : "")
      } catch {
        setPolicyText(p ?? "")
      }
    }
  }, [policyData])

  useEffect(() => {
    if (corsData !== undefined) {
      const rules = (corsData as { rules: unknown[] }).rules
      setCorsText(JSON.stringify(rules, null, 2))
    }
  }, [corsData])

  useEffect(() => {
    if (tagsData !== undefined) {
      setTagRows((tagsData as { tags: TagRow[] }).tags)
    }
  }, [tagsData])

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createBucket(instanceId, newBucket),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-buckets", instanceId] })
      setCreateOpen(false)
      setNewBucket("")
      toast.success(`Bucket "${newBucket}" created`)
    },
    onError: () => toast.error("Failed to create bucket"),
  })

  const deleteBucketMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteBucket(instanceId, name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ["s3-buckets", instanceId] })
      if (selectedBucket === name) setSelectedBucket(null)
      toast.success(`Bucket "${name}" deleted`)
    },
    onError: () => toast.error("Failed to delete bucket"),
  })

  const deleteObjectMutation = useMutation({
    mutationFn: (key: string) => instancesApi.deleteObject(instanceId, selectedBucket!, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-objects", instanceId, selectedBucket, prefix] })
      toast.success("Object deleted")
    },
    onError: () => toast.error("Failed to delete object"),
  })

  const setVersioningMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      instancesApi.setBucketVersioning(instanceId, selectedSettingsBucket!, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-versioning", instanceId, selectedSettingsBucket] })
      toast.success("Versioning updated")
    },
    onError: () => toast.error("Failed to update versioning"),
  })

  const setPolicyMutation = useMutation({
    mutationFn: () => instancesApi.setBucketPolicy(instanceId, selectedSettingsBucket!, policyText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-policy", instanceId, selectedSettingsBucket] })
      toast.success("Bucket policy saved")
    },
    onError: () => toast.error("Failed to save policy"),
  })

  const deletePolicyMutation = useMutation({
    mutationFn: () => instancesApi.deleteBucketPolicy(instanceId, selectedSettingsBucket!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-policy", instanceId, selectedSettingsBucket] })
      setPolicyText("")
      toast.success("Bucket policy deleted")
    },
    onError: () => toast.error("Failed to delete policy"),
  })

  const setCorsMutation = useMutation({
    mutationFn: () => {
      let rules: unknown[]
      try {
        rules = JSON.parse(corsText)
      } catch {
        throw new Error("Invalid JSON")
      }
      return instancesApi.setBucketCors(instanceId, selectedSettingsBucket!, rules)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-cors", instanceId, selectedSettingsBucket] })
      toast.success("CORS configuration saved")
    },
    onError: (e: Error) => toast.error(e.message === "Invalid JSON" ? "Invalid JSON in CORS rules" : "Failed to save CORS"),
  })

  const setTagsMutation = useMutation({
    mutationFn: () => instancesApi.setBucketTags(instanceId, selectedSettingsBucket!, tagRows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["s3-tags", instanceId, selectedSettingsBucket] })
      toast.success("Tags saved")
    },
    onError: () => toast.error("Failed to save tags"),
  })

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  function openSettings(bucketName: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSelectedSettingsBucket(bucketName)
    setPolicyText("")
    setCorsText("")
    setTagRows([])
    setSettingsOpen(true)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selectedBucket) return
    try {
      const resp = await instancesApi.uploadUrl(instanceId, selectedBucket, file.name)
      const { url, fields } = resp.data as { url: string; fields: Record<string, string> }
      const formData = new FormData()
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v))
      formData.append("file", file)
      const uploadResp = await fetch(url, { method: "POST", body: formData })
      if (!uploadResp.ok) throw new Error("Upload failed")
      toast.success(`"${file.name}" uploaded`)
      qc.invalidateQueries({ queryKey: ["s3-objects", instanceId, selectedBucket, prefix] })
    } catch {
      toast.error("Failed to upload file")
    } finally {
      // Reset so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDownload(key: string) {
    try {
      const resp = await instancesApi.downloadObject(instanceId, selectedBucket!, key)
      const { url } = resp.data as { url: string }
      window.open(url, "_blank")
    } catch {
      toast.error("Failed to get download URL")
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  const versioningStatus = versioningData?.status ?? "Off"
  const versioningEnabled = versioningStatus === "Enabled"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">S3 Buckets</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetchBuckets()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Bucket
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bucket list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Buckets ({buckets.length})
          </div>
          {bucketsLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : buckets.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No buckets found</div>
          ) : (
            <ul>
              {buckets.map((b) => (
                <li
                  key={b.name}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedBucket === b.name ? "bg-accent" : ""
                  }`}
                  onClick={() => { setSelectedBucket(b.name); setPrefix("") }}
                >
                  <span className="flex items-center gap-2 text-sm font-mono truncate">
                    <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
                    {b.name}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {selectedBucket === b.name && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {canMutate && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => openSettings(b.name, e)}
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); deleteBucketMutation.mutate(b.name) }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Object browser */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedBucket ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a bucket to browse objects
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                  {selectedBucket}
                  {prefix && ` / ${prefix}`}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    placeholder="Filter by prefix…"
                    className="h-6 text-xs w-40"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  />
                  {canMutate && (
                    <>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs px-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Upload
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {objectsLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Key</TableHead>
                        <TableHead className="w-24">Size</TableHead>
                        <TableHead className="w-32">Last Modified</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(objectsData?.objects ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground text-sm h-32">
                            No objects in this bucket
                          </TableCell>
                        </TableRow>
                      ) : (
                        objectsData!.objects.map((obj) => (
                          <TableRow key={obj.key}>
                            <TableCell className="font-mono text-xs">{obj.key}</TableCell>
                            <TableCell className="text-xs">{formatSize(obj.size)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(obj.last_modified).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleDownload(obj.key)}
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                                {canMutate && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => deleteObjectMutation.mutate(obj.key)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {objectsData?.truncated && (
                <div className="px-3 py-2 border-t">
                  <Badge variant="outline" className="text-xs">Results truncated</Badge>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create Bucket Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create S3 Bucket</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Bucket name"
            value={newBucket}
            onChange={(e) => setNewBucket(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createMutation.mutate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newBucket || createMutation.isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bucket Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bucket Settings — {selectedSettingsBucket}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="versioning">
            <TabsList className="w-full">
              <TabsTrigger value="versioning" className="flex-1">Versioning</TabsTrigger>
              <TabsTrigger value="policy" className="flex-1">Policy</TabsTrigger>
              <TabsTrigger value="cors" className="flex-1">CORS</TabsTrigger>
              <TabsTrigger value="tags" className="flex-1">Tags</TabsTrigger>
            </TabsList>

            {/* Versioning Tab */}
            <TabsContent value="versioning" className="space-y-4 pt-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Versioning</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Keep multiple versions of objects in this bucket
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={versioningEnabled ? "default" : "secondary"}>
                    {versioningStatus}
                  </Badge>
                  {canMutate && (
                    <Switch
                      checked={versioningEnabled}
                      onCheckedChange={(checked) => setVersioningMutation.mutate(checked)}
                      disabled={setVersioningMutation.isPending}
                    />
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Policy Tab */}
            <TabsContent value="policy" className="space-y-3 pt-4">
              <Textarea
                className="font-mono text-xs min-h-48"
                placeholder='{"Version": "2012-10-17", "Statement": []}'
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                readOnly={!canMutate}
              />
              {canMutate && (
                <div className="flex gap-2 justify-end">
                  {(policyData as { policy: string | null } | undefined)?.policy && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deletePolicyMutation.mutate()}
                      disabled={deletePolicyMutation.isPending}
                    >
                      Delete Policy
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setPolicyMutation.mutate()}
                    disabled={!policyText || setPolicyMutation.isPending}
                  >
                    Save Policy
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* CORS Tab */}
            <TabsContent value="cors" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Enter a JSON array of CORS rule objects.
              </p>
              <Textarea
                className="font-mono text-xs min-h-48"
                placeholder='[{"AllowedOrigins": ["*"], "AllowedMethods": ["GET"]}]'
                value={corsText}
                onChange={(e) => setCorsText(e.target.value)}
                readOnly={!canMutate}
              />
              {canMutate && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => setCorsMutation.mutate()}
                    disabled={!corsText || setCorsMutation.isPending}
                  >
                    Save CORS
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Tags Tab */}
            <TabsContent value="tags" className="space-y-3 pt-4">
              <div className="space-y-2">
                {tagRows.map((tag, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      className="h-7 text-xs"
                      value={tag.Key}
                      onChange={(e) => {
                        const updated = [...tagRows]
                        updated[i] = { ...updated[i], Key: e.target.value }
                        setTagRows(updated)
                      }}
                      readOnly={!canMutate}
                    />
                    <Input
                      placeholder="Value"
                      className="h-7 text-xs"
                      value={tag.Value}
                      onChange={(e) => {
                        const updated = [...tagRows]
                        updated[i] = { ...updated[i], Value: e.target.value }
                        setTagRows(updated)
                      }}
                      readOnly={!canMutate}
                    />
                    {canMutate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setTagRows(tagRows.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {tagRows.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No tags</p>
                )}
              </div>
              {canMutate && (
                <div className="flex gap-2 justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTagRows([...tagRows, { Key: "", Value: "" }])}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Tag
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setTagsMutation.mutate()}
                    disabled={setTagsMutation.isPending}
                  >
                    Save Tags
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
