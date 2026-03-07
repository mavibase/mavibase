"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  FileText,
  HardDrive,
  Zap,
  Columns3,
  GitBranch,
  Layers,
  ChartArea,
  ChartNoAxesColumn,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/custom-toast"
import axiosInstance from "@/lib/axios-instance"

interface UsageData {
  documentCount: number
  storageBytes: number
  indexCount: number
  attributeCount: number
  indexStorageBytes: number
  versionCount: number
  versionStorageBytes: number
  schemaStorageBytes: number
  avgDocumentSize: number
  totalBytes: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function CollectionUsagePage() {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/usage`
      )
      setUsage(res.data?.data || null)
    } catch {
      setUsage(null)
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  const summaryCards = usage
    ? [
        { label: "Documents", value: usage.documentCount.toLocaleString(), icon: FileText },
        { label: "Total Storage", value: formatBytes(usage.totalBytes || usage.storageBytes), icon: HardDrive },
        { label: "Indexes", value: usage.indexCount.toLocaleString(), icon: Zap },
        { label: "Attributes", value: usage.attributeCount.toLocaleString(), icon: Columns3 },
      ]
    : []

  const breakdownRows = usage
    ? [
        {
          label: "Documents",
          icon: FileText,
          count: usage.documentCount,
          size: usage.storageBytes,
          color: "bg-sky-500",
          extra: usage.avgDocumentSize > 0 ? `Avg: ${formatBytes(usage.avgDocumentSize)}` : null,
        },
        {
          label: "Indexes",
          icon: Zap,
          count: usage.indexCount,
          size: usage.indexStorageBytes || 0,
          color: "bg-amber-500",
          extra: null,
        },
        {
          label: "Versions",
          icon: GitBranch,
          count: usage.versionCount || 0,
          size: usage.versionStorageBytes || 0,
          color: "bg-orange-500",
          extra: null,
        },
        {
          label: "Schema",
          icon: Layers,
          count: usage.attributeCount,
          size: usage.schemaStorageBytes || 0,
          color: "bg-emerald-500",
          extra: `${usage.attributeCount} attribute${usage.attributeCount !== 1 ? "s" : ""}`,
        },
      ]
    : []

  const totalBytes = usage?.totalBytes || usage?.storageBytes || 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <ChartNoAxesColumn className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Usage
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Resource usage statistics for this collection.


            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : usage ? (
        <div className="flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.label} className="rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2 text-muted-foreground mb-3">
                    <Icon className="size-4" />
                    <p className="text-xs uppercase tracking-wider font-medium">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-2xl font-semibold text-foreground">
                    {card.value}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Detailed breakdown table */}
          {totalBytes > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card">
                <p className="text-sm font-medium text-foreground">Storage breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-card/50">
                      <th className="border-b border-r border-border px-4 py-2 text-left text-xs font-medium text-muted-foreground">Resource</th>
                      <th className="border-b border-r border-border px-4 py-2 text-right text-xs font-medium text-muted-foreground">Count</th>
                      <th className="border-b border-r border-border px-4 py-2 text-right text-xs font-medium text-muted-foreground">Size</th>
                      <th className="border-b border-r border-border px-4 py-2 text-right text-xs font-medium text-muted-foreground">% of Total</th>
                      <th className="border-b border-border px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[180px]">Usage</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {breakdownRows.map((row) => {
                      const pct = totalBytes > 0 ? (row.size / totalBytes) * 100 : 0
                      const Icon = row.icon
                      return (
                        <tr key={row.label} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                          <td className="border-r border-border px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5 text-muted-foreground" />
                              <span className="text-foreground">{row.label}</span>
                              {row.extra && (
                                <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                                  {row.extra}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="border-r border-border px-4 py-2.5 text-right">
                            <span className="text-foreground font-mono text-xs tabular-nums">{row.count.toLocaleString()}</span>
                          </td>
                          <td className="border-r border-border px-4 py-2.5 text-right">
                            <span className="text-foreground font-mono text-xs">{formatBytes(row.size)}</span>
                          </td>
                          <td className="border-r border-border px-4 py-2.5 text-right">
                            <span className="text-muted-foreground font-mono text-xs">{pct.toFixed(1)}%</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="h-2 rounded-full bg-secondary overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.max(pct, 0.5)}%` }} />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {/* Total row */}
                    <tr className="bg-card/50 font-medium">
                      <td className="border-r border-border px-4 py-2.5">
                        <span className="text-foreground">Total</span>
                      </td>
                      <td className="border-r border-border px-4 py-2.5 text-right">
                        <span className="text-foreground font-mono text-xs">-</span>
                      </td>
                      <td className="border-r border-border px-4 py-2.5 text-right">
                        <span className="text-foreground font-mono text-xs">{formatBytes(totalBytes)}</span>
                      </td>
                      <td className="border-r border-border px-4 py-2.5 text-right">
                        <span className="text-foreground font-mono text-xs">100%</span>
                      </td>
                      <td className="px-4 py-2.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            No usage data available.
          </p>
        </div>
      )}
    </div>
  )
}
