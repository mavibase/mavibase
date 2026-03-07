"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Loader2,
  Eye,
  Pencil,
  Trash,
  Plus,
  FileKey,
  ArrowUpDown,
  Search,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { useToast } from "@/components/custom-toast"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "./ui/skeleton"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
const ACTIONS = ["read", "create", "update", "delete"] as const
type Action = (typeof ACTIONS)[number]

const ACTION_META: Record<Action, { icon: React.ElementType; label: string; color: string }> = {
  read:   { icon: Eye,     label: "Read",   color: "text-blue-400" },
  create: { icon: Plus,    label: "Create", color: "text-emerald-400" },
  update: { icon: Pencil,  label: "Update", color: "text-amber-400" },
  delete: { icon: Trash,   label: "Delete", color: "text-red-400" },
}

interface DocPermission {
  documentId: string
  action: Action
  target: string
  source: "document" | "collection"
}

interface RawDocument {
  $id: string
  $collection_id: string
  $permissions: Record<string, string[]>
  [key: string]: unknown
}

/* ------------------------------------------------------------------ */
/*  Target badge                                                       */
/* ------------------------------------------------------------------ */
function TargetBadgeDisplay({ target }: { target: string }) {
  let variant = "bg-secondary text-muted-foreground border-border"
  if (target === "any") variant = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  else if (target === "owner") variant = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
  else if (target === "none") variant = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
  else if (target.startsWith("role:")) variant = "bg-primary/10 text-primary border-primary/20"
  else if (target.startsWith("user:")) variant = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  else if (target.startsWith("team:")) variant = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border", variant)}>
      {target}
    </span>
  )
}

function SourceBadge({ source }: { source: "document" | "collection" }) {
  return source === "document" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
      <FileKey className="size-2.5" />
      Document
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-secondary text-muted-foreground border-border">
      Inherited
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Sheet                                                       */
/* ------------------------------------------------------------------ */
function DocPermissionDetailSheet({
  open,
  onOpenChange,
  row,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  row: DocPermission | null
}) {
  if (!row) return null

  const meta = ACTION_META[row.action]
  const Icon = meta.icon

  const detailRows = [
    { label: "Document ID", value: <span className="font-mono text-foreground text-xs">{row.documentId}</span> },
    {
      label: "Action",
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Icon className={cn("size-3.5", meta.color)} />
          <span className="text-foreground">{meta.label}</span>
        </span>
      ),
    },
    { label: "Target", value: <TargetBadgeDisplay target={row.target} /> },
    { label: "Source", value: <SourceBadge source={row.source} /> },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground flex items-center gap-2">
            <FileKey className="size-4 text-muted-foreground" />
            Document Permission
          </SheetTitle>
          <SheetDescription>Permission rule details for this document.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col px-6 py-4 flex-1 overflow-y-auto">
          <div className="rounded-lg border border-border overflow-hidden">
            {detailRows.map((r, i) => (
              <div
                key={r.label}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5",
                  i !== detailRows.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-xs font-medium text-muted-foreground">{r.label}</span>
                <div className="text-sm">{r.value}</div>
              </div>
            ))}
          </div>

          {row.source === "collection" && (
            <div className="mt-4 rounded-lg bg-secondary/50 border border-border p-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This permission is inherited from the collection-level rules. To override it, set{" "}
                <code className="text-[10px] px-1 py-0.5 rounded bg-secondary text-foreground font-mono">$permissions</code>{" "}
                on the document via the API.
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export function DocumentPermissionsContent() {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const [rows, setRows] = useState<DocPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [detailRow, setDetailRow] = useState<DocPermission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [sortBy, setSortBy] = useState<string>("documentId")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [totalDocs, setTotalDocs] = useState(0)
  const [docsWithCustomPerms, setDocsWithCustomPerms] = useState(0)

  // Column visibility
  const columnDefs = [
    { key: "documentId", label: "Document ID", visible: true },
    { key: "action", label: "Action", visible: true },
    { key: "target", label: "Target", visible: true },
    { key: "source", label: "Source", visible: true },
  ]
  const [columns, setColumns] = useState(columnDefs)
  const visibleCols = columns.filter((c) => c.visible)

  const handleColumnToggle = (colKey: string) => {
    if (colKey === "documentId") return
    setColumns((prev) =>
      prev.map((c) => (c.key === colKey ? { ...c, visible: !c.visible } : c))
    )
  }

  /* ---- Fetch documents + collection permissions ---- */
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch collection for fallback permission_rules
      const [collRes, docsRes] = await Promise.all([
        axiosInstance.db.get(`/v1/db/databases/${dbId}/collections/${collectionSlug}`),
        axiosInstance.db.get(`/v1/db/databases/${dbId}/collections/${collectionSlug}/documents?limit=100`),
      ])

      const collection = collRes.data?.data
      const collPermissions: Record<string, string[]> = collection?.permission_rules || {}
      const documents: RawDocument[] = docsRes.data?.data || []

      setTotalDocs(documents.length)

      const permRows: DocPermission[] = []
      let customCount = 0

      for (const doc of documents) {
        const docPerms = doc.$permissions || {}
        // Check if doc has its own custom permissions (not just inherited)
        const hasCustom = Object.keys(docPerms).some(key => {
          const collTargets = collPermissions[key] || []
          const docTargets = docPerms[key] || []
          return JSON.stringify(docTargets) !== JSON.stringify(collTargets)
        })

        if (hasCustom) customCount++

        for (const action of ACTIONS) {
          const targets = docPerms[action] || []
          const collTargets = collPermissions[action] || []
          for (const target of targets) {
            const t = typeof target === "string" ? target : (target as any)?.role || JSON.stringify(target)
            const isFromCollection = collTargets.includes(t) && !hasCustom
            permRows.push({
              documentId: doc.$id,
              action,
              target: t,
              source: isFromCollection ? "collection" : "document",
            })
          }
        }
      }

      setDocsWithCustomPerms(customCount)
      setRows(permRows)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load document permissions"
      toast({ message: msg, type: "error" })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, toast])

  useEffect(() => { fetchData() }, [fetchData])

  /* ---- Search + sort ---- */
  const filteredAndSorted = (() => {
    let result = rows

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (r) =>
          r.documentId.toLowerCase().includes(q) ||
          r.action.toLowerCase().includes(q) ||
          r.target.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q)
      )
    }

    result = [...result].sort((a, b) => {
      let aVal: string
      let bVal: string
      if (sortBy === "documentId") { aVal = a.documentId; bVal = b.documentId }
      else if (sortBy === "action") { aVal = a.action; bVal = b.action }
      else if (sortBy === "target") { aVal = a.target; bVal = b.target }
      else if (sortBy === "source") { aVal = a.source; bVal = b.source }
      else { aVal = a.documentId; bVal = b.documentId }

      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  })()

  const getCellValue = (row: DocPermission, colKey: string) => {
    switch (colKey) {
      case "documentId": return null // handled separately
      case "action": {
        const meta = ACTION_META[row.action]
        const Icon = meta.icon
        return (
          <div className="flex items-center gap-1.5">
            <Icon className={cn("size-3.5", meta.color)} />
            <span>{meta.label}</span>
          </div>
        )
      }
      case "target":
        return <TargetBadgeDisplay target={row.target} />
      case "source":
        return <SourceBadge source={row.source} />
      default:
        return <span className="text-muted-foreground/40">-</span>
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <FileKey className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Document Permissions [ {loading ? <Skeleton className="h-3 w-4"/> : `${rows.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View per-document permission rules across all documents in this collection.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : rows.length === 0 && !searchQuery.trim() ? (
        <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
            <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
              <FileKey className="size-5" strokeWidth={1.5} />
            </div>
            <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
              No document permissions found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
              No documents in this collection have permission rules configured. Documents will inherit the collection-level permissions.
            </p>
            <div className="mt-6 rounded-lg bg-secondary/50 border border-border px-4 py-3 text-left max-w-sm">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Set via API</p>
              <pre className="text-[11px] font-mono text-foreground leading-relaxed whitespace-pre-wrap break-all">
{`{
  "$permissions": {
    "read": ["any"],
    "update": ["owner"],
    "delete": ["owner"]
  }
}`}
              </pre>
            </div>
          </div>

          {/* Decorative wave lines */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <svg
              viewBox="0 0 600 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              preserveAspectRatio="none"
            >
              <path d="M-20 140 C60 140, 100 60, 180 80 S300 140, 400 100 S520 30, 620 60" stroke="currentColor" className="text-primary/10" strokeWidth="1.5" fill="none" />
              <path d="M-20 130 C50 120, 90 70, 170 90 S290 130, 390 85 S510 40, 620 70" stroke="currentColor" className="text-primary/15" strokeWidth="1.5" fill="none" />
              <path d="M-20 118 C40 100, 80 80, 160 95 S280 120, 380 70 S500 50, 620 80" stroke="currentColor" className="text-primary/20" strokeWidth="1.5" fill="none" />
              <path d="M-20 105 C30 85, 70 90, 150 100 S270 110, 370 55 S490 60, 620 85" stroke="currentColor" className="text-primary/25" strokeWidth="1.5" fill="none" />
              <path d="M-20 92 C20 70, 60 95, 140 105 S260 100, 360 42 S480 65, 620 90" stroke="currentColor" className="text-primary/30" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <DataTableToolbar
            searchPlaceholder="Search by document ID, action, or target..."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            columns={columns}
            onColumnToggle={handleColumnToggle}
          />

          {/* Summary stats */}
          <div className="flex items-center gap-4 flex-wrap px-4 py-2.5 bg-card rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <FileKey className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{totalDocs}</span> document{totalDocs !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{docsWithCustomPerms}</span> with custom permissions
            </span>
            <div className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{rows.length}</span> total rule{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* PostgreSQL-style grid table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    {visibleCols.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          "border-b border-r border-border px-3 py-1.5 text-left last:border-r-0",
                          col.key === "documentId" && "min-w-[220px]",
                          col.key === "action" && "min-w-[120px]",
                          col.key === "target" && "min-w-[180px]",
                          col.key === "source" && "min-w-[120px]"
                        )}
                      >
                        <button
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono"
                          onClick={() => {
                            if (sortBy === col.key) setSortDir(sortDir === "asc" ? "desc" : "asc")
                            else { setSortBy(col.key); setSortDir("asc") }
                          }}
                        >
                          {col.label}
                          <ArrowUpDown className="size-2.5 opacity-40" />
                        </button>
                      </th>
                    ))}
                    {/* Actions header */}
                    <th className="border-b border-border w-[48px] min-w-[48px] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {filteredAndSorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleCols.length + 2}
                        className="text-center py-16 text-sm text-muted-foreground font-sans"
                      >
                        {searchQuery.trim() ? "No document permissions match your search." : "No document permissions found."}
                      </td>
                    </tr>
                  ) : (
                    filteredAndSorted.map((row, idx) => {
                      const rowNum = idx + 1
                      return (
                        <tr
                          key={`${row.documentId}-${row.action}-${row.target}`}
                          className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors"
                        >
                          <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                            <span className="text-[11px] text-muted-foreground tabular-nums">{rowNum}</span>
                          </td>

                          {visibleCols.map((col) => {
                            if (col.key === "documentId") {
                              return (
                                <td key={col.key} className="border-r border-border px-3 py-1.5 min-w-[220px]">
                                  <div className="flex items-center gap-2">
                                    <FileKey className="size-3.5 shrink-0 text-muted-foreground" />
                                    <span className="text-foreground font-medium truncate max-w-[180px]" title={row.documentId}>
                                      {row.documentId.length > 20 ? `${row.documentId.slice(0, 8)}...${row.documentId.slice(-8)}` : row.documentId}
                                    </span>
                                  </div>
                                </td>
                              )
                            }
                            return (
                              <td
                                key={col.key}
                                className="border-r border-border last:border-r-0 px-3 py-1.5 text-foreground"
                              >
                                {getCellValue(row, col.key)}
                              </td>
                            )
                          })}

                          {/* Actions */}
                          <td className="px-1 py-1">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => { setDetailRow(row); setDetailOpen(true) }}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="View details"
                              >
                                <Eye className="size-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {filteredAndSorted.length} of {rows.length} permission rule{rows.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Detail Sheet */}
      <DocPermissionDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        row={detailRow}
      />
    </div>
  )
}
