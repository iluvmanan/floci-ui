"use client"

import { useState } from "react"
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
import { Mail, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface EventBus {
  name: string
  arn: string
}

export default function EventBridgePage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const canMutate = user && ["admin", "operator", "superadmin"].includes(user.role)

  const [createOpen, setCreateOpen] = useState(false)
  const [busName, setBusName] = useState("")

  const { data: buses = [], isLoading, refetch } = useQuery({
    queryKey: ["eventbridge-buses", instanceId],
    queryFn: () => instancesApi.listBuses(instanceId).then((r) => r.data as EventBus[]),
  })

  const createMutation = useMutation({
    mutationFn: () => instancesApi.createBus(instanceId, busName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["eventbridge-buses", instanceId] })
      setCreateOpen(false)
      setBusName("")
      toast.success(`Bus "${busName}" created`)
    },
    onError: () => toast.error("Failed to create bus"),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">EventBridge Buses</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {canMutate && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Bus
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : buses.length === 0 ? (
        <div className="border rounded-lg flex items-center justify-center h-48 text-sm text-muted-foreground">
          No event buses found
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bus Name</TableHead>
                <TableHead className="font-mono text-xs">ARN</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {buses.map((b) => (
                <TableRow key={b.name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-purple-500 shrink-0" />
                      <span className="font-medium text-sm">{b.name}</span>
                      {b.name === "default" && <Badge variant="secondary" className="text-xs">default</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{b.arn}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Event Bus</DialogTitle></DialogHeader>
          <Input
            placeholder="Bus name"
            value={busName}
            onChange={(e) => setBusName(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!busName || createMutation.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
