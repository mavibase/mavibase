"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  Trash2,
  ArrowUpDown,
  Zap,
  Eye,
  Copy,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import axiosInstance from "@/lib/axios-instance"
import { useToast } from "@/components/custom-toast"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DatabaseHeader } from "@/components/database-header"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SlowQueryLog {
  id: string
  database_id?: string
  query_sql: string
  duration_ms: number
  operation: string
  threshold_ms: number
  resource?: string
  suggestion?: string
  created_at: string
}

interface SlowQueryStats {
  summary: {
    total_slow_queries: string
    avg_duration_ms: number
    max_duration_ms: number
    min_duration_ms: number
    critical_count: string
    warning_count: string
    last_24h: string
    last_7d: string
  }
  operationBreakdown: { operation: string; count: string; avg_duration: number }[]
  hourlyTrend: { hour: string; count: string; avg_duration: number }[]
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatTimestamp(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", second: "2-digit",
    })
  } catch { return iso }
}

function truncateQuery(q: string, max = 80) {
  if (q.length <= max) return q
  return q.slice(0, max) + "..."
}

function getDurationColor(ms: number) {
  if (ms > 5000) return "text-red-400"
  if (ms > 1000) return "text-yellow-400"
  return "text-muted-foreground"
}

function getDurationBg(ms: number) {
  if (ms > 5000) return "bg-red-500/10"
  if (ms > 1000) return "bg-yellow-500/10"
  return "bg-secondary"
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function SlowQueriesPage() {
  const params = useParams()
  const dbId = params.dbId as string
  const { toast } = useToast()

  const [logs, setLogs] = useState<SlowQueryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [operationFilter, setOperationFilter] = useState("")
  const [minDuration, setMinDuration] = useState("")
  const [sortBy, setSortBy] = useState<"created_at" | "duration">("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [stats, setStats] = useState<SlowQueryStats | null>(null)
  const [clearing, setClearing] = useState(false)
  const [selectedLog, setSelectedLog] = useState<SlowQueryLog | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopyQuery = async () => {
    if (!selectedLog) return
    try {
      await navigator.clipboard.writeText(selectedLog.query_sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ message: "Failed to copy to clipboard", type: "error" })
    }
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const queryParams: Record<string, string | number> = { limit, offset, sort_by: sortBy, sort_order: sortOrder }
      if (operationFilter) queryParams.operation = operationFilter
      if (minDuration) queryParams.min_duration = parseInt(minDuration, 10)
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/slow-queries`, { params: queryParams })
      const data = res.data?.data
      setLogs(Array.isArray(data) ? data : [])
      setTotal(res.data?.pagination?.total ?? 0)
    } catch {
      setLogs([])
      setTotal(0)
      toast({ message: "Failed to load slow query logs", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [dbId, limit, offset, operationFilter, minDuration, sortBy, sortOrder, toast])

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/slow-queries/stats`)
      setStats(res.data?.data || null)
    } catch {
      // Stats are non-critical
    }
  }, [dbId])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => { fetchStats() }, [fetchStats])

  const handleClear = async () => {
    setClearing(true)
    try {
      await axiosInstance.db.delete(`/v1/db/databases/${dbId}/slow-queries`)
      toast({ message: "Slow query logs cleared", type: "success" })
      fetchLogs()
      fetchStats()
    } catch {
      toast({ message: "Failed to clear logs", type: "error" })
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
    <DatabaseHeader />
    <div className="p-4 sm:p-6 lg:p-8 pt-6">
    <div className="flex flex-col gap-4">
      {/* Stats summary */}
      {stats?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">{parseInt(stats.summary.total_slow_queries || "0", 10).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Avg Duration</p>
            <p className="text-lg font-semibold text-foreground mt-0.5">{stats.summary.avg_duration_ms ?? 0}ms</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Critical ({'>'} 5s)</p>
            <p className="text-lg font-semibold text-red-400 mt-0.5">{parseInt(stats.summary.critical_count || "0", 10)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Warning (1-5s)</p>
            <p className="text-lg font-semibold text-yellow-400 mt-0.5">{parseInt(stats.summary.warning_count || "0", 10)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={operationFilter}
          onChange={(e) => { setOperationFilter(e.target.value); setOffset(0) }}
          className="h-8 rounded-md border border-border bg-secondary px-2 text-sm text-foreground"
        >
          <option value="">All operations</option>
          <option value="SELECT">SELECT</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
        <Input
          placeholder="Min duration (ms)"
          value={minDuration}
          onChange={(e) => setMinDuration(e.target.value.replace(/\D/g, ""))}
          className="h-8 w-36 bg-secondary border-border text-sm"
        />
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-border text-destructive hover:bg-destructive/10"
            onClick={handleClear}
            disabled={clearing || total === 0}
          >
            {clearing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Clear logs
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
            <Zap className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No slow queries</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Queries exceeding the threshold will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[250px]">Query</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[100px]">
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono"
                        onClick={() => { if (sortBy === "duration") setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortBy("duration"); setSortOrder("desc") } }}
                      >
                        Duration
                        <ArrowUpDown className="size-2.5 opacity-40" />
                      </button>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[80px]">Operation</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[100px]">Resource</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[200px]">Suggestion</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[160px]">
                      <button
                        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono"
                        onClick={() => { if (sortBy === "created_at") setSortOrder(sortOrder === "asc" ? "desc" : "asc"); else { setSortBy("created_at"); setSortOrder("desc") } }}
                      >
                        Timestamp
                        <ArrowUpDown className="size-2.5 opacity-40" />
                      </button>
                    </th>
                    <th className="border-b border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono w-[70px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                      <td className="border-r border-border px-3 py-2">
                        <span className="text-foreground" title={log.query_sql}>{truncateQuery(log.query_sql)}</span>
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium tabular-nums", getDurationBg(log.duration_ms), getDurationColor(log.duration_ms))}>
                          {log.duration_ms.toLocaleString()}ms
                        </span>
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <span className="text-foreground">{log.operation}</span>
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <span className="text-muted-foreground">{log.resource || "-"}</span>
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <span className="text-muted-foreground font-sans text-xs">{log.suggestion || "-"}</span>
                      </td>
                      <td className="border-r border-border px-3 py-2">
                        <span className="text-muted-foreground whitespace-nowrap">{formatTimestamp(log.created_at)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="size-3.5 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {logs.length} of {total} log{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DataTablePagination
            total={total}
            limit={limit}
            offset={offset}
            noun="Logs"
            onPageChange={setOffset}
            onLimitChange={(n) => { setLimit(n); setOffset(0) }}
          />
        </>
      )}
    </div>
    </div>

    {/* Query Detail Sheet */}
    <Sheet open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-foreground">Query Details</span>
            {selectedLog && (
              <span className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium",
                getDurationBg(selectedLog.duration_ms),
                getDurationColor(selectedLog.duration_ms)
              )}>
                {selectedLog.duration_ms.toLocaleString()}ms
              </span>
            )}
          </SheetTitle>
        </SheetHeader>
        
        {selectedLog && (
          <div className="mt-6 flex flex-col gap-4">
            {/* Metadata */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Operation</p>
                <p className="text-sm text-foreground mt-0.5 font-mono">{selectedLog.operation}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Threshold</p>
                <p className="text-sm text-foreground mt-0.5 font-mono">{selectedLog.threshold_ms}ms</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Resource</p>
                <p className="text-sm text-foreground mt-0.5 font-mono">{selectedLog.resource || "-"}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Timestamp</p>
                <p className="text-sm text-foreground mt-0.5">{formatTimestamp(selectedLog.created_at)}</p>
              </div>
            </div>

            {/* Suggestion */}
            {selectedLog.suggestion && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Suggestion</p>
                <p className="text-sm text-foreground mt-1">{selectedLog.suggestion}</p>
              </div>
            )}

            {/* Full Query */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Full Query</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleCopyQuery}
                >
                  {copied ? (
                    <>
                      <Check className="size-3 mr-1 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-secondary/50 p-3 overflow-x-auto">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                  {selectedLog.query_sql}
                </pre>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  )
}
