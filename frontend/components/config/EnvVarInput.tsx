"use client"

import { type ConfigVar } from "@/lib/config-schema"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { Label } from "@/components/ui/label"

interface Props {
  varDef: ConfigVar
  value: boolean | number | string
  onChange: (key: string, value: boolean | number | string) => void
  disabled?: boolean
}

export function EnvVarInput({ varDef, value, onChange, disabled }: Props) {
  const { key, type, description, options } = varDef

  function renderInput() {
    if (type === "bool") {
      return (
        <Switch
          id={key}
          checked={Boolean(value)}
          onCheckedChange={(v) => onChange(key, v)}
          disabled={disabled}
        />
      )
    }
    if (type === "enum" && options) {
      return (
        <Select
          value={String(value)}
          onValueChange={(v) => onChange(key, v ?? "")}
          disabled={disabled}
        >
          <SelectTrigger className="w-48 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    if (type === "int") {
      return (
        <Input
          id={key}
          type="number"
          value={String(value)}
          onChange={(e) => onChange(key, Number(e.target.value))}
          disabled={disabled}
          className="w-36 h-7 text-xs font-mono"
        />
      )
    }
    // str, tag-list
    return (
      <Input
        id={key}
        type="text"
        value={String(value)}
        onChange={(e) => onChange(key, e.target.value)}
        disabled={disabled}
        className="w-72 h-7 text-xs font-mono"
        placeholder={type === "tag-list" ? "comma-separated values" : undefined}
      />
    )
  }

  return (
    <TooltipProvider delay={200}>
      <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Label htmlFor={key} className="text-xs font-mono text-foreground cursor-pointer truncate max-w-xs">
            {key}
          </Label>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs text-xs">
              <p>{description}</p>
              <p className="text-muted-foreground mt-1">Default: {String(varDef.default) || "(empty)"}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {renderInput()}
      </div>
    </TooltipProvider>
  )
}
