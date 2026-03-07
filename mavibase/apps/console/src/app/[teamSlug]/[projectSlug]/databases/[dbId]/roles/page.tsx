"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  Plus,
  Shield,
  Trash2,
  Settings,
  Copy,
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
import axiosInstance from "@/lib/axios-instance"
import { useToast } from "@/components/custom-toast"
import { DatabaseHeader } from "@/components/database-header"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RoleRecord {
  id: string
  project_id: string
  name: string
  description?: string | null
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

interface RoleTemplate {
  label: string
  description: string
  permissions: string[]
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    label: "Admin",
    description: "Full access: all CRUD operations on databases, collections, documents, indexes, and roles",
    permissions: [
      "databases.create", "databases.read", "databases.update", "databases.delete",
      "collections.create", "collections.read", "collections.update", "collections.delete",
      "documents.create", "documents.read", "documents.update", "documents.delete",
      "indexes.create", "indexes.read", "indexes.delete",
      "roles.create", "roles.read", "roles.update", "roles.delete",
      "roles.assign", "roles.revoke",
    ],
  },
  {
    label: "Editor",
    description: "Can create, read, and update resources but cannot delete",
    permissions: [
      "databases.create", "databases.read", "databases.update",
      "collections.create", "collections.read", "collections.update",
      "documents.create", "documents.read", "documents.update",
      "indexes.create", "indexes.read",
      "roles.read",
    ],
  },
  {
    label: "Viewer",
    description: "Read-only access to all resources",
    permissions: [
      "databases.read",
      "collections.read",
      "documents.read",
      "indexes.read",
      "roles.read",
    ],
  },
  {
    label: "No Access",
    description: "All permissions denied",
    permissions: [],
  },
]

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

function getMatchingTemplate(role: RoleRecord): RoleTemplate | null {
  const perms = Array.isArray(role.permissions) ? role.permissions : []
  return ROLE_TEMPLATES.find((t) => {
    if (t.permissions.length !== perms.length) return false
    return t.permissions.every((p) => perms.includes(p)) && perms.every((p) => t.permissions.includes(p))
  }) || null
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function RolesPage() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const { toast } = useToast()

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Create role sheet
  const [createOpen, setCreateOpen] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDesc, setRoleDesc] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null)
  const [creating, setCreating] = useState(false)

  // Delete role
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const basePath = `/${teamSlug}/${projectSlug}/databases/${dbId}`

  const fetchRoles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/roles`)
      setRoles(res.data?.data || [])
    } catch {
      toast({ message: "Failed to load roles", type: "error" })
    } finally {
      setLoading(false)
    }
  }, [dbId, toast])

  useEffect(() => { fetchRoles() }, [fetchRoles])

  const handleCreateRole = async () => {
    if (!roleName.trim()) {
      toast({ message: "Role name is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post(`/v1/db/databases/${dbId}/roles`, {
        name: roleName.trim().toLowerCase(),
        description: roleDesc.trim() || undefined,
        permissions: selectedTemplate?.permissions || [],
      })
      toast({ message: `Role '${roleName.trim()}' created`, type: "success" })
      setRoleName("")
      setRoleDesc("")
      setSelectedTemplate(null)
      setCreateOpen(false)
      fetchRoles()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to create role"
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await axiosInstance.db.delete(`/v1/db/databases/${dbId}/roles/${deleteTarget.id}`)
      toast({ message: `Role '${deleteTarget.name}' deleted`, type: "success" })
      setDeleteOpen(false)
      setDeleteTarget(null)
      fetchRoles()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete role"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  const handleDuplicateRole = async (role: RoleRecord) => {
    const newName = `${role.name}-copy`
    try {
      await axiosInstance.db.post(`/v1/db/databases/${dbId}/roles`, {
        name: newName,
        description: role.description ? `Copy of ${role.description}` : `Copy of ${role.name}`,
        permissions: [...role.permissions],
      })
      toast({ message: `Role '${newName}' created as a copy of '${role.name}'`, type: "success" })
      fetchRoles()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to duplicate role"
      toast({ message: msg, type: "error" })
    }
  }

  const filteredRoles = useMemo(() =>
    roles.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    ), [roles, searchQuery])

  return (
    <>
    <DatabaseHeader />
    <div className="p-4 sm:p-6 lg:p-8 pt-6">
    <div className="flex flex-col gap-6">
      {/* Description + action */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Manage custom roles, permissions, and member assignments for this database.
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="h-8 shrink-0">
          <Plus className="size-3.5" />
          Create role
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
            <Shield className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No roles yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Create custom roles to manage access control. Use templates for quick setup.
          </p>
          {/* Quick-start template cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 w-full max-w-md">
            {ROLE_TEMPLATES.filter((t) => t.label !== "No Access").map((t) => (
              <button
                key={t.label}
                onClick={() => {
                  setSelectedTemplate(t)
                  setRoleName(t.label.toLowerCase())
                  setRoleDesc(t.description)
                  setCreateOpen(true)
                }}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors",
                  t.label === "Admin" && "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10",
                  t.label === "Editor" && "border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10",
                  t.label === "Viewer" && "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
                )}
              >
                <Shield className={cn(
                  "size-5",
                  t.label === "Admin" && "text-emerald-500",
                  t.label === "Editor" && "text-sky-500",
                  t.label === "Viewer" && "text-amber-500",
                )} />
                <p className="text-xs font-medium text-foreground">{t.label}</p>
              </button>
            ))}
          </div>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Plus className="size-4" />
            Create role
          </Button>
        </div>
      ) : (
        <>
          {/* Search */}
          {roles.length > 3 && (
            <Input
              placeholder="Search roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 max-w-xs bg-secondary border-border text-sm"
            />
          )}

          {/* Roles table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[140px]">Name</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[80px]">Type</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[100px]">Template</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[60px]">Perms</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[180px]">Description</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[100px]">Created</th>
                    <th className="border-b border-border w-[140px] min-w-[140px] px-1 py-1.5" />
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {filteredRoles.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-sm text-muted-foreground font-sans">
                        No roles match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredRoles.map((role, idx) => {
                      const matchedTemplate = getMatchingTemplate(role)
                      return (
                        <tr
                          key={role.id}
                          className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors"
                        >
                          <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                            <span className="text-[11px] text-muted-foreground tabular-nums">{idx + 1}</span>
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Shield className="size-3.5 text-muted-foreground shrink-0" />
                              <span className="text-foreground font-medium">{role.name}</span>
                            </div>
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                              role.is_system ? "bg-sky-500/10 text-sky-400" : "bg-secondary text-muted-foreground"
                            )}>
                              {role.is_system ? "System" : "Custom"}
                            </span>
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            {matchedTemplate ? (
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                                matchedTemplate.label === "Admin" && "bg-emerald-500/10 text-emerald-500",
                                matchedTemplate.label === "Editor" && "bg-sky-500/10 text-sky-500",
                                matchedTemplate.label === "Viewer" && "bg-amber-500/10 text-amber-500",
                                matchedTemplate.label === "No Access" && "bg-red-500/10 text-red-500",
                              )}>
                                {matchedTemplate.label}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                                Custom
                              </span>
                            )}
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            <div className="relative group/perms">
                              <span className="text-muted-foreground cursor-default">
                                {Array.isArray(role.permissions) ? role.permissions.length : 0}
                              </span>
                              {/* Hover permission preview */}
                              {Array.isArray(role.permissions) && role.permissions.length > 0 && (
                                <div className="absolute left-0 top-full mt-1 hidden group-hover/perms:block z-20 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                                  <p className="text-[10px] font-medium text-foreground mb-2 font-sans">Permissions ({role.permissions.length})</p>
                                  <div className="flex flex-wrap gap-1 max-h-[150px] overflow-y-auto">
                                    {role.permissions.map((perm) => (
                                      <span
                                        key={perm}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary border border-primary/20"
                                      >
                                        {perm}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            <span className="text-muted-foreground font-sans text-xs truncate block max-w-[180px]" title={role.description || ""}>
                              {role.description || "-"}
                            </span>
                          </td>
                          <td className="border-r border-border px-3 py-2">
                            <span className="text-muted-foreground whitespace-nowrap">{formatDate(role.created_at)}</span>
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-center gap-1">
                              {/* Configure button -> goes to members page as hub */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] border-border gap-1"
                                onClick={() => router.push(`${basePath}/roles/${role.id}/members`)}
                                title="Configure role"
                              >
                                <Settings className="size-2.5" />
                                Configure
                              </Button>
                              <button
                                onClick={() => handleDuplicateRole(role)}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                                title="Duplicate role"
                              >
                                <Copy className="size-3" />
                              </button>
                              {!role.is_system && (
                                <button
                                  onClick={() => { setDeleteTarget(role); setDeleteOpen(true) }}
                                  className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Delete role"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
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
                {filteredRoles.length} of {roles.length} role{roles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Create role sheet */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md bg-popover border-border">
          <SheetHeader className="px-6">
            <SheetTitle className="text-foreground">Create role</SheetTitle>
            <SheetDescription>
              Define a new custom role for access control. Use a template for quick setup.
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                placeholder="e.g. editor, viewer"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className="bg-secondary border-border font-mono"
                onKeyDown={(e) => { if (e.key === "Enter" && roleName.trim()) handleCreateRole() }}
              />
              <p className="text-xs text-muted-foreground">Lowercase alphanumeric with hyphens only.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Description <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                placeholder="A brief description..."
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
            {/* Template selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                Apply a template <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_TEMPLATES.map((t) => {
                  const isSelected = selectedTemplate?.label === t.label
                  return (
                    <button
                      key={t.label}
                      onClick={() => setSelectedTemplate(isSelected ? null : t)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : t.label === "Admin" ? "border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10"
                          : t.label === "Editor" ? "border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10"
                          : t.label === "Viewer" ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                          : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                      )}
                    >
                      <Shield className={cn(
                        "size-4 shrink-0",
                        isSelected ? "text-primary"
                        : t.label === "Admin" ? "text-emerald-500"
                        : t.label === "Editor" ? "text-sky-500"
                        : t.label === "Viewer" ? "text-amber-500"
                        : "text-red-500"
                      )} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground">{t.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{t.permissions.length} permissions</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          <SheetFooter className="px-6 flex-row gap-2 justify-end border-t border-border pt-4">
            <Button variant="outline" className="border-border" onClick={() => { setCreateOpen(false); setSelectedTemplate(null) }}>Cancel</Button>
            <Button onClick={handleCreateRole} disabled={creating}>
              {creating ? <><Loader2 className="size-4 animate-spin" />Creating...</> : "Create"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete role dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
              All user assignments for this role will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteRole} disabled={deleting}>
              {deleting ? <><Loader2 className="size-4 animate-spin" />Deleting...</> : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
    </>
  )
}
