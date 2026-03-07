"use client"

import { useState, useCallback, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Database,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
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
import { useProjectContext } from "@/contexts/project-context"
import axiosInstance from "@/lib/axios-instance"
import { DataTableToolbar } from "@/components/data-table-toolbar"
import { DataTablePagination } from "@/components/data-table-pagination"
import { ArrowUpDown, Copy } from "lucide-react"

/* ------------------------------------------------------------------ */
/*  Types (from API)                                                   */
/* ------------------------------------------------------------------ */
interface DatabaseRecord {
  id: string
  name: string
  key?: string
  description?: string
  project_id: string
  created_at: string
  updated_at: string
}

/* ------------------------------------------------------------------ */
/*  Create database SHEET                                              */
/* ------------------------------------------------------------------ */
function CreateDatabaseSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [customId, setCustomId] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ message: "Name is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post("/v1/db/databases", {
        ...(customId.trim() ? { id: customId.trim() } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
      })
      toast({
        message: `${name.trim()} has been created`,
        type: "success",
      })
      setName("")
      setCustomId("")
      setDescription("")
      onOpenChange(false)
      onCreated()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Failed to create database"
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Create database</SheetTitle>
          <SheetDescription>
            Set up a new database instance for your project.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              placeholder="Enter database name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleCreate()
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Database ID
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter a custom Database ID. Leave blank for a randomly generated one.
            </p>
            <div className="relative">
              <Input
                placeholder="Enter ID"
                value={customId}
                onChange={(e) => setCustomId(e.target.value.slice(0, 36))}
                className="bg-secondary border-border font-mono pr-14"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {customId.length}/36
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Allowed characters: alphanumeric, non-leading hyphen, underscore, period
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="A brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
        </div>

        <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
          <Button
            variant="outline"
            className="border-border"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
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
/*  Delete confirmation dialog                                         */
/* ------------------------------------------------------------------ */
function DeleteDatabaseDialog({
  db,
  open,
  onOpenChange,
  onDeleted,
}: {
  db: DatabaseRecord | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    if (!db) return
    setDeleting(true)
    try {
      await axiosInstance.db.delete(`/v1/db/databases/${db.id}`)
      toast({
        message: "Database deleted",
        description: `${db.name} has been permanently removed.`,
        type: "error",
      })
      onOpenChange(false)
      onDeleted()
    } catch (error: any) {
      const msg =
        error.response?.data?.error?.message || "Failed to delete database"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete database</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{db?.name}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="border-border">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete database"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
        <Database className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">No databases yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Create your first database to start storing and querying data for your project.
      </p>
      <Button onClick={onAction} className="mt-5">
        <Plus className="size-4" />
        Create database
      </Button>
    </div>
  )
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

const columnDefs = [
  { key: "id", label: "Database ID", visible: true, disabled: true },
  { key: "name", label: "Name", visible: true },
  { key: "created_at", label: "Created", visible: true },
  { key: "updated_at", label: "Updated", visible: true },
]

/* ------------------------------------------------------------------ */
/*  Main databases content                                             */
/* ------------------------------------------------------------------ */
export function DatabasesContent() {
  const [databases, setDatabases] = useState<DatabaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DatabaseRecord | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"databases" | "usage">("databases")
  const [columns, setColumns] = useState(columnDefs)
  const [sortBy, setSortBy] = useState<string>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  // Pagination state (server-side)
  const [limit, setLimit] = useState(6)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)

  const { toast } = useToast()
  const params = useParams()
  const router = useRouter()
  const { projectId } = useProjectContext()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const basePath = `/${teamSlug}/${projectSlug}`

  const fetchDatabases = useCallback(
    async (fetchLimit = limit, fetchOffset = offset) => {
      setLoading(true)
      try {
        const res = await axiosInstance.db.get("/v1/db/databases", {
          params: { limit: fetchLimit, offset: fetchOffset },
        })
        setDatabases(res.data?.data || [])
        setTotal(res.data?.pagination?.total ?? (res.data?.data || []).length)
      } catch (error: any) {
        const msg =
          error.response?.data?.error?.message || "Failed to load databases"
        toast({ message: msg, type: "error" })
        setDatabases([])
      } finally {
        setLoading(false)
      }
    },
    [limit, offset, projectId, toast]
  )

  useEffect(() => {
    fetchDatabases(limit, offset)
  }, [limit, offset, fetchDatabases])

  const handlePageChange = (newOffset: number) => {
    setOffset(newOffset)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setOffset(0)
  }

  const handleDbClick = (db: DatabaseRecord) => {
    router.push(`${basePath}/databases/${db.id}`)
  }

  const handleColumnToggle = (key: string) => {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    )
  }

  // Client-side search filter + sort (within current page)
  const visibleCols = columns.filter((c) => c.visible)
  const filtered = databases
    .filter(
      (db) =>
        db.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        db.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = String((a as Record<string, unknown>)[sortBy] ?? "")
      const bVal = String((b as Record<string, unknown>)[sortBy] ?? "")
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })

  // Toolbar-compatible column defs (simplified for the toolbar dropdown)
  const toolbarColumns = columns.map((c) => ({
    key: c.key,
    label: c.label,
    visible: c.visible,
  }))

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Page title */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Database className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight">
                Databases
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View, create, and manage all databases for your project.
            </p>
          </div>
        </div>
      </div>
      {activeTab === "databases" && (
        <>
          {loading && databases.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 text-muted-foreground animate-spin" />
            </div>
          ) : databases.length === 0 && !searchQuery ? (
            <EmptyState onAction={() => setCreateOpen(true)} />
          ) : (
            <>
              {/* Toolbar */}
              <DataTableToolbar
                searchPlaceholder="Search by name or ID"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                columns={toolbarColumns}
                onColumnToggle={handleColumnToggle}
              >
                <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8">
                  <Plus className="size-3.5" />
                  Create database
                </Button>
              </DataTableToolbar>

              <>
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
                          {filtered.length === 0 ? (
                            <tr>
                              <td colSpan={visibleCols.length + 2} className="text-center py-16 text-sm text-muted-foreground font-sans">
                                No databases match your search.
                              </td>
                            </tr>
                          ) : (
                            filtered.map((db, idx) => (
                              <tr
                                key={db.id}
                                onClick={() => handleDbClick(db)}
                                className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors cursor-pointer"
                              >
                                <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                                  <span className="text-[11px] text-muted-foreground tabular-nums">{offset + idx + 1}</span>
                                </td>
                                {visibleCols.map((col) => {
                                  if (col.key === "id") {
                                    return (
                                      <td key={col.key} className="border-r border-border px-3 py-1.5 min-w-[200px]">
                                        <div className="flex items-center gap-2">
                                          <Database className="size-3.5 text-muted-foreground shrink-0" />
                                          <span className="text-foreground truncate" title={db.id}>{truncateId(db.id)}</span>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(db.id); toast({ message: "ID copied", type: "success" }) }}
                                            className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                          >
                                            <Copy className="size-3" />
                                          </button>
                                        </div>
                                      </td>
                                    )
                                  }
                                  if (col.key === "name") {
                                    return (
                                      <td key={col.key} className="border-r border-border px-3 py-1.5 min-w-[140px]">
                                        <span className="text-foreground font-medium font-sans">{db.name}</span>
                                      </td>
                                    )
                                  }
                                  if (col.key === "created_at" || col.key === "updated_at") {
                                    const val = col.key === "created_at" ? db.created_at : db.updated_at
                                    return (
                                      <td key={col.key} className="border-r border-border last:border-r-0 px-3 py-1.5 min-w-[100px]">
                                        <span className="text-muted-foreground whitespace-nowrap">{formatDate(val)}</span>
                                      </td>
                                    )
                                  }
                                  return <td key={col.key} className="border-r border-border px-3 py-1.5">-</td>
                                })}
                                <td className="px-1 py-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button
                                      onClick={() => handleDbClick(db)}
                                      className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                      title="Open database"
                                    >
                                      <ExternalLink className="size-3" />
                                    </button>
                                    <button
                                      onClick={() => { setDeleteTarget(db); setDeleteOpen(true) }}
                                      className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Delete database"
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
                        {filtered.length} of {total} database{total !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <DataTablePagination
                    total={total}
                    limit={limit}
                    offset={offset}
                    noun="Databases"
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                  />
                </>
            </>
          )}
        </>
      )}

      {activeTab === "usage" && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Database usage metrics coming from your backend.
          </p>
        </div>
      )}

      {/* Sheet & Dialogs */}
      <CreateDatabaseSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => fetchDatabases(limit, 0)}
      />
      <DeleteDatabaseDialog
        db={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => fetchDatabases(limit, 0)}
      />
    </div>
  )
}
