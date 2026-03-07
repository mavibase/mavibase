"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Copy,
  Table2,
  Trash2,
  ExternalLink,
  ArrowUpDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import axiosInstance from "@/lib/axios-instance"
import {
  setCollectionsForDb,
  clearCollectionsCache,
} from "@/components/dashboard-sidebar"
import { CreateCollectionDialog } from "@/components/create-collection-dialog"
import { FileJson } from "lucide-react"
import { useToast } from "@/components/custom-toast"
import { DataTablePagination } from "@/components/data-table-pagination"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { DatabaseHeader } from "@/components/database-header"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface CollectionRecord {
  id: string
  database_id: string
  name: string
  key?: string
  description?: string
  created_by?: string
  visibility?: string
  permission_rules?: unknown
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch { return iso }
}

function truncateId(id: string) {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

const collectionColumnDefs = [
  { key: "id", label: "Collection ID", visible: true, disabled: true },
  { key: "name", label: "Name", visible: true },
  { key: "created_at", label: "Created", visible: true },
  { key: "updated_at", label: "Updated", visible: true },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function CollectionsPage() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const { toast } = useToast()
  const basePath = `/${teamSlug}/${projectSlug}`

  const [loading, setLoading] = useState(true)
  const [collections, setCollections] = useState<CollectionRecord[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [columns, setColumns] = useState(collectionColumnDefs)
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [deleteColTarget, setDeleteColTarget] = useState<CollectionRecord | null>(null)
  const [deleteColOpen, setDeleteColOpen] = useState(false)
  const [deletingCol, setDeletingCol] = useState(false)
  const [limit, setLimit] = useState(6)
  const [offset, setOffset] = useState(0)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const colRes = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections`)
      const rawCollections = colRes.data?.data || []
      setCollections(rawCollections)
      const mapped = rawCollections.map((c: any) => ({
        slug: c.id,
        name: c.name,
        icon: FileJson,
        docCount: c.document_count || 0,
      }))
      setCollectionsForDb(dbId, mapped)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        router.replace(`${basePath}/databases`)
      } else {
        toast({ message: "Failed to load collections", type: "error" })
      }
    } finally {
      setLoading(false)
    }
  }, [dbId, basePath, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCollectionCreated = () => {
    clearCollectionsCache(dbId)
    fetchData()
  }

  const handleCollectionClick = (col: CollectionRecord) => {
    router.push(`${basePath}/databases/${dbId}/${col.id}/documents`)
  }

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    toast({ message: "ID copied to clipboard", type: "success" })
  }

  const handleColumnToggle = (key: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    )
  }

  const handleDeleteCollection = async () => {
    if (!deleteColTarget) return
    setDeletingCol(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${deleteColTarget.id}`
      )
      toast({
        message: "Collection deleted",
        description: `${deleteColTarget.name} has been permanently removed.`,
        type: "error",
      })
      setDeleteColOpen(false)
      setDeleteColTarget(null)
      clearCollectionsCache(dbId)
      fetchData()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message || "Failed to delete collection"
      toast({ message: msg, type: "error" })
    } finally {
      setDeletingCol(false)
    }
  }

  const visibleCols = columns.filter((c) => c.visible)
  const filtered = useMemo(
    () =>
      collections
        .filter(
          (c) =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
          const aVal = String((a as Record<string, unknown>)[sortBy] ?? "")
          const bVal = String((b as Record<string, unknown>)[sortBy] ?? "")
          const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" })
          return sortDir === "asc" ? cmp : -cmp
        }),
    [collections, searchQuery, sortBy, sortDir]
  )
  const total = filtered.length
  const paged = filtered.slice(offset, offset + limit)

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

  return (
    <>
      <DatabaseHeader />
      <div className="p-4 sm:p-6 lg:p-8 pt-6">
      {collections.length === 0 && !searchQuery ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
            <Table2 className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            No collections yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Create your first collection to start storing data.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Plus className="size-4" />
            Create collection
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <DataTableToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name or ID"
            columns={columns.map((c) => ({ key: c.key, label: c.label, visible: c.visible, disabled: c.disabled }))}
            onColumnToggle={handleColumnToggle}
          >
            <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8">
              <Plus className="size-3.5" />
              Create collection
            </Button>
          </DataTableToolbar>

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
                          col.key === "id" && "min-w-[200px]",
                          col.key === "name" && "min-w-[140px]",
                          (col.key === "created_at" || col.key === "updated_at") && "min-w-[100px]"
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
                    <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={visibleCols.length + 2} className="text-center py-16 text-sm text-muted-foreground font-sans">
                        No collections match your search.
                      </td>
                    </tr>
                  ) : (
                    paged.map((col, idx) => (
                      <tr
                        key={col.id}
                        onClick={() => handleCollectionClick(col)}
                        className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors cursor-pointer"
                      >
                        <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{offset + idx + 1}</span>
                        </td>
                        {visibleCols.map((vcol) => {
                          if (vcol.key === "id") {
                            return (
                              <td key={vcol.key} className="border-r border-border px-3 py-1.5 min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <Table2 className="size-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-foreground truncate" title={col.id}>{truncateId(col.id)}</span>
                                  <button
                                    onClick={(e) => handleCopyId(e, col.id)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                  >
                                    <Copy className="size-3" />
                                  </button>
                                </div>
                              </td>
                            )
                          }
                          if (vcol.key === "name") {
                            return (
                              <td key={vcol.key} className="border-r border-border px-3 py-1.5 min-w-[140px]">
                                <span className="text-foreground font-medium font-sans">{col.name}</span>
                              </td>
                            )
                          }
                          if (vcol.key === "created_at" || vcol.key === "updated_at") {
                            const val = vcol.key === "created_at" ? col.created_at : col.updated_at
                            return (
                              <td key={vcol.key} className="border-r border-border last:border-r-0 px-3 py-1.5 min-w-[100px]">
                                <span className="text-muted-foreground whitespace-nowrap">{formatDate(val)}</span>
                              </td>
                            )
                          }
                          return <td key={vcol.key} className="border-r border-border px-3 py-1.5">-</td>
                        })}
                        <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => handleCollectionClick(col)}
                              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Open collection"
                            >
                              <ExternalLink className="size-3" />
                            </button>
                            <button
                              onClick={() => { setDeleteColTarget(col); setDeleteColOpen(true) }}
                              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete collection"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-card/50">
              <p className="text-xs text-muted-foreground">
                {paged.length} of {total} collection{total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DataTablePagination
            total={total}
            limit={limit}
            offset={offset}
            noun="Collections"
            onPageChange={setOffset}
            onLimitChange={(newLimit) => { setLimit(newLimit); setOffset(0) }}
          />
        </div>
      )}

      </div>

      <CreateCollectionDialog
        dbId={dbId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCollectionCreated}
      />

      {/* Delete collection dialog */}
      <Dialog open={deleteColOpen} onOpenChange={setDeleteColOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{deleteColTarget?.name}</span>?
              All documents in this collection will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteCollection} disabled={deletingCol}>
              {deletingCol ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete collection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
