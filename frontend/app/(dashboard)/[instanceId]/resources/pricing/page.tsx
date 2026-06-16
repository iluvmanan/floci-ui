"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { instancesApi } from "@/lib/api/instances"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { Download, Search } from "lucide-react"
import { toast } from "sonner"

interface PricingService {
  service_code: string
  attribute_names: string[]
}

interface PriceListItem {
  sku: string
  product_family: string
  attributes: Record<string, string>
  terms: { on_demand: { price_per_unit?: string; unit?: string; description?: string } }
}

function exportToCsv(items: PriceListItem[]) {
  const headers = ["SKU", "Product Family", "Description", "Price Per Unit", "Unit"]
  const rows = items.map((i) => [
    i.sku,
    i.product_family,
    i.terms.on_demand?.description ?? "",
    i.terms.on_demand?.price_per_unit ?? "",
    i.terms.on_demand?.unit ?? "",
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "pricing-export.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function PricingPage() {
  const { instanceId } = useParams<{ instanceId: string }>()

  const [serviceCode, setServiceCode] = useState("")
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [results, setResults] = useState<PriceListItem[] | null>(null)

  const { data: services = [], isLoading: servicesLoading } = useQuery({
    queryKey: ["pricing-services", instanceId],
    queryFn: () => instancesApi.listPricingServices(instanceId).then((r) => r.data as PricingService[]),
  })

  const selectedService = services.find((s) => s.service_code === serviceCode)
  const attributeNames = (selectedService?.attribute_names ?? []).slice(0, 6)

  const searchMutation = useMutation({
    mutationFn: () => {
      const activeFilters = Object.entries(filters)
        .filter(([, v]) => !!v)
        .map(([field, value]) => ({ type: "TERM_MATCH", field, value }))
      return instancesApi.searchPriceList(instanceId, {
        service_code: serviceCode,
        filters: activeFilters.length ? activeFilters : undefined,
        max_results: 50,
      })
    },
    onSuccess: (resp) => setResults(resp.data as PriceListItem[]),
    onError: () => toast.error("Failed to search prices"),
  })

  function AttributeFilter({ attr }: { attr: string }) {
    const { data: values = [], isLoading } = useQuery({
      queryKey: ["pricing-attr-values", instanceId, serviceCode, attr],
      queryFn: () => instancesApi.getPricingAttributeValues(instanceId, serviceCode, attr).then((r) => r.data as string[]),
      enabled: !!serviceCode,
    })

    return (
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">{attr}</Label>
        {isLoading ? (
          <Skeleton className="h-9 w-44" />
        ) : (
          <Select
            value={filters[attr] ?? ""}
            onValueChange={(v) => setFilters((prev) => ({ ...prev, [attr]: v ?? "" }))}
          >
            <SelectTrigger className="w-44"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent>
              {values.slice(0, 100).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Pricing</h2>
      <p className="text-xs text-muted-foreground">
        Pricing data is always queried from the AWS Pricing API in us-east-1, regardless of this instance&apos;s configured region.
      </p>

      <div className="flex flex-wrap items-end gap-3 border rounded-lg p-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Service</Label>
          {servicesLoading ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <Select
              value={serviceCode}
              onValueChange={(v) => { setServiceCode(v ?? ""); setFilters({}); setResults(null) }}
            >
              <SelectTrigger className="w-56"><SelectValue placeholder="Select a service" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => <SelectItem key={s.service_code} value={s.service_code}>{s.service_code}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {serviceCode && attributeNames.map((attr) => <AttributeFilter key={attr} attr={attr} />)}

        <Button size="sm" onClick={() => searchMutation.mutate()} disabled={!serviceCode || searchMutation.isPending}>
          <Search className="h-3.5 w-3.5 mr-1" /> Search Prices
        </Button>
        {results && results.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => exportToCsv(results)}>
            <Download className="h-3.5 w-3.5 mr-1" /> Export to CSV
          </Button>
        )}
      </div>

      {searchMutation.isPending ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : results === null ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm border rounded-lg">
          Select a service and click &quot;Search Prices&quot;
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product Family</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Price Per Unit</TableHead>
                <TableHead>Unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground text-sm h-24">No prices found</TableCell></TableRow>
              ) : results.map((item) => (
                <TableRow key={item.sku}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-sm">{item.product_family}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate" title={item.terms.on_demand?.description}>{item.terms.on_demand?.description ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{item.terms.on_demand?.price_per_unit ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.terms.on_demand?.unit ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
