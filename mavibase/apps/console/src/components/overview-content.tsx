"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Database,
  Key,
  HardDrive,
  Zap,
  Radio,
  FileText,
  RefreshCw,
  Lock,
  BarChart2,
  LayoutDashboard,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { cn } from "@/lib/utils"
import { useProjectContext } from "@/contexts/project-context"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "@/components/ui/skeleton"

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
type Range = "2d" | "7d" | "30d" | "12m"

interface UsageStats {
  databases: number
  collections: number
  documents: number
  storage_bytes: number
  api_keys: number
}

interface TimeSeriesPoint {
  label: string
  operations: number
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/* ------------------------------------------------------------------ */
/*  Range selector                                                      */
/* ------------------------------------------------------------------ */
const RANGES: { value: Range; label: string }[] = [
  { value: "2d",  label: "2d"  },
  { value: "7d",  label: "7d"  },
  { value: "30d", label: "30d" },
  { value: "12m", label: "12m" },
]

function RangeSelector({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-secondary p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            value === r.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                           */
/* ------------------------------------------------------------------ */
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  loading: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="size-7 rounded-md bg-secondary flex items-center justify-center">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-7 w-20" />
      ) : (
        <div>
          <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Custom tooltip                                                      */
/* ------------------------------------------------------------------ */
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="font-medium text-foreground">{formatNumber(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty chart state                                                   */
/* ------------------------------------------------------------------ */
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
      <BarChart2 className="size-8" />
      <p className="text-xs text-center max-w-[200px]">{message}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Coming soon card                                                    */
/* ------------------------------------------------------------------ */
function ComingSoonCard({
  icon: Icon,
  label,
  description,
}: {
  icon: React.ElementType
  label: string
  description: string
}) {
  return (
    <div className="relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 overflow-hidden select-none">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)",
          backgroundSize: "8px 8px",
        }}
      />
      <div className="flex items-center justify-between relative">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-secondary flex items-center justify-center">
            <Icon className="size-4 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-muted-foreground/60 relative leading-relaxed">{description}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */
export function OverviewContent() {
  const { project } = useProjectContext()
  const [range, setRange] = useState<Range>("7d")
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [timeSeries, setTimeSeries] = useState<TimeSeriesPoint[]>([])
  const [loadingUsage, setLoadingUsage] = useState(true)
  const [loadingChart, setLoadingChart] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchUsage = useCallback(async (projectId: string) => {
    try {
      const [usageRes, statsRes] = await Promise.all([
        axiosInstance.auth.get(`/projects/${projectId}/usage`),
        axiosInstance.auth.get(`/projects/${projectId}/stats`),
      ])
      const u = usageRes.data?.data?.usage || {}
      const s = statsRes.data?.data?.stats || {}
      setUsage({
        databases:    Number(u.databases?.value   ?? s.databases_count   ?? 0),
        collections:  Number(u.collections?.value ?? s.collections_count ?? 0),
        documents:    Number(u.documents?.value   ?? s.documents_count   ?? 0),
        storage_bytes: Number(u.storage_bytes?.value ?? 0),
        api_keys:     Number(s.api_keys_count ?? 0),
      })
    } catch {
      setUsage({ databases: 0, collections: 0, documents: 0, storage_bytes: 0, api_keys: 0 })
    } finally {
      setLoadingUsage(false)
    }
  }, [])

  const fetchTimeSeries = useCallback(async (projectId: string, r: Range) => {
    setLoadingChart(true)
    try {
      const res = await axiosInstance.auth.get(`/projects/${projectId}/time-series?range=${r}`)
      setTimeSeries(res.data?.data?.timeSeries ?? [])
    } catch {
      setTimeSeries([])
    } finally {
      setLoadingChart(false)
    }
  }, [])

  useEffect(() => {
    if (!project?.id) return
    setLoadingUsage(true)
    fetchUsage(project.id)
  }, [project?.id, fetchUsage])

  useEffect(() => {
    if (!project?.id) return
    fetchTimeSeries(project.id, range)
  }, [project?.id, range, fetchTimeSeries])

  const handleRefresh = async () => {
    if (!project?.id || refreshing) return
    setRefreshing(true)
    await Promise.all([fetchUsage(project.id), fetchTimeSeries(project.id, range)])
    setRefreshing(false)
  }

  if (!project) return null

  const envColor =
    project.environment === "production"
      ? "text-green-600 bg-green-500/10 border-green-500/20"
      : project.environment === "staging"
      ? "text-amber-600 bg-amber-500/10 border-amber-500/20"
      : "text-primary bg-primary/10 border-primary/20"

  const hasChartData = timeSeries.length > 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <LayoutDashboard className="size-5 text-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-foreground leading-tight">
                {project.name}
              </h1>
              {project.environment && (
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border", envColor)}>
                  {project.environment}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Project overview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} />
            Refresh
          </button>
          <RangeSelector value={range} onChange={setRange} />
        </div>
      </div>





      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Databases"   value={formatNumber(usage?.databases ?? 0)}    icon={Database}  loading={loadingUsage} />
        <StatCard label="Collections" value={formatNumber(usage?.collections ?? 0)}  icon={FileText}  loading={loadingUsage} />
        <StatCard label="Documents"   value={formatNumber(usage?.documents ?? 0)}    icon={FileText}  loading={loadingUsage} />
        <StatCard
          label="Storage Used"
          value={formatBytes(usage?.storage_bytes ?? 0)}
          icon={HardDrive}
          loading={loadingUsage}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Database operations */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Database Operations</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total operations over time
            </p>
          </div>
          {loadingChart ? (
            <div className="h-[180px] flex flex-col gap-2 justify-end">
              {[40, 65, 50, 80, 55, 70, 45].map((h, i) => (
                <Skeleton key={i} className="w-full rounded" style={{ height: `${h}%` }} />
              ))}
            </div>
          ) : hasChartData ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={timeSeries} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-ops" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false} tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false} tickLine={false}
                  tickFormatter={formatNumber}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="operations"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#grad-ops)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No operations recorded yet for this range. Start using your database to see data here." />
          )}
        </div>

        {/* API Requests — not yet tracked */}
        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">API Requests & Egress</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Incoming requests and bandwidth consumed
              </p>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-secondary text-muted-foreground">
              Coming soon
            </span>
          </div>
          <EmptyChart message="Per-request logging and egress tracking will be available in a future release." />
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total Requests</p>
              <p className="text-sm font-semibold text-muted-foreground/50">—</p>
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Egress</p>
              <p className="text-sm font-semibold text-muted-foreground/50">—</p>
            </div>
          </div>
        </div>

      </div>

      {/* Services */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">Services</h2>
          <span className="text-xs text-muted-foreground">Active and upcoming project services</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Database — live */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <Database className="size-4 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Database</p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-green-500/20 bg-green-500/10 text-green-600">
                <span className="size-1.5 rounded-full bg-green-500" />
                Live
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Flexible document storage with collections, schemas, relationships, indexes, and permissions.
            </p>
            <div className="flex items-center gap-4 pt-1 border-t border-border text-xs text-muted-foreground">
              {loadingUsage ? (
                <Skeleton className="h-3 w-24" />
              ) : (
                <>
                  <span>{formatNumber(usage?.databases ?? 0)} db{(usage?.databases ?? 0) !== 1 ? "s" : ""}</span>
                  <span>{formatNumber(usage?.documents ?? 0)} docs</span>
                  <span>{formatBytes(usage?.storage_bytes ?? 0)}</span>
                </>
              )}
            </div>
          </div>

          <ComingSoonCard
            icon={Key}
            label="Authentication"
            description="User accounts, sessions, JWT tokens, MFA, social OAuth, and role-based access control."
          />
          <ComingSoonCard
            icon={HardDrive}
            label="Storage"
            description="File uploads, buckets, access policies, image transformations, and CDN delivery."
          />
          <ComingSoonCard
            icon={Zap}
            label="Edge Functions"
            description="Deploy serverless functions at the edge with low latency and global distribution."
          />
          <ComingSoonCard
            icon={Radio}
            label="Realtime"
            description="Subscribe to database changes, broadcast events, and build collaborative experiences."
          />
          <ComingSoonCard
            icon={Lock}
            label="Secrets"
            description="Manage environment variables and secrets securely across your project services."
          />
        </div>
      </div>
    </div>
  )
}
