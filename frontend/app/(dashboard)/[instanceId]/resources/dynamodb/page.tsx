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
import { Database, Plus, RefreshCw, Search, Trash2, Settings, Eye } from "lucide-react"
import { toast } from "sonner"

type TabType = "scan" | "query"

interface TableDetail {
  name: string
  status: string
  item_count: number
  size_bytes: number
  billing_mode: string
  key_schema: { AttributeName: string; KeyType: string }[]
  attribute_definitions: { AttributeName: string; AttributeType: string }[]
  gsi: { name: string; key_schema: { AttributeName: string; KeyType: string }[]; projection: Record<string, unknown> }[]
  lsi: { name: string; key_schema: { AttributeName: string; KeyType: string }[] }[]
  stream_arn: string | null
  created_at: string
  read_capacity: number | null
  write_capacity: number | null
}

export default function DynamoDBPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("scan")

  // Scan state
  const [scanItems, setScanItems] = useState<Record<string, unknown>[] | null>(null)
  const [scanCount, setScanCount] = useState(0)
  const [scanning, setScanning] = useState(false)

  // Query state
  const [queryItems, setQueryItems] = useState<Record<string, unknown>[] | null>(null)
  const [queryCount, setQueryCount] = useState(0)
  const [querying, setQuerying] = useState(false)
  const [keyCondition, setKeyCondition] = useState("")
  const [exprValuesJson, setExprValuesJson] = useState("")
  const [exprValuesError, setExprValuesError] = useState("")
  const [indexName, setIndexName] = useState("")

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newTable, setNewTable] = useState("")
  const [hashKey, setHashKey] = useState("id")

  // Put item dialog
  const [putItemOpen, setPutItemOpen] = useState(false)
  const [itemJson, setItemJson] = useState("")
  const [jsonError, setJsonError] = useState("")

  // Get item dialog
  const [getItemOpen, setGetItemOpen] = useState(false)
  const [getItemKeyJson, setGetItemKeyJson] = useState("")
  const [getItemKeyError, setGetItemKeyError] = useState("")
  const [getItemResult, setGetItemResult] = useState<Record<string, unknown> | null | undefined>(undefined)
  const [getItemLoading, setGetItemLoading] = useState(false)

  // Delete item confirmation dialog
  const [deleteItemOpen, setDeleteItemOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Record<string, unknown> | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)

  // Settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTable, setSettingsTable] = useState<string | null>(null)
  const [billingMode, setBillingMode] = useState("PAY_PER_REQUEST")
  const [readCapacity, setReadCapacity] = useState("5")
  const [writeCapacity, setWriteCapacity] = useState("5")
  const [savingSettings, setSavingSettings] = useState(false)

  const { data: tableData, isLoading, refetch } = useQuery({
    queryKey: ["dynamo-tables", instanceId],
    queryFn: () => instancesApi.listTables(instanceId).then((r) => r.data as { tables: string[] }),
  })

  // Table detail (describe)
  const { data: tableDetail, isLoading: detailLoading } = useQuery<TableDetail>({
    queryKey: ["dynamo-describe", instanceId, selectedTable],
    queryFn: () =>
      instancesApi.describeTable(instanceId, selectedTable!).then((r) => r.data as TableDetail),
    enabled: !!selectedTable,
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
      if (selectedTable === table) {
        setSelectedTable(null)
        setScanItems(null)
        setQueryItems(null)
      }
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
      const data = r.data as { items: Record<string, unknown>[]; count: number }
      setScanItems(data.items)
      setScanCount(data.count)
    } catch {
      toast.error("Scan failed")
    } finally {
      setScanning(false)
    }
  }

  async function handleQuery() {
    if (!selectedTable || !keyCondition) return
    let parsedValues: Record<string, unknown> = {}
    if (exprValuesJson) {
      try {
        parsedValues = JSON.parse(exprValuesJson)
      } catch {
        setExprValuesError("Invalid JSON")
        return
      }
    }
    setQuerying(true)
    try {
      const body: { key_condition: string; expression_values: Record<string, unknown>; index_name?: string } = {
        key_condition: keyCondition,
        expression_values: parsedValues,
      }
      if (indexName) body.index_name = indexName
      const r = await instancesApi.queryTable(instanceId, selectedTable, body)
      const data = r.data as { items: Record<string, unknown>[]; count: number }
      setQueryItems(data.items)
      setQueryCount(data.count)
    } catch {
      toast.error("Query failed")
    } finally {
      setQuerying(false)
    }
  }

  async function handleGetItem() {
    if (!selectedTable || !getItemKeyJson) return
    let parsedKey: Record<string, unknown>
    try {
      parsedKey = JSON.parse(getItemKeyJson)
    } catch {
      setGetItemKeyError("Invalid JSON")
      return
    }
    setGetItemLoading(true)
    try {
      const r = await instancesApi.getItem(instanceId, selectedTable, parsedKey)
      const data = r.data as { item: Record<string, unknown> | null }
      setGetItemResult(data.item)
    } catch {
      toast.error("Get item failed")
    } finally {
      setGetItemLoading(false)
    }
  }

  function openDeleteItemDialog(item: Record<string, unknown>) {
    setItemToDelete(item)
    setDeleteItemOpen(true)
  }

  async function handleDeleteItem() {
    if (!selectedTable || !itemToDelete || !tableDetail) return
    // Extract key fields from item using key schema
    const keyFields = tableDetail.key_schema.map((k) => k.AttributeName)
    const key: Record<string, unknown> = {}
    for (const f of keyFields) {
      if (itemToDelete[f] !== undefined) key[f] = itemToDelete[f]
    }
    setDeletingItem(true)
    try {
      await instancesApi.deleteItem(instanceId, selectedTable, key)
      toast.success("Item deleted")
      setDeleteItemOpen(false)
      setItemToDelete(null)
      // Refetch current view
      if (activeTab === "scan") await handleScan()
      else await handleQuery()
    } catch {
      toast.error("Failed to delete item")
    } finally {
      setDeletingItem(false)
    }
  }

  function openSettingsDialog(table: string, e: React.MouseEvent) {
    e.stopPropagation()
    setSettingsTable(table)
    // Pre-fill from detail if available and the table matches
    if (tableDetail && tableDetail.name === table) {
      setBillingMode(tableDetail.billing_mode)
      setReadCapacity(String(tableDetail.read_capacity ?? 5))
      setWriteCapacity(String(tableDetail.write_capacity ?? 5))
    } else {
      setBillingMode("PAY_PER_REQUEST")
      setReadCapacity("5")
      setWriteCapacity("5")
    }
    setSettingsOpen(true)
  }

  async function handleSaveSettings() {
    if (!settingsTable) return
    setSavingSettings(true)
    try {
      const body: { billing_mode: string; read_capacity?: number; write_capacity?: number } = {
        billing_mode: billingMode,
      }
      if (billingMode === "PROVISIONED") {
        body.read_capacity = parseInt(readCapacity, 10)
        body.write_capacity = parseInt(writeCapacity, 10)
      }
      await instancesApi.updateTableSettings(instanceId, settingsTable, body)
      toast.success("Table settings updated")
      setSettingsOpen(false)
      qc.invalidateQueries({ queryKey: ["dynamo-describe", instanceId, settingsTable] })
    } catch {
      toast.error("Failed to update settings")
    } finally {
      setSavingSettings(false)
    }
  }

  function validateAndSetItem(v: string) {
    setItemJson(v)
    try {
      JSON.parse(v)
      setJsonError("")
    } catch {
      setJsonError("Invalid JSON")
    }
  }

  function validateGetItemKey(v: string) {
    setGetItemKeyJson(v)
    try {
      JSON.parse(v)
      setGetItemKeyError("")
    } catch {
      setGetItemKeyError("Invalid JSON")
    }
  }

  function validateExprValues(v: string) {
    setExprValuesJson(v)
    if (!v) { setExprValuesError(""); return }
    try {
      JSON.parse(v)
      setExprValuesError("")
    } catch {
      setExprValuesError("Invalid JSON")
    }
  }

  function handleSelectTable(t: string) {
    setSelectedTable(t)
    setScanItems(null)
    setQueryItems(null)
    setActiveTab("scan")
    setGetItemResult(undefined)
  }

  const tables = tableData?.tables ?? []
  const currentItems = activeTab === "scan" ? scanItems : queryItems
  const currentCount = activeTab === "scan" ? scanCount : queryCount

  // Extract all unique column keys from result items
  const resultColumns = currentItems
    ? Array.from(new Set(currentItems.flatMap((item) => Object.keys(item)))).slice(0, 10)
    : []

  function getCellValue(val: unknown): string {
    if (val === null || val === undefined) return ""
    if (typeof val === "object") return JSON.stringify(val)
    return String(val)
  }

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
                  onClick={() => handleSelectTable(t)}
                >
                  <span className="flex items-center gap-2 text-sm font-mono truncate">
                    <Database className="h-4 w-4 shrink-0 text-blue-500" />
                    {t}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {canMutate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Settings"
                        onClick={(e) => openSettingsDialog(t, e)}
                      >
                        <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
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
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right panel: detail + explorer */}
        <div className="lg:col-span-2 space-y-4">
          {/* Table detail panel */}
          {selectedTable && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Table Details — {selectedTable}
              </div>
              {detailLoading ? (
                <div className="p-3 space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-5" />)}
                </div>
              ) : tableDetail ? (
                <div className="p-3 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div className="text-muted-foreground">Status</div>
                    <div>
                      <Badge variant={tableDetail.status === "ACTIVE" ? "default" : "secondary"} className="text-xs">
                        {tableDetail.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">Item Count</div>
                    <div>{tableDetail.item_count.toLocaleString()}</div>
                    <div className="text-muted-foreground">Size</div>
                    <div>{(tableDetail.size_bytes / 1024).toFixed(2)} KB</div>
                    <div className="text-muted-foreground">Billing Mode</div>
                    <div>{tableDetail.billing_mode}</div>
                    {tableDetail.billing_mode === "PROVISIONED" && (
                      <>
                        <div className="text-muted-foreground">Read / Write Capacity</div>
                        <div>{tableDetail.read_capacity} / {tableDetail.write_capacity} RCU/WCU</div>
                      </>
                    )}
                    <div className="text-muted-foreground">Created</div>
                    <div>{tableDetail.created_at ? new Date(tableDetail.created_at).toLocaleString() : "—"}</div>
                  </div>

                  {/* Key Schema */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Key Schema</p>
                    <div className="flex flex-wrap gap-2">
                      {tableDetail.key_schema.map((k) => (
                        <span key={k.AttributeName} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded">
                          <span className="font-mono">{k.AttributeName}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{k.KeyType}</Badge>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* GSI */}
                  {tableDetail.gsi.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Global Secondary Indexes</p>
                      <ul className="space-y-1">
                        {tableDetail.gsi.map((g) => (
                          <li key={g.name} className="text-xs">
                            <span className="font-mono font-medium">{g.name}</span>
                            <span className="text-muted-foreground ml-2">
                              {g.key_schema.map((k) => `${k.AttributeName} (${k.KeyType})`).join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* LSI */}
                  {tableDetail.lsi.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Local Secondary Indexes</p>
                      <ul className="space-y-1">
                        {tableDetail.lsi.map((l) => (
                          <li key={l.name} className="text-xs font-mono">{l.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Stream ARN */}
                  {tableDetail.stream_arn && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Stream ARN</p>
                      <p className="text-xs font-mono break-all">{tableDetail.stream_arn}</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Item explorer */}
          <div className="border rounded-lg overflow-hidden">
            {!selectedTable ? (
              <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
                Select a table to browse items
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div className="bg-muted/40 px-3 py-2 flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTab("scan")}
                      className={`text-xs px-3 py-1 rounded transition-colors ${activeTab === "scan" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Scan
                    </button>
                    <button
                      onClick={() => setActiveTab("query")}
                      className={`text-xs px-3 py-1 rounded transition-colors ${activeTab === "query" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Query
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {canMutate && (
                      <Button size="sm" variant="outline" onClick={() => { setGetItemResult(undefined); setGetItemKeyJson(""); setGetItemOpen(true) }}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Get Item
                      </Button>
                    )}
                    {canMutate && (
                      <Button size="sm" variant="outline" onClick={() => setPutItemOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Put Item
                      </Button>
                    )}
                    {activeTab === "scan" && (
                      <Button size="sm" onClick={handleScan} disabled={scanning}>
                        <Search className="h-3.5 w-3.5 mr-1" />
                        {scanning ? "Scanning…" : "Scan"}
                      </Button>
                    )}
                    {activeTab === "query" && (
                      <Button size="sm" onClick={handleQuery} disabled={querying || !keyCondition}>
                        <Search className="h-3.5 w-3.5 mr-1" />
                        {querying ? "Querying…" : "Run Query"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Query inputs */}
                {activeTab === "query" && (
                  <div className="px-3 py-2 border-b space-y-2">
                    <div>
                      <label className="text-xs text-muted-foreground">KeyConditionExpression</label>
                      <Input
                        value={keyCondition}
                        onChange={(e) => setKeyCondition(e.target.value)}
                        placeholder='pk = :pk'
                        className="mt-1 text-xs font-mono h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">ExpressionAttributeValues (JSON)</label>
                      <Textarea
                        value={exprValuesJson}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => validateExprValues(e.target.value)}
                        placeholder={'{"  :pk": {"S": "my-value"}}'}
                        className="mt-1 text-xs font-mono h-20"
                      />
                      {exprValuesError && <p className="text-xs text-destructive mt-0.5">{exprValuesError}</p>}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Index Name (optional)</label>
                      <Input
                        value={indexName}
                        onChange={(e) => setIndexName(e.target.value)}
                        placeholder="my-gsi"
                        className="mt-1 text-xs font-mono h-8"
                      />
                    </div>
                  </div>
                )}

                {/* Results */}
                {currentItems === null ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    {activeTab === "scan" ? "Click Scan to load items" : "Enter a condition and click Run Query"}
                  </div>
                ) : currentItems.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    No items found
                  </div>
                ) : (
                  <>
                    <div className="px-3 py-1 border-b">
                      <Badge variant="secondary" className="text-xs">{currentCount} items</Badge>
                    </div>
                    <div className="overflow-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {resultColumns.map((col) => (
                              <TableHead key={col} className="text-xs font-mono whitespace-nowrap">{col}</TableHead>
                            ))}
                            {canMutate && <TableHead className="text-xs w-16">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentItems.map((item, idx) => (
                            <TableRow key={idx}>
                              {resultColumns.map((col) => (
                                <TableCell key={col} className="text-xs font-mono max-w-[200px] truncate">
                                  {getCellValue(item[col])}
                                </TableCell>
                              ))}
                              {canMutate && (
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => openDeleteItemDialog(item)}
                                    title="Delete item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
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

      {/* Get item dialog */}
      <Dialog open={getItemOpen} onOpenChange={(open) => { setGetItemOpen(open); if (!open) setGetItemResult(undefined) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Get Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Key (JSON)</label>
              <Textarea
                className="font-mono text-xs h-24 mt-1"
                placeholder={'{\n  "id": {"S": "my-id"}\n}'}
                value={getItemKeyJson}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => validateGetItemKey(e.target.value)}
              />
              {getItemKeyError && <p className="text-xs text-destructive mt-0.5">{getItemKeyError}</p>}
            </div>
            {getItemResult !== undefined && (
              <div>
                <p className="text-sm font-medium mb-1">Result</p>
                {getItemResult === null ? (
                  <p className="text-sm text-muted-foreground">Item not found</p>
                ) : (
                  <pre className="text-xs font-mono bg-muted rounded p-3 overflow-auto max-h-48">
                    {JSON.stringify(getItemResult, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGetItemOpen(false)}>Close</Button>
            <Button
              onClick={handleGetItem}
              disabled={!getItemKeyJson || !!getItemKeyError || getItemLoading}
            >
              {getItemLoading ? "Fetching…" : "Get Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete item confirmation dialog */}
      <Dialog open={deleteItemOpen} onOpenChange={setDeleteItemOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this item? This action cannot be undone.</p>
          {itemToDelete && tableDetail && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Key fields:</p>
              {tableDetail.key_schema.map((k) => (
                <div key={k.AttributeName} className="flex gap-2 text-xs">
                  <span className="font-mono font-medium">{k.AttributeName}:</span>
                  <span className="font-mono text-muted-foreground">{getCellValue(itemToDelete[k.AttributeName])}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItemOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteItem} disabled={deletingItem}>
              {deletingItem ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Table Settings — {settingsTable}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Billing Mode</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="billing"
                    value="PAY_PER_REQUEST"
                    checked={billingMode === "PAY_PER_REQUEST"}
                    onChange={() => setBillingMode("PAY_PER_REQUEST")}
                  />
                  Pay Per Request (On-Demand)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="billing"
                    value="PROVISIONED"
                    checked={billingMode === "PROVISIONED"}
                    onChange={() => setBillingMode("PROVISIONED")}
                  />
                  Provisioned
                </label>
              </div>
            </div>
            {billingMode === "PROVISIONED" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Read Capacity Units</label>
                  <Input
                    type="number"
                    min={1}
                    value={readCapacity}
                    onChange={(e) => setReadCapacity(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Write Capacity Units</label>
                  <Input
                    type="number"
                    min={1}
                    value={writeCapacity}
                    onChange={(e) => setWriteCapacity(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? "Saving…" : "Save Settings"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
