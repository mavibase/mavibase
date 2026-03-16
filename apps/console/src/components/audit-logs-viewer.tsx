"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { dataTableFormatDate } from "@/components/data-table"
import { Input } from "@/components/ui/input"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type AuditScope = "user" | "team" | "project" | "database" | "collection" | "document" | "system"

export interface AuditLogRow {
  id: string
  scope: AuditScope
  actorId: string | null
  targetId: string | null
  action: string
  metadata: Record<string, any>
  timestamp: string
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "0 B"
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

export function AuditLogsViewer({
  defaultScope,
  defaultTargetId,
  projectId,
  teamId,
}: {
  defaultScope: AuditScope
  defaultTargetId?: string
  projectId?: string
  teamId?: string
}) {
  const [scope, setScope] = useState<AuditScope>(defaultScope)
  const [targetId, setTargetId] = useState<string>(defaultTargetId || "")
  const [actorId, setActorId] = useState<string>("")
  const [action, setAction] = useState<string>("")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")

  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState<number>(0)
  const [limit, setLimit] = useState<number>(50)
  const [offset, setOffset] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [retention, setRetention] = useState<{ retentionDays: number; userMax: number } | null>(null)

  const scopeOptions = useMemo(
    () => [
      { value: "project", label: "Project" },
      { value: "team", label: "Team" },
      { value: "database", label: "Database" },
      { value: "collection", label: "Collection" },
      { value: "document", label: "Document" },
      { value: "system", label: "System/Security" },
      { value: "user", label: "User" },
    ] as const,
    []
  )

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("scope", scope)
      params.set("limit", String(limit))
      params.set("offset", String(offset))
      if (targetId.trim()) params.set("targetId", targetId.trim())
      if (actorId.trim()) params.set("actorId", actorId.trim())
      if (action.trim()) params.set("action", action.trim())
      if (from.trim()) params.set("from", from.trim())
      if (to.trim()) params.set("to", to.trim())

      const res = await axiosInstance.auth.get(`/audit-logs?${params.toString()}`, {
        headers: {
          ...(projectId ? { "X-Project-Id": projectId } : {}),
          ...(teamId ? { "X-Team-Id": teamId } : {}),
        },
      })

      const data = res.data?.data
      setRows(data?.logs ?? [])
      setTotal(Number(data?.total ?? 0))
      setRetention({
        retentionDays: Number(data?.retention?.retentionDays ?? 30),
        userMax: Number(data?.retention?.userMax ?? 50),
      })
    } catch {
      setRows([])
      setTotal(0)
      setRetention(null)
    } finally {
      setLoading(false)
    }
  }, [scope, limit, offset, targetId, actorId, action, from, to, projectId, teamId])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  // Reset pagination when the query shape changes
  useEffect(() => {
    setOffset(0)
  }, [scope, targetId, actorId, action, from, to])

  const columns: DataTableColumn<AuditLogRow>[] = useMemo(
    () => [
      {
        key: "timestamp",
        label: "Time",
        visible: true,
        minWidth: "min-w-[140px]",
        render: (r) => <span title={r.timestamp}>{dataTableFormatDate(r.timestamp)}</span>,
      },
      {
        key: "actorType",
        label: "Type",
        visible: true,
        minWidth: "min-w-[90px]",
        render: (r) => {
          const t = (r.metadata?.actorType || "SYSTEM") as string
          return (
            <Badge className={cn("text-[10px] font-semibold", t === "USER" ? "bg-primary/10 text-primary border-primary/20" : "")}>
              {t}
            </Badge>
          )
        },
      },
      { key: "action", label: "Action", visible: true, minWidth: "min-w-[200px]" },
      {
        key: "message",
        label: "Message",
        visible: true,
        minWidth: "min-w-[320px]",
        render: (r) => (
          <span className="text-foreground truncate block max-w-[520px]" title={r.metadata?.message || ""}>
            {r.metadata?.message || ""}
          </span>
        ),
      },
      { key: "actorId", label: "Actor", visible: true, minWidth: "min-w-[220px]" },
      { key: "targetId", label: "Target", visible: true, minWidth: "min-w-[220px]" },
    ],
    []
  )

  const retentionText = retention
    ? `Retention: non-user logs are hard-deleted after ${retention.retentionDays} days. User logs rotate at ${retention.userMax} entries per user.`
    : "Retention: unavailable"

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground">Audit Logs</p>
            <p className="text-xs text-muted-foreground mt-0.5">{retentionText}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              value={scope}
              onChange={(v) => setScope(v as AuditScope)}
              options={scopeOptions as any}
            />
            <div className="text-xs text-muted-foreground">
              {loading ? "Loading…" : `${total.toLocaleString()} logs`}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Target ID (optional)" />
            <Input value={actorId} onChange={(e) => setActorId(e.target.value)} placeholder="Actor ID (optional)" />
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action (exact match)" />
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From (ISO date) e.g. 2026-03-01" />
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="To (ISO date) e.g. 2026-03-16" />
          </div>

          <div className="text-[11px] text-muted-foreground">
            Tips: For project-scoped scopes (database/collection/document/system), this view is constrained to the current project context.
          </div>
        </div>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        total={total}
        limit={limit}
        offset={offset}
        noun="logs"
        onPageChange={setOffset}
        onLimitChange={(n) => {
          setLimit(n)
          setOffset(0)
        }}
        emptyMessage="No audit logs found for these filters."
      />
    </div>
  )
}

