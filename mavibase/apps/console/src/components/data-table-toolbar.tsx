"use client"

import { useState } from "react"
import { Search, List, LayoutGrid, Columns3, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ColumnDef {
  key: string
  label: string
  visible: boolean
  disabled?: boolean
}

interface DataTableToolbarProps {
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  columns?: ColumnDef[]
  onColumnToggle?: (key: string) => void
  viewMode?: "list" | "grid"
  onViewModeChange?: (mode: "list" | "grid") => void
  children?: React.ReactNode
}

export function DataTableToolbar({
  searchPlaceholder = "Search by name or ID",
  searchValue,
  onSearchChange,
  columns,
  onColumnToggle,
  viewMode = "list",
  onViewModeChange,
  children,
}: DataTableToolbarProps) {
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const visibleCount = columns?.filter((c) => c.visible).length ?? 0

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 bg-secondary border-border"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Column toggle */}
        {columns && onColumnToggle && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-border"
              onClick={() => setColMenuOpen(!colMenuOpen)}
            >
              <Columns3 className="size-3.5" />
              {visibleCount}
            </Button>
            {colMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setColMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-border bg-popover py-1 shadow-lg">
                  {columns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => !col.disabled && onColumnToggle(col.key)}
                      disabled={col.disabled}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm w-full transition-colors",
                        col.disabled
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : "text-foreground hover:bg-secondary"
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center size-4 rounded border transition-colors",
                          col.disabled
                            ? "border-border/50"
                            : col.visible
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border"
                        )}
                      >
                        {col.visible && !col.disabled && <Check className="size-3" />}
                      </span>
                      {col.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* View mode toggle */}
        {onViewModeChange && (
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex items-center justify-center size-8 transition-colors",
                viewMode === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <List className="size-3.5" />
            </button>
            <button
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex items-center justify-center size-8 transition-colors",
                viewMode === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
