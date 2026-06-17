"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"

interface TranscriptionJob {
  transcription_job_name: string
  creation_time: string
  start_time: string
  completion_time: string
  language_code: string
  transcription_job_status: string
  failure_reason: string
}

const LANGUAGE_CODES = [
  "en-US", "en-GB", "en-AU", "en-IN", "es-US", "es-ES", "fr-FR", "fr-CA",
  "de-DE", "it-IT", "pt-BR", "pt-PT", "nl-NL", "ja-JP", "ko-KR", "zh-CN",
  "hi-IN", "ar-SA", "ru-RU", "sv-SE",
]

const MEDIA_FORMATS = ["mp3", "mp4", "wav", "flac", "ogg", "amr", "webm"]

function statusBadge(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "default"
  if (status === "IN_PROGRESS" || status === "QUEUED") return "secondary"
  if (status === "FAILED") return "destructive"
  return "outline"
}

export default function TranscribePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = !!(user && ["admin", "operator", "superadmin"].includes(user.role))

  const [createOpen, setCreateOpen] = useState(false)
  const [jobName, setJobName] = useState("")
  const [mediaUri, setMediaUri] = useState("")
  const [languageCode, setLanguageCode] = useState("en-US")
  const [mediaFormat, setMediaFormat] = useState<string>("")
  const [outputBucketName, setOutputBucketName] = useState("")

  const [transcriptJob, setTranscriptJob] = useState<string | null>(null)

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["transcribe-jobs", instanceId],
    queryFn: () => instancesApi.listTranscriptionJobs(instanceId).then((r) => r.data as TranscriptionJob[]),
    refetchInterval: (query) => {
      const data = query.state.data as TranscriptionJob[] | undefined
      const active = data?.some((j) => j.transcription_job_status === "IN_PROGRESS" || j.transcription_job_status === "QUEUED")
      return active ? 10000 : false
    },
  })

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ["transcribe-transcript", instanceId, transcriptJob],
    queryFn: () => instancesApi.getTranscript(instanceId, transcriptJob as string).then((r) => r.data as { transcript: string; items: unknown[]; error?: string }),
    enabled: !!transcriptJob,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      instancesApi.startTranscriptionJob(instanceId, {
        transcription_job_name: jobName,
        media_uri: mediaUri,
        language_code: languageCode,
        media_format: mediaFormat || undefined,
        output_bucket_name: outputBucketName || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcribe-jobs", instanceId] })
      setCreateOpen(false)
      setJobName(""); setMediaUri(""); setMediaFormat(""); setOutputBucketName("")
      toast.success("Transcription job started")
    },
    onError: () => toast.error("Failed to start transcription job"),
  })

  const deleteMutation = useMutation({
    mutationFn: (name: string) => instancesApi.deleteTranscriptionJob(instanceId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transcribe-jobs", instanceId] })
      toast.success("Transcription job deleted")
    },
    onError: () => toast.error("Failed to delete transcription job"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Transcribe</h2>
        {canMutate && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Start Transcription Job
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
                <TableHead>Language</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm h-24">No transcription jobs found</TableCell></TableRow>
              ) : jobs.map((j) => (
                <TableRow key={j.transcription_job_name}>
                  <TableCell className="font-mono text-sm">{j.transcription_job_name}</TableCell>
                  <TableCell><Badge variant="outline">{j.language_code}</Badge></TableCell>
                  <TableCell><Badge variant={statusBadge(j.transcription_job_status)}>{j.transcription_job_status}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{j.creation_time ? new Date(j.creation_time).toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{j.completion_time ? new Date(j.completion_time).toLocaleString() : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {j.transcription_job_status === "COMPLETED" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTranscriptJob(j.transcription_job_name)}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canMutate && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(j.transcription_job_name)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Start Transcription Job Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Start Transcription Job</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Job Name</Label>
              <Input value={jobName} onChange={(e) => setJobName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Media S3 URI</Label>
              <Input value={mediaUri} onChange={(e) => setMediaUri(e.target.value)} className="mt-1" placeholder="s3://my-bucket/audio.mp3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Language</Label>
                <Select value={languageCode} onValueChange={(v) => v && setLanguageCode(v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_CODES.map((lc) => (
                      <SelectItem key={lc} value={lc}>{lc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1 block">Media Format (optional)</Label>
                <Select value={mediaFormat} onValueChange={(v) => setMediaFormat(v ?? "")}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_FORMATS.map((mf) => (
                      <SelectItem key={mf} value={mf}>{mf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Output S3 Bucket (optional)</Label>
              <Input value={outputBucketName} onChange={(e) => setOutputBucketName(e.target.value)} className="mt-1" placeholder="my-transcripts-bucket" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!jobName || !mediaUri || createMutation.isPending}
            >
              Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Transcript Dialog */}
      <Dialog open={!!transcriptJob} onOpenChange={() => setTranscriptJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{transcriptJob}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded border p-3 text-sm">
            {transcriptLoading ? (
              <Skeleton className="h-24" />
            ) : transcript?.error ? (
              <p className="text-muted-foreground">{transcript.error}</p>
            ) : (
              <p className="whitespace-pre-wrap">{transcript?.transcript || "No transcript available"}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTranscriptJob(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
