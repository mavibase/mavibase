"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  Table2,
  FileText,
  HardDrive,
  Zap,
  Layers,
  GitBranch,
  Link2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import axiosInstance from "@/lib/axios-instance"
import { useToast } from "@/components/custom-toast"
import { DatabaseHeader } from "@/components/database-header"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SizeBreakdown {
  documents: number
  collections: number
  indexes: number
  schemas: number
  relationships: number
  versions: number
  total: number
  last_calculated_at?: string
}

interface QuotaEntry {
  used: number
  limit: number
}

interface DbStats {
  databaseId: string
  databaseName: string
  collectionCount: number
  totalDocuments: number
  storageBytes: number
  collections: { id: string; name: string; documentCount: number }[]
  sizeBreakdown?: SizeBreakdown
  quotas?: {
    collections?: QuotaEntry
    documents?: QuotaEntry
    storage?: QuotaEntry
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB"]
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  const value = bytes / Math.pow(k, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${sizes[i]}`
}

function formatCount(num: number): string {
  if (num === 0) return "0"
  if (num < 1000) return num.toString()
  const units = [
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" },
  ]
  for (const unit of units) {
    if (num >= unit.value) {
      const value = num / unit.value
      return `${value % 1 === 0 ? value : value.toFixed(1)}${unit.suffix}`
    }
  }
  return num.toString()
}

function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
    })
  } catch { return iso }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function UsagePage() {
  const params = useParams()
  const dbId = params.dbId as string
  const { toast } = useToast()

  const [stats, setStats] = useState<DbStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/stats`)
      setStats(res.data?.data || null)
    } catch {
      toast({ message: "Failed to load usage data", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [dbId, toast])

  useEffect(() => { fetchStats() }, [fetchStats])

  if (loading) {
    return (
      <>
        <DatabaseHeader />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      </>
    )
  }

  if (!stats) {
    return (
      <>
        <DatabaseHeader />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No usage data available.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
    <DatabaseHeader />
    <div className="p-4 sm:p-6 lg:p-8 pt-6">
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Collections", value: formatCount(stats.collectionCount), icon: Table2, quota: stats.quotas?.collections, isStorage: false },
          { label: "Total Documents", value: formatCount(stats.totalDocuments), icon: FileText, quota: stats.quotas?.documents, isStorage: false },
          { label: "Storage", value: formatBytes(stats.storageBytes), icon: HardDrive, quota: stats.quotas?.storage, isStorage: true },
        ].map((card) => {
          const Icon = card.icon
          const pct = card.quota && card.quota.limit > 0 ? Math.min((card.quota.used / card.quota.limit) * 100, 100) : null
          const pctColor = pct !== null && pct > 90 ? "bg-red-500" : pct !== null && pct > 70 ? "bg-yellow-500" : "bg-primary"
          return (
            <div key={card.label} className="rounded-xl border border-border p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="size-4" />
                <p className="text-xs uppercase tracking-wider font-medium">{card.label}</p>
              </div>
              <p className="text-2xl font-semibold text-foreground">{card.value}</p>
              {pct !== null && card.quota && (
                <div className="flex flex-col gap-1">
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", pctColor)} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {card.isStorage ? formatBytes(card.quota.used) : formatCount(card.quota.used)} / {card.isStorage ? formatBytes(card.quota.limit) : formatCount(card.quota.limit)} ({pct.toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Size breakdown table */}
      {stats.sizeBreakdown && stats.sizeBreakdown.total > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Storage breakdown</p>
            {stats.sizeBreakdown.last_calculated_at && (
              <p className="text-[10px] text-muted-foreground">
                Last calculated: {formatTimestamp(stats.sizeBreakdown.last_calculated_at)}
              </p>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-card/50">
                  <th className="border-b border-r border-border px-4 py-2 text-left text-xs font-medium text-muted-foreground">Resource</th>
                  <th className="border-b border-r border-border px-4 py-2 text-right text-xs font-medium text-muted-foreground">Size</th>
                  <th className="border-b border-r border-border px-4 py-2 text-right text-xs font-medium text-muted-foreground">% of Total</th>
                  <th className="border-b border-border px-4 py-2 text-left text-xs font-medium text-muted-foreground min-w-[200px]">Usage</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  { label: "Documents", bytes: stats.sizeBreakdown.documents, icon: FileText, color: "bg-sky-500" },
                  { label: "Indexes", bytes: stats.sizeBreakdown.indexes, icon: Zap, color: "bg-amber-500" },
                  { label: "Schemas", bytes: stats.sizeBreakdown.schemas, icon: Layers, color: "bg-emerald-500" },
                  { label: "Collections", bytes: stats.sizeBreakdown.collections, icon: Table2, color: "bg-violet-500" },
                  { label: "Versions", bytes: stats.sizeBreakdown.versions, icon: GitBranch, color: "bg-orange-500" },
                  { label: "Relationships", bytes: stats.sizeBreakdown.relationships, icon: Link2, color: "bg-rose-500" },
                ].map((row) => {
                  const pct = stats.sizeBreakdown!.total > 0 ? (row.bytes / stats.sizeBreakdown!.total) * 100 : 0
                  const Icon = row.icon
                  return (
                    <tr key={row.label} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                      <td className="border-r border-border px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span className="text-foreground">{row.label}</span>
                        </div>
                      </td>
                      <td className="border-r border-border px-4 py-2.5 text-right">
                        <span className="text-foreground font-mono text-xs">{formatBytes(row.bytes)}</span>
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
                    <span className="text-foreground font-mono text-xs">{formatBytes(stats.sizeBreakdown.total)}</span>
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

      {/* Collections breakdown */}
      {stats.collections && stats.collections.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-card">
            <p className="text-sm font-medium text-foreground">Collections breakdown</p>
          </div>
          {stats.collections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <Table2 className="size-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{c.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatCount(c.documentCount)} documents
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
    </>
  )
}
