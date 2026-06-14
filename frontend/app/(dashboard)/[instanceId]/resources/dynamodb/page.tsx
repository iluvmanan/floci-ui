"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { Database, Plus, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

export default function DynamoDBPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [scanItems, setScanItems] = useState<object[] | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTable, setNewTable] = useState("")
  const [hashKey, setHashKey] = useState("id")
  const [putItemOpen, setPutItemOpen] = useState(false)
  const [itemJson, setItemJson] = useState("")
  const [jsonError, setJsonError] = useState("")

  const { data: tableData, isLoading, refetch } = useQuery({
    queryKey: ["dynamo-tables", instanceId],
    queryFn: () => instancesApi.listTables(instanceId).then((r) => r.data as { tables: string[] }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.createTable(instanceId, { table_name: newTable, hash_key: hashKey }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dynamo-tables", instanceId] })
      setCreateOpen(false)
      setNewTable("")
      setHashKey("id")
      toast.success(`Table "${newTable}" created`)
    },
    onError: () => toast.error("Failed to create table"),
  })

  const deleteMutation = useMutation({
    mutationFn: (table: string) => instancesApi.deleteTable(instanceId, table),
    onSuccess: (_, table) => {
      qc.invalidateQueries({ queryKey: ["dynamo-tables", instanceId] })
      if (selectedTable === table) { setSelectedTable(null); setScanItems(null) }
      toast.success(`Table "${table}" deleted`)
    },
    onError: () => toast.error("Failed to delete table"),
  })

  const putItemMutation = useMutation({
    mutationFn: () => instancesApi.putItem(instanceId, selectedTable!, JSON.parse(itemJson)),
    onSuccess: () => {
      setPutItemOpen(false)
      setItemJson("")
      toast.success("Item saved")
    },
    onError: () => toast.error("Failed to save item"),
  })

  async function handleScan() {
    if (!selectedTable) return
    setScanning(true)
    try {
      const r = await instancesApi.scanTable(instanceId, selectedTable)
      const data = r.data as { items: object[]; count: number }
      setScanItems(data.items)
      setScanCount(data.count)
    } catch {
      toast.error("Scan failed")
    } finally {
      setScanning(false)
    }
  }

  function validateAndSetItem(v: string) {
    setItemJson(v)
    try { JSON.parse(v); setJsonError("") } catch { setJsonError("Invalid JSON") }
  }

  const tables = tableData?.tables ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">DynamoDB Tables</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Table
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Table list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tables ({tables.length})
          </div>
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : tables.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No tables found</div>
          ) : (
            <ul>
              {tables.map((t) => (
                <li
                  key={t}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b last:border-b-0 hover:bg-accent/50 transition-colors ${
                    selectedTable === t ? "bg-accent" : ""
                  }`}
                  onClick={() => { setSelectedTable(t); setScanItems(null) }}
                >
                  <span className="flex items-center gap-2 text-sm font-mono">
                    <Database className="h-4 w-4 shrink-0 text-blue-500" />
                    {t}
                  </span>
                  {canMutate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(t) }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Item explorer */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden">
          {!selectedTable ? (
            <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
              Select a table to browse items
            </div>
          ) : (
            <>
              <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {selectedTable}
                </span>
                <div className="flex gap-2">
                  {canMutate && (
                    <Button size="sm" variant="outline" onClick={() => setPutItemOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Put Item
                    </Button>
                  )}
                  <Button size="sm" onClick={handleScan} disabled={scanning}>
                    <Search className="h-3.5 w-3.5 mr-1" />
                    Scan
                  </Button>
                </div>
              </div>

              {scanItems === null ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  Click Scan to load items
                </div>
              ) : scanItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No items found
                </div>
              ) : (
                <>
                  <div className="px-3 py-1 border-b">
                    <Badge variant="secondary" className="text-xs">{scanCount} items</Badge>
                  </div>
                  <div className="overflow-auto max-h-96">
                    <pre className="p-3 text-xs font-mono leading-relaxed">
                      {JSON.stringify(scanItems, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create table dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create DynamoDB Table</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Table Name</label>
              <Input value={newTable} onChange={(e) => setNewTable(e.target.value)} placeholder="my-table" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Hash Key</label>
              <Input value={hashKey} onChange={(e) => setHashKey(e.target.value)} placeholder="id" className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTable || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Put item dialog */}
      <Dialog open={putItemOpen} onOpenChange={setPutItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Put Item</DialogTitle></DialogHeader>
          <Textarea
            className="font-mono text-xs h-48"
            placeholder={'{\n  "id": {"S": "my-id"},\n  "name": {"S": "Alice"}\n}'}
            value={itemJson}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => validateAndSetItem(e.target.value)}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPutItemOpen(false)}>Cancel</Button>
            <Button
              onClick={() => putItemMutation.mutate()}
              disabled={!itemJson || !!jsonError || putItemMutation.isPending}
            >
              Save Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
