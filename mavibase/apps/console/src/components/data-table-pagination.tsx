"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DataTablePaginationProps {
  total: number
  limit: number
  offset: number
  noun?: string
  onPageChange: (newOffset: number) => void
  onLimitChange: (newLimit: number) => void
}

const PAGE_SIZES = [6, 10, 25, 50]

export function DataTablePagination({
  total,
  limit,
  offset,
  noun = "items",
  onPageChange,
  onLimitChange,
}: DataTablePaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border">
      {/* Left: page size + total */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <select
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="flex h-8 rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>
          {noun} per page. Total: {total}
        </span>
      </div>

      {/* Right: prev / page / next */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={!canPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="h-8 gap-1 text-muted-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Prev
        </Button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let pageNum: number
          if (totalPages <= 5) {
            pageNum = i + 1
          } else if (currentPage <= 3) {
            pageNum = i + 1
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i
          } else {
            pageNum = currentPage - 2 + i
          }
          return (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange((pageNum - 1) * limit)}
            >
              {pageNum}
            </Button>
          )
        })}

        <Button
          variant="ghost"
          size="sm"
          disabled={!canNext}
          onClick={() => onPageChange(offset + limit)}
          className="h-8 gap-1 text-muted-foreground"
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
