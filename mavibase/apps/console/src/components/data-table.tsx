"use client"

import { useState, type ReactNode } from "react"
import { ArrowUpDown, Copy, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/custom-toast"
import { DataTablePagination } from "@/components/data-table-pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
export interface DataTableColumn<T> {
  /** Unique key for this column */
  key: string
  /** Header label */
  label: string
  /** Whether this column is currently visible */
  visible: boolean
  /** Minimum width CSS class / value */
  minWidth?: string
  /** Maximum width CSS class / value */
  maxWidth?: string
  /** Render cell content. Falls back to `row[key]` if omitted */
  render?: (row: T, index: number) => ReactNode
  /** If true, column header sticks to the left (like the $id column) */
  sticky?: boolean
  /** Sticky offset (e.g. "left-12"), required when sticky is true */
  stickyClass?: string
}

export interface DataTableAction<T> {
  label: string
  icon?: ReactNode
  onClick: (row: T) => void
  /** If true, renders with destructive styling */
  destructive?: boolean
  /** If true, a separator is rendered before this item */
  separator?: boolean
}

interface DataTableProps<T> {
  /** Array of data rows */
  data: T[]
  /** Column definitions */
  columns: DataTableColumn<T>[]
  /** Row actions in the sticky-right dropdown menu */
  actions?: DataTableAction<T>[] | ((row: T) => DataTableAction<T>[])
  /** Unique key extractor for each row */
  getRowId: (row: T) => string
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void
  /** Whether rows are selectable with checkboxes */
  selectable?: boolean
  /** Currently selected row IDs (controlled) */
  selectedIds?: Set<string>
  /** Toggle selection callback */
  onToggleSelect?: (id: string) => void
  /** Toggle all callback */
  onToggleAll?: () => void
  /** Sortable columns. If true, all columns are sortable. */
  sortable?: boolean
  /** Copy ID button on a specific column key (e.g. "id") */
  copyableKey?: string
  /** Pagination */
  total: number
  limit: number
  offset: number
  noun?: string
  onPageChange: (newOffset: number) => void
  onLimitChange: (newLimit: number) => void
  /** Empty state message */
  emptyMessage?: string
}

/* ------------------------------------------------------------------ */
/*  Format helpers                                                     */
/* ------------------------------------------------------------------ */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHr = Math.floor(diffMin / 60)
    const diffDay = Math.floor(diffHr / 24)

    if (diffSec < 60) return "Just now"
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHr < 24) return `${diffHr}h ago`
    if (diffDay < 7) return `${diffDay}d ago`

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export { formatDate as dataTableFormatDate }

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  actions,
  getRowId,
  onRowClick,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onToggleAll,
  sortable = false,
  copyableKey,
  total,
  limit,
  offset,
  noun = "items",
  onPageChange,
  onLimitChange,
  emptyMessage = "No results found.",
}: DataTableProps<T>) {
  const { toast } = useToast()
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const visibleCols = columns.filter((c) => c.visible)

  // Sort data
  const sorted = sortable && sortBy
    ? [...data].sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        return sortDir === "asc" ? cmp : -cmp
      })
    : data

  const handleCopyId = (e: React.MouseEvent, value: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(value)
    toast({ message: "Copied to clipboard", type: "success" })
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-card">
              {/* Row number / checkbox header */}
              {selectable && (
                <th className="sticky left-0 z-10 bg-card w-12 min-w-12 border-b border-r border-border px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && (selectedIds?.size ?? 0) === data.length}
                    onChange={onToggleAll}
                    className="size-3.5 rounded border-border accent-primary cursor-pointer"
                  />
                </th>
              )}
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-b border-r border-border px-3 py-1.5 text-left last:border-r-0",
                    col.sticky && col.stickyClass && `sticky ${col.stickyClass} z-10 bg-card`,
                    col.minWidth ?? "min-w-[120px]",
                    col.maxWidth
                  )}
                >
                  {sortable ? (
                    <button
                      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors font-mono"
                      onClick={() => {
                        if (sortBy === col.key)
                          setSortDir(sortDir === "asc" ? "desc" : "asc")
                        else {
                          setSortBy(col.key)
                          setSortDir("asc")
                        }
                      }}
                    >
                      {col.label}
                      <ArrowUpDown className="size-2.5 opacity-40" />
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground font-mono">
                      {col.label}
                    </span>
                  )}
                </th>
              ))}
              {/* Actions header */}
              {actions && (
                <th className="sticky right-0 z-10 bg-card border-b border-l border-border w-[48px] min-w-[48px] px-1 py-1.5" />
              )}
            </tr>
          </thead>
          <tbody className="text-xs font-mono">
            {sorted.length > 0 ? (
              sorted.map((row, idx) => {
                const rowId = getRowId(row)
                const rowNum = offset + idx + 1
                const selected = selectedIds?.has(rowId) ?? false
                const rowActions = typeof actions === "function" ? actions(row) : actions

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "group border-b border-border last:border-b-0 transition-colors",
                      "hover:bg-secondary/40",
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {/* Row number / checkbox */}
                    {selectable && (
                      <td className="sticky left-0 z-10 w-12 min-w-12 border-r border-border px-2 py-1.5 text-center bg-background group-hover:bg-secondary/40">
                        <span
                          className={cn(
                            "text-[11px] text-muted-foreground tabular-nums",
                            selected ? "hidden" : "group-hover:hidden"
                          )}
                        >
                          {rowNum}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            e.stopPropagation()
                            onToggleSelect?.(rowId)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className={cn(
                            "size-3.5 rounded border-border accent-primary cursor-pointer",
                            selected ? "inline" : "hidden group-hover:inline"
                          )}
                        />
                      </td>
                    )}

                    {visibleCols.map((col) => {
                      const value = row[col.key]
                      const isCopyable = col.key === copyableKey

                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "border-r border-border last:border-r-0 px-3 py-1.5",
                            col.sticky && col.stickyClass && `sticky ${col.stickyClass} z-10 bg-background group-hover:bg-secondary/40`,
                            col.minWidth ?? "min-w-[120px]",
                            col.maxWidth
                          )}
                        >
                          {col.render ? (
                            col.render(row, idx)
                          ) : isCopyable ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="text-foreground truncate max-w-[160px]"
                                title={String(value ?? "")}
                              >
                                {String(value ?? "")}
                              </span>
                              <button
                                onClick={(e) => handleCopyId(e, String(value ?? ""))}
                                className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-foreground truncate block max-w-[220px]">
                              {value == null ? "" : String(value)}
                            </span>
                          )}
                        </td>
                      )
                    })}

                    {/* Row actions - sticky right */}
                    {rowActions && rowActions.length > 0 && (
                      <td
                        className="sticky right-0 z-10 border-l border-border px-1 py-1 bg-background group-hover:bg-secondary/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                <MoreHorizontal className="size-4" />
                                <span className="sr-only">Actions</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              {rowActions.map((action, i) => (
                                <span key={i}>
                                  {action.separator && <DropdownMenuSeparator />}
                                  <DropdownMenuItem
                                    className={cn(
                                      action.destructive &&
                                        "text-destructive focus:text-destructive"
                                    )}
                                    onClick={() => action.onClick(row)}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </DropdownMenuItem>
                                </span>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Empty state - outside scroll container */}
      {sorted.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground border-t border-border font-sans">
          {emptyMessage}
        </div>
      )}

      {/* Pagination */}
      <DataTablePagination
        total={total}
        limit={limit}
        offset={offset}
        noun={noun}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />
    </div>
  )
}
