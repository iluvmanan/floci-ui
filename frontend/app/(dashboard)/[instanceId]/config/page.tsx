"use client"

import { useParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { Download, RotateCcw, Save, Search } from "lucide-react"
import { instancesApi } from "@/lib/api/instances"
import { CONFIG_GROUPS, CONFIG_SCHEMA, type ConfigGroup } from "@/lib/config-schema"
import { EnvVarInput } from "@/components/config/EnvVarInput"
import { ExportModal } from "@/components/config/ExportModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"

type ConfigData = Record<string, Record<string, boolean | number | string>>

export default function ConfigPage() {
  const { instanceId } = useParams<{ instanceId: string }>()
  const qc = useQueryClient()
  const [activeGroup, setActiveGroup] = useState<ConfigGroup>("global")
  const [search, setSearch] = useState("")
  const [localChanges, setLocalChanges] = useState<ConfigData>({})
  const [exportOpen, setExportOpen] = useState(false)

  const { data: serverConfig, isLoading } = useQuery({
    queryKey: ["instance-config", instanceId],
    queryFn: () => instancesApi.getConfig(instanceId).then((r) => r.data as ConfigData),
  })

  // Merge server config with unsaved local changes
  const displayConfig: ConfigData = useMemo(() => {
    if (!serverConfig) return {}
    const merged: ConfigData = {}
    for (const group of CONFIG_GROUPS) {
      merged[group] = { ...(serverConfig[group] ?? {}), ...(localChanges[group] ?? {}) }
    }
    return merged
  }, [serverConfig, localChanges])

  const isDirty = Object.keys(localChanges).some(
    (g) => Object.keys(localChanges[g] ?? {}).length > 0
  )

  function handleChange(group: ConfigGroup, key: string, value: boolean | number | string) {
    setLocalChanges((prev) => ({
      ...prev,
      [group]: { ...(prev[group] ?? {}), [key]: value },
    }))
  }

  const saveMutation = useMutation({
    mutationFn: () => instancesApi.updateConfig(instanceId, localChanges),
    onSuccess: () => {
      toast.success("Configuration saved")
      setLocalChanges({})
      qc.invalidateQueries({ queryKey: ["instance-config", instanceId] })
    },
    onError: () => toast.error("Failed to save configuration"),
  })

  const resetMutation = useMutation({
    mutationFn: () => instancesApi.resetConfig(instanceId),
    onSuccess: () => {
      toast.success("Configuration reset to defaults")
      setLocalChanges({})
      qc.invalidateQueries({ queryKey: ["instance-config", instanceId] })
    },
    onError: () => toast.error("Failed to reset configuration"),
  })

  // Get vars for active group, filtered by search
  const activeVars = useMemo(() => {
    const vars = CONFIG_SCHEMA[activeGroup] ?? []
    if (!search) return vars
    const q = search.toLowerCase()
    return vars.filter(
      (v) => v.key.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)
    )
  }, [activeGroup, search])

  // Count dirty vars per group for badge
  const dirtyCountByGroup = useCallback(
    (group: ConfigGroup) => Object.keys(localChanges[group] ?? {}).length,
    [localChanges]
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search config keys..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExportOpen(true)}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {isDirty && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          You have unsaved changes. Click "Save Changes" to apply.
        </p>
      )}

      {/* Group tabs */}
      <Tabs
        value={activeGroup}
        onValueChange={(v) => { setSearch(""); setActiveGroup(v as ConfigGroup) }}
      >
        <TabsList className="flex-wrap h-auto gap-1">
          {CONFIG_GROUPS.map((group) => {
            const dirty = dirtyCountByGroup(group)
            return (
              <TabsTrigger key={group} value={group} className="capitalize text-xs">
                {group}
                {dirty > 0 && (
                  <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1 leading-tight">
                    {dirty}
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* Config vars */}
      <Card>
        <CardContent className="p-0">
          {activeVars.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? `No config keys matching "${search}"` : "No config vars in this group"}
            </p>
          ) : (
            <div className="divide-y-0 px-4">
              {activeVars.map((varDef) => (
                <EnvVarInput
                  key={varDef.key}
                  varDef={varDef}
                  value={displayConfig[activeGroup]?.[varDef.key] ?? varDef.default}
                  onChange={(key, value) => handleChange(activeGroup, key, value)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        instanceId={instanceId}
      />
    </div>
  )
}
