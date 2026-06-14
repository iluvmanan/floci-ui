"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy, Download } from "lucide-react"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ExportFormat = "env" | "docker-compose" | "json"

interface Props {
  open: boolean
  onClose: () => void
  instanceId: string
}

export function ExportModal({ open, onClose, instanceId }: Props) {
  const [format, setFormat] = useState<ExportFormat>("env")
  const [content, setContent] = useState<string>("")
  const [loading, setLoading] = useState(false)

  async function load(fmt: ExportFormat) {
    setFormat(fmt)
    setLoading(true)
    try {
      const resp = await instancesApi.exportConfig(instanceId, fmt)
      if (fmt === "json") {
        setContent(JSON.stringify(resp.data, null, 2))
      } else {
        setContent(String(resp.data))
      }
    } catch {
      toast.error("Failed to export config")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (open) load("env")
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(content)
    toast.success("Copied to clipboard")
  }

  function downloadFile() {
    const ext = format === "env" ? ".env" : format === "docker-compose" ? ".yml" : ".json"
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `floci-config${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); else handleOpenChange(true); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Configuration</DialogTitle>
        </DialogHeader>

        <Tabs
          value={format}
          onValueChange={(v) => load(v as ExportFormat)}
          className="space-y-3"
        >
          <TabsList>
            <TabsTrigger value="env">.env file</TabsTrigger>
            <TabsTrigger value="docker-compose">docker-compose</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative">
          <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96 font-mono leading-relaxed">
            {loading ? "Loading..." : content || "(empty)"}
          </pre>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!content}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={downloadFile} disabled={!content}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download
          </Button>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
