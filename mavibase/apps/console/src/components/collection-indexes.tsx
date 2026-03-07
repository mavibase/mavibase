"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Plus,
  Trash2,
  Search,
  Loader2,
  Zap,
  Copy,
  Check,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { useToast } from "@/components/custom-toast"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "./ui/skeleton"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface IndexRecord {
  id: string
  collection_id: string
  field_name?: string
  field_names?: string[]
  index_type: string
  is_unique: boolean
  status: string
  created_at: string
}

interface Attribute {
  key: string
  type: string
  required: boolean
  array: boolean
}

/* ------------------------------------------------------------------ */
/*  Boolean indicator icons (Bootstrap Icons) - from attributes page   */
/* ------------------------------------------------------------------ */
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className={className}>
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0m-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className={className}>
      <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0M5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293z"/>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Status display with SVG icons + text                               */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === "active" || s === "available") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <CheckCircleIcon className="size-3.5 text-emerald-500" />
        <span className="text-emerald-500">{status}</span>
      </span>
    )
  }
  if (s === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <XCircleIcon className="size-3.5 text-red-500" />
        <span className="text-red-500">{status}</span>
      </span>
    )
  }
  // building / other
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
      <Loader2 className="size-3.5 text-yellow-500 animate-spin" />
      <span className="text-yellow-500">{status}</span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Unique display with SVG icons                                      */
/* ------------------------------------------------------------------ */
function UniqueCell({ value }: { value: boolean }) {
  return value ? (
    <CheckCircleIcon className="size-4 text-emerald-500" />
  ) : (
    <XCircleIcon className="size-4 text-red-500/60" />
  )
}

/* ------------------------------------------------------------------ */
/*  Truncated ID with copy button                                      */
/* ------------------------------------------------------------------ */
function TruncatedId({ id }: { id: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    toast({ message: "ID copied", type: "success" })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-1.5 group/id min-w-0">
      <span className="text-foreground truncate max-w-[140px]" title={id}>{id}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover/id:opacity-100 flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        title="Copy ID"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Create Index Sheet - with attribute selector                       */
/* ------------------------------------------------------------------ */
function CreateIndexSheet({
  open,
  onOpenChange,
  dbId,
  collectionId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  dbId: string
  collectionId: string
  onCreated: () => void
}) {
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [indexType, setIndexType] = useState("btree")
  const [isUnique, setIsUnique] = useState(false)
  const [creating, setCreating] = useState(false)
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [loadingAttrs, setLoadingAttrs] = useState(false)
  const { toast } = useToast()

  // Fetch available attributes when sheet opens
  useEffect(() => {
    if (!open) return
    setLoadingAttrs(true)
    axiosInstance.db
      .get(`/v1/db/databases/${dbId}/collections/${collectionId}/attributes`)
      .then((res) => setAttributes(res.data?.data || []))
      .catch(() => setAttributes([]))
      .finally(() => setLoadingAttrs(false))
  }, [open, dbId, collectionId])

  const toggleField = (key: string) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    )
  }

  const handleCreate = async () => {
    if (selectedFields.length === 0) {
      toast({ message: "At least one field is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionId}/indexes`,
        {
          fieldNames: selectedFields,
          indexType,
          isUnique,
        }
      )
      toast({ message: "Index created", type: "success" })
      onOpenChange(false)
      onCreated()
      setSelectedFields([])
      setIndexType("btree")
      setIsUnique(false)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to create index"
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Create index</SheetTitle>
          <SheetDescription>
            Select attributes to index for optimized queries.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
          {/* Attribute selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Attributes
            </label>
            <p className="text-xs text-muted-foreground">
              Select one or more attributes to create a composite index.
            </p>
            {loadingAttrs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : attributes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No attributes available. Create attributes first.
              </p>
            ) : (
              <div className="flex flex-col gap-1 mt-1 max-h-[200px] overflow-y-auto rounded-md border border-border">
                {attributes.map((attr) => {
                  const isSelected = selectedFields.includes(attr.key)
                  return (
                    <button
                      key={attr.key}
                      type="button"
                      onClick={() => toggleField(attr.key)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm transition-colors text-left",
                        isSelected
                          ? "bg-primary/10 text-foreground"
                          : "hover:bg-secondary/60 text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "size-4 rounded border flex items-center justify-center transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-border"
                        )}>
                          {isSelected && <Check className="size-3 text-primary-foreground" />}
                        </div>
                        <span className="font-mono text-xs">{attr.key}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                        {attr.type}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Selected fields preview */}
            {selectedFields.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedFields.map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-mono text-foreground"
                  >
                    {f}
                    <button
                      type="button"
                      onClick={() => toggleField(f)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Index type</label>
            <select
              value={indexType}
              onChange={(e) => {
                setIndexType(e.target.value)
                // Reset unique when switching to a type that doesn't support it
                if (e.target.value !== "btree") {
                  setIsUnique(false)
                }
              }}
              className="flex h-9 w-full rounded-md border border-border bg-secondary px-3 py-1 text-sm text-foreground focus:border-ring focus:ring-ring/50 focus:ring-[3px] outline-none transition-colors"
            >
              <option value="btree">B-Tree</option>
              <option value="hash">Hash</option>
              <option value="gin">GIN</option>
            </select>
          </div>

          <label className={cn(
            "flex items-center gap-3 text-sm text-foreground",
            indexType === "btree" ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          )}>
            <button
              type="button"
              role="switch"
              aria-checked={isUnique}
              onClick={() => indexType === "btree" && setIsUnique(!isUnique)}
              disabled={indexType !== "btree"}
              className={cn(
                "relative flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
                isUnique ? "bg-primary" : "bg-secondary border border-border",
                indexType !== "btree" && "opacity-50"
              )}
            >
              <span
                className={cn(
                  "absolute size-3.5 rounded-full bg-background shadow transition-transform",
                  isUnique ? "translate-x-[18px]" : "translate-x-[3px]"
                )}
              />
            </button>
            <div>
              <span className="font-medium">Unique constraint</span>
              <p className="text-xs text-muted-foreground">
                {indexType === "btree" 
                  ? "Enforce unique values for this index." 
                  : `Unique constraint is not supported for ${indexType.toUpperCase()} indexes.`}
              </p>
            </div>
          </label>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || selectedFields.length === 0}>
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Indexes content                                                    */
/* ------------------------------------------------------------------ */
export function IndexesContent() {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  const [indexes, setIndexes] = useState<IndexRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IndexRecord | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchIndexes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/indexes`
      )
      setIndexes(res.data?.data || [])
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load indexes"
      toast({ message: msg, type: "error" })
      setIndexes([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, toast])

  useEffect(() => {
    fetchIndexes()
  }, [fetchIndexes])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/indexes/${deleteTarget.id}`
      )
      toast({ message: "Index deleted", type: "error" })
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchIndexes()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete index"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  const filtered = indexes.filter(
    (idx) =>
      idx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (idx.field_names || []).some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Zap className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Indexes [ {loading ? <Skeleton className="h-3 w-4"/> : `${indexes.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View, create, and manage all indexes for this collection.
            </p>
          </div>
        </div>
      </div>

      {indexes.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search indexes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-secondary border-border"
            />
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Create index
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : indexes.length === 0 ? (
        // <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        //   <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
        //     <Zap className="size-6 text-muted-foreground" />
        //   </div>
        //   <h3 className="text-base font-semibold text-foreground">No indexes yet</h3>
        //   <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        //     Create indexes to optimize query performance.
        //   </p>
        //   <Button onClick={() => setAddOpen(true)} className="mt-5">
        //     <Plus className="size-4" />
        //     Create index
        //   </Button>
        // </div>


                  <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
        {/* Icon */}
        <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
          <Zap className="size-5" strokeWidth={1.5} />
        </div>

        {/* Copy */}
        <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
          No indexes yet
        </h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
        Create indexes to optimize query performance.
        </p>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          <Button
            onClick={() => setAddOpen(true)}>
            <Plus className="size-4" strokeWidth={2} />
            Create index
          </Button>
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
          {/* Layer 1 - outermost, lightest */}
          <path
            d="M-20 140 C60 140, 100 60, 180 80 S300 140, 400 100 S520 30, 620 60"
            stroke="currentColor"
            className="text-primary/10"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 135 C80 130, 120 50, 200 75 S320 145, 420 95 S540 25, 620 55"
            stroke="currentColor"
            className="text-primary/10"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 2 */}
          <path
            d="M-20 130 C50 120, 90 70, 170 90 S290 130, 390 85 S510 40, 620 70"
            stroke="currentColor"
            className="text-primary/15"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 125 C70 110, 110 65, 190 85 S310 135, 410 80 S530 35, 620 65"
            stroke="currentColor"
            className="text-primary/15"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 3 */}
          <path
            d="M-20 118 C40 100, 80 80, 160 95 S280 120, 380 70 S500 50, 620 80"
            stroke="currentColor"
            className="text-primary/20"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 112 C60 95, 100 75, 180 90 S300 125, 400 65 S520 45, 620 75"
            stroke="currentColor"
            className="text-primary/20"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 4 - inner, stronger */}
          <path
            d="M-20 105 C30 85, 70 90, 150 100 S270 110, 370 55 S490 60, 620 85"
            stroke="currentColor"
            className="text-primary/25"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 100 C50 78, 90 85, 170 95 S290 115, 390 50 S510 55, 620 80"
            stroke="currentColor"
            className="text-primary/25"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Layer 5 - innermost, most visible */}
          <path
            d="M-20 92 C20 70, 60 95, 140 105 S260 100, 360 42 S480 65, 620 90"
            stroke="currentColor"
            className="text-primary/30"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M-20 86 C40 65, 80 100, 160 108 S280 95, 380 38 S500 60, 620 85"
            stroke="currentColor"
            className="text-primary/30"
            strokeWidth="1.2"
            fill="none"
          />

          {/* Accent lines with slight color variation */}
          <path
            d="M-20 148 C90 150, 130 50, 210 70 S340 148, 440 108 S560 20, 620 50"
            stroke="currentColor"
            className="text-chart-1/8"
            strokeWidth="1"
            fill="none"
          />
          <path
            d="M-20 80 C10 55, 50 100, 130 110 S250 90, 350 35 S470 70, 620 95"
            stroke="currentColor"
            className="text-chart-2/8"
            strokeWidth="1"
            fill="none"
          />
        </svg>
      </div>
    </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-card">
                  <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                    <span className="text-[11px] text-muted-foreground">#</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[180px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">ID</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[90px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Type</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[160px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Fields</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[70px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Unique</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[110px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Status</span>
                  </th>
                  <th className="border-b border-border w-[48px] min-w-[48px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-sm text-muted-foreground font-sans">
                      {searchQuery.trim() ? "No indexes match your search." : "No indexes yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((idx, i) => {
                    const fields = idx.field_names || (idx.field_name ? [idx.field_name] : [])
                    return (
                      <tr key={idx.id} className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                        <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{i + 1}</span>
                        </td>
                        <td className="border-r border-border px-3 py-1.5 min-w-[180px]">
                          <div className="flex items-center gap-2">
                            <Zap className="size-3.5 text-muted-foreground shrink-0" />
                            <TruncatedId id={idx.id} />
                          </div>
                        </td>
                        <td className="border-r border-border px-3 py-1.5 min-w-[90px]">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-secondary text-muted-foreground">
                            {idx.index_type}
                          </span>
                        </td>
                        <td className="border-r border-border px-3 py-1.5 min-w-[160px]">
                          <div className="flex flex-wrap gap-1">
                            {fields.map((f) => (
                              <span key={f} className="inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">
                                {f}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="border-r border-border px-3 py-1.5 min-w-[70px]">
                          <UniqueCell value={idx.is_unique} />
                        </td>
                        <td className="border-r border-border px-3 py-1.5 min-w-[110px]">
                          <StatusBadge status={idx.status} />
                        </td>
                        <td className="px-1 py-1">
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => { setDeleteTarget(idx); setDeleteOpen(true) }}
                              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete index"
                            >
                              <Trash2 className="size-3" />
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
          <div className="px-4 py-2 border-t border-border bg-card/50">
            <p className="text-xs text-muted-foreground">
              {filtered.length} of {indexes.length} index{indexes.length !== 1 ? "es" : ""}
            </p>
          </div>
        </div>
      )}

      <CreateIndexSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        dbId={dbId}
        collectionId={collectionSlug}
        onCreated={fetchIndexes}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete index</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete index{" "}
              <span className="font-mono font-semibold text-foreground">{deleteTarget?.id}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
