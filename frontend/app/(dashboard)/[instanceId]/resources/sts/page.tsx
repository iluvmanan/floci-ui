"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CallerIdentity {
  account: string
  user_id: string
  arn: string
}

interface Credentials {
  access_key_id: string
  secret_access_key: string
  session_token: string
  expiration: string
  federated_user_arn?: string
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard"))
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className="font-mono text-sm bg-muted rounded px-2 py-1 flex-1 break-all">{value}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(value)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function CredentialsPanel({ creds }: { creds: Credentials }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="space-y-3 mt-4 border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Credentials shown once — copy now, they will not be shown again.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setRevealed((r) => !r)}>
          {revealed ? <EyeOff className="h-3.5 w-3.5 mr-1" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
          {revealed ? "Hide" : "Reveal"}
        </Button>
      </div>
      <CopyField label="Access Key ID" value={revealed ? creds.access_key_id : "••••••••••••••••••••"} />
      <CopyField label="Secret Access Key" value={revealed ? creds.secret_access_key : "••••••••••••••••••••••••••••••••••••••••"} />
      <CopyField label="Session Token" value={revealed ? creds.session_token : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••"} />
      {creds.federated_user_arn && <CopyField label="Federated User ARN" value={creds.federated_user_arn} />}
      <p className="text-xs text-muted-foreground">
        Expires: {creds.expiration && creds.expiration !== "None" ? new Date(creds.expiration).toLocaleString() : "—"}
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function STSPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  // Assume role form
  const [roleArn, setRoleArn] = useState("")
  const [sessionName, setSessionName] = useState("")
  const [duration, setDuration] = useState("3600")
  const [externalId, setExternalId] = useState("")
  const [assumeRoleCreds, setAssumeRoleCreds] = useState<Credentials | null>(null)

  // Federation token form
  const [fedName, setFedName] = useState("")
  const [fedDuration, setFedDuration] = useState("3600")
  const [fedCreds, setFedCreds] = useState<Credentials | null>(null)

  const { data: identity, isLoading: identityLoading, refetch } = useQuery({
    queryKey: ["sts-identity", instanceId],
    queryFn: () => instancesApi.getCallerIdentity(instanceId).then((r) => r.data as CallerIdentity),
  })

  const assumeRoleMutation = useMutation({
    mutationFn: () =>
      instancesApi.assumeRole(instanceId, {
        role_arn: roleArn,
        role_session_name: sessionName,
        duration_seconds: Number(duration),
        external_id: externalId || undefined,
      }).then((r) => r.data as Credentials),
    onSuccess: (data) => {
      setAssumeRoleCreds(data)
      toast.success("Role assumed")
    },
    onError: () => toast.error("Failed to assume role"),
  })

  const federationMutation = useMutation({
    mutationFn: () =>
      instancesApi.getFederationToken(instanceId, {
        name: fedName,
        duration_seconds: Number(fedDuration),
      }).then((r) => r.data as Credentials),
    onSuccess: (data) => {
      setFedCreds(data)
      toast.success("Federation token issued")
    },
    onError: () => toast.error("Failed to get federation token"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">STS</h2>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Identity Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Caller Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {identityLoading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : identity ? (
            <>
              <CopyField label="Account ID" value={identity.account} />
              <CopyField label="User ID" value={identity.user_id} />
              <CopyField label="ARN" value={identity.arn} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load caller identity</p>
          )}
        </CardContent>
      </Card>

      {/* Assume Role */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assume Role</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium">Role ARN</label>
            <Input value={roleArn} onChange={(e) => setRoleArn(e.target.value)} className="mt-1" placeholder="arn:aws:iam::123456789012:role/MyRole" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Session Name</label>
              <Input value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Duration (seconds, 900-43200)</label>
              <Input type="number" min={900} max={43200} value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">External ID (optional)</label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} className="mt-1" />
          </div>
          <Button
            onClick={() => assumeRoleMutation.mutate()}
            disabled={!roleArn || !sessionName || assumeRoleMutation.isPending}
          >
            Assume Role
          </Button>
          {assumeRoleCreds && <CredentialsPanel creds={assumeRoleCreds} />}
        </CardContent>
      </Card>

      {/* Federation Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Get Federation Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={fedName} onChange={(e) => setFedName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Duration (seconds, 900-43200)</label>
              <Input type="number" min={900} max={43200} value={fedDuration} onChange={(e) => setFedDuration(e.target.value)} className="mt-1" />
            </div>
          </div>
          <Button onClick={() => federationMutation.mutate()} disabled={!fedName || federationMutation.isPending}>
            Get Federation Token
          </Button>
          {fedCreds && <CredentialsPanel creds={fedCreds} />}
        </CardContent>
      </Card>
    </div>
  )
}
