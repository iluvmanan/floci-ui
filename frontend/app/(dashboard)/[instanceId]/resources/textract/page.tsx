"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Plus, Trash2, ScanText } from "lucide-react"
import { toast } from "sonner"

interface TextBlock {
  block_type: string
  text: string
  confidence: number
  geometry: Record<string, unknown>
}

interface TextResult {
  blocks: TextBlock[]
}

interface KeyValuePair {
  key: string
  value: string
  confidence: number
}

interface FormsResult {
  key_value_sets: KeyValuePair[]
}

interface TablesResult {
  tables: string[][][]
}

interface QueryResultItem {
  alias: string
  answer: string
  confidence: number
}

interface QueriesResult {
  query_results: QueryResultItem[]
}

interface QueryInput {
  text: string
  alias: string
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1] ?? ""
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function TextractPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const [inputMode, setInputMode] = useState<"s3" | "upload">("s3")
  const [s3Bucket, setS3Bucket] = useState("")
  const [s3Key, setS3Key] = useState("")
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null)
  const [fileBase64, setFileBase64] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState("text")
  const [queries, setQueries] = useState<QueryInput[]>([{ text: "", alias: "" }])

  const [textResult, setTextResult] = useState<TextResult | null>(null)
  const [formsResult, setFormsResult] = useState<FormsResult | null>(null)
  const [tablesResult, setTablesResult] = useState<TablesResult | null>(null)
  const [queriesResult, setQueriesResult] = useState<QueriesResult | null>(null)

  function buildDocument() {
    if (inputMode === "s3") {
      return { s3_bucket: s3Bucket, s3_key: s3Key }
    }
    return { bytes_base64: fileBase64 }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setFileDataUrl(reader.result as string)
    reader.readAsDataURL(file)
    const base64 = await readFileAsBase64(file)
    setFileBase64(base64)
  }

  const detectTextMutation = useMutation({
    mutationFn: () => instancesApi.textractDetectText(instanceId, buildDocument()),
    onSuccess: (r) => { setTextResult(r.data as TextResult); toast.success("Analysis complete") },
    onError: () => toast.error("Failed to analyze document"),
  })

  const analyzeFormsMutation = useMutation({
    mutationFn: () => instancesApi.textractAnalyzeForms(instanceId, buildDocument()),
    onSuccess: (r) => { setFormsResult(r.data as FormsResult); toast.success("Analysis complete") },
    onError: () => toast.error("Failed to analyze document"),
  })

  const analyzeTablesMutation = useMutation({
    mutationFn: () => instancesApi.textractAnalyzeTables(instanceId, buildDocument()),
    onSuccess: (r) => { setTablesResult(r.data as TablesResult); toast.success("Analysis complete") },
    onError: () => toast.error("Failed to analyze document"),
  })

  const analyzeQueriesMutation = useMutation({
    mutationFn: () =>
      instancesApi.textractAnalyzeQueries(instanceId, {
        document: buildDocument(),
        queries: queries.filter((q) => q.text.trim()).map((q) => ({ text: q.text, alias: q.alias || undefined })),
      }),
    onSuccess: (r) => { setQueriesResult(r.data as QueriesResult); toast.success("Analysis complete") },
    onError: () => toast.error("Failed to analyze document"),
  })

  const hasDocument = inputMode === "s3" ? !!(s3Bucket && s3Key) : !!fileBase64

  function handleAnalyze() {
    if (!hasDocument) {
      toast.error("Provide a document location or upload a file")
      return
    }
    if (activeTab === "text") detectTextMutation.mutate()
    else if (activeTab === "forms") analyzeFormsMutation.mutate()
    else if (activeTab === "tables") analyzeTablesMutation.mutate()
    else if (activeTab === "queries") analyzeQueriesMutation.mutate()
  }

  const isPending =
    detectTextMutation.isPending || analyzeFormsMutation.isPending ||
    analyzeTablesMutation.isPending || analyzeQueriesMutation.isPending

  const lineTexts = textResult?.blocks.filter((b) => b.block_type === "LINE").map((b) => b.text) ?? []

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Textract</h2>

      <div className="border rounded-lg p-3 space-y-3">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" name="inputMode" checked={inputMode === "s3"} onChange={() => setInputMode("s3")} />
            S3 Location
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="inputMode" checked={inputMode === "upload"} onChange={() => setInputMode("upload")} />
            Upload File
          </label>
        </div>

        {inputMode === "s3" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>S3 Bucket</Label>
              <Input value={s3Bucket} onChange={(e) => setS3Bucket(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>S3 Key</Label>
              <Input value={s3Key} onChange={(e) => setS3Key(e.target.value)} className="mt-1" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="text-sm" />
            {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            {fileDataUrl && fileDataUrl.startsWith("data:image") && (
              <img src={fileDataUrl} alt="preview" className="max-h-64 rounded border" />
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="text">Text Detection</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="queries">Queries</TabsTrigger>
        </TabsList>

        {activeTab === "queries" && (
          <div className="pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Questions</Label>
            {queries.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder="What is the invoice number?"
                  value={q.text}
                  onChange={(e) => {
                    const next = [...queries]
                    next[i] = { ...next[i], text: e.target.value }
                    setQueries(next)
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Alias (optional)"
                  value={q.alias}
                  onChange={(e) => {
                    const next = [...queries]
                    next[i] = { ...next[i], alias: e.target.value }
                    setQueries(next)
                  }}
                  className="w-40"
                />
                {queries.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQueries(queries.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setQueries([...queries, { text: "", alias: "" }])}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Question
            </Button>
          </div>
        )}

        <div className="pt-3">
          <Button onClick={handleAnalyze} disabled={isPending || !hasDocument}>
            <ScanText className="h-3.5 w-3.5 mr-1.5" />
            {isPending ? "Analyzing…" : "Analyze"}
          </Button>
        </div>

        <TabsContent value="text" className="pt-3">
          {textResult ? (
            lineTexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No text detected</p>
            ) : (
              <div className="space-y-2">
                {lineTexts.map((t, i) => (
                  <p key={i} className="text-sm">{t}</p>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Run analysis to see results</p>
          )}
        </TabsContent>

        <TabsContent value="forms" className="pt-3">
          {formsResult ? (
            formsResult.key_value_sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No key-value pairs detected</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formsResult.key_value_sets.map((kv, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{kv.key}</TableCell>
                        <TableCell className="text-sm">{kv.value}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{kv.confidence.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Run analysis to see results</p>
          )}
        </TabsContent>

        <TabsContent value="tables" className="pt-3">
          {tablesResult ? (
            tablesResult.tables.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tables detected</p>
            ) : (
              <div className="space-y-4">
                {tablesResult.tables.map((table, ti) => (
                  <table key={ti} className="w-full border-collapse border text-sm">
                    <tbody>
                      {table.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border px-2 py-1">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Run analysis to see results</p>
          )}
        </TabsContent>

        <TabsContent value="queries" className="pt-3">
          {queriesResult ? (
            queriesResult.query_results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No query results</p>
            ) : (
              <div className="space-y-2">
                {queriesResult.query_results.map((q, i) => (
                  <div key={i} className="border rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">{q.alias || `Query ${i + 1}`}</p>
                    <p className="text-sm font-medium">{q.answer || "—"}</p>
                    <p className="text-xs text-muted-foreground">Confidence: {q.confidence.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Run analysis to see results</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
