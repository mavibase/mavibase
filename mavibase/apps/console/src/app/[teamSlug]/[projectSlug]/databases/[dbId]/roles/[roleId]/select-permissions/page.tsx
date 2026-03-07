"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Settings,
  ChevronRight,
  Save,
  Check,
  FileJson,
  Eye,
  Pencil,
  Trash,
  Plus,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import axiosInstance from "@/lib/axios-instance"
import { useToast } from "@/components/custom-toast"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RoleRecord {
  id: string
  name: string
  description?: string | null
  permissions: string[]
  is_system: boolean
}

interface CollectionAccess {
  id: string
  name: string
  create: boolean
  read: boolean
  update: boolean
  delete: boolean
}

const CRUD_KEYS = ["create", "read", "update", "delete"] as const
type CrudKey = (typeof CRUD_KEYS)[number]

const CRUD_ICONS: Record<CrudKey, React.ElementType> = {
  create: Plus,
  read: Eye,
  update: Pencil,
  delete: Trash,
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const AVAILABLE_PERMISSIONS = [
  "databases.create", "databases.read", "databases.update", "databases.delete",
  "collections.create", "collections.read", "collections.update", "collections.delete",
  "documents.create", "documents.read", "documents.update", "documents.delete",
  "indexes.create", "indexes.read", "indexes.delete",
  "roles.create", "roles.read", "roles.update", "roles.delete",
  "roles.assign", "roles.revoke",
]

interface RoleTemplate {
  label: string
  description: string
  permissions: string[]
}

const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    label: "Admin",
    description: "Full access to all resources",
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
    description: "Create, read and update — no delete",
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
    description: "Read-only access",
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
/*  Group permissions by resource                                      */
/* ------------------------------------------------------------------ */
function groupPermissions(perms: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  perms.forEach((p) => {
    const [resource] = p.split(".")
    if (!grouped[resource]) grouped[resource] = []
    grouped[resource].push(p)
  })
  return grouped
}

const RESOURCE_ORDER = ["databases", "collections", "documents", "indexes", "roles"]

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function SelectPermissionsPage() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const roleId = params.roleId as string
  const { toast } = useToast()

  const [role, setRole] = useState<RoleRecord | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Collection-level access
  const [collectionAccess, setCollectionAccess] = useState<CollectionAccess[]>([])
  const [loadingCollections, setLoadingCollections] = useState(true)
  const [savingCollectionAccess, setSavingCollectionAccess] = useState(false)

  const basePath = `/${teamSlug}/${projectSlug}/databases/${dbId}`

  /* ---- fetch role ---- */
  const fetchRole = useCallback(async () => {
    setLoadingRole(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/roles/${roleId}`)
      const r: RoleRecord = res.data?.data
      setRole(r)
      setPermissions(Array.isArray(r?.permissions) ? [...r.permissions] : [])
    } catch {
      toast({ message: "Failed to load role", type: "error" })
    } finally {
      setLoadingRole(false)
    }
  }, [dbId, roleId, toast])

  useEffect(() => { fetchRole() }, [fetchRole])

  /* ---- fetch collections and their permission_rules ---- */
  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true)
    try {
      const colRes = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections`)
      const colList = colRes.data?.data || []
      const roleTarget = `role:${role?.name || ""}`
      const detailed = await Promise.all(
        colList.map(async (c: any) => {
          try {
            const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections/${c.id}`)
            const col = res.data?.data
            const rules = col?.permission_rules || {}
            // Correct format: { read: ["role:myRole", "any"], create: ["role:myRole"] }
            // Check if this role's target string appears in each action's array
            return {
              id: c.id,
              name: c.name || c.id,
              create: Array.isArray(rules.create) && rules.create.includes(roleTarget),
              read: Array.isArray(rules.read) && rules.read.includes(roleTarget),
              update: Array.isArray(rules.update) && rules.update.includes(roleTarget),
              delete: Array.isArray(rules.delete) && rules.delete.includes(roleTarget),
            } as CollectionAccess
          } catch {
            return { id: c.id, name: c.name || c.id, create: false, read: false, update: false, delete: false } as CollectionAccess
          }
        })
      )
      setCollectionAccess(detailed)
    } catch {
      // Silently fail
    } finally {
      setLoadingCollections(false)
    }
  }, [dbId, role?.name])

  useEffect(() => {
    if (role?.name) fetchCollections()
  }, [role?.name, fetchCollections])

  /* ---- toggle permission ---- */
  const togglePermission = (perm: string) => {
    setIsDirty(true)
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  /* ---- apply template ---- */
  const applyTemplate = (template: RoleTemplate) => {
    setPermissions([...template.permissions])
    setIsDirty(true)
  }

  /* ---- toggle all for a resource ---- */
  const toggleResource = (resourcePerms: string[]) => {
    const allActive = resourcePerms.every((p) => permissions.includes(p))
    if (allActive) {
      setPermissions((prev) => prev.filter((p) => !resourcePerms.includes(p)))
    } else {
      setPermissions((prev) => [...new Set([...prev, ...resourcePerms])])
    }
    setIsDirty(true)
  }

  /* ---- toggle collection CRUD access ---- */
  const toggleCollectionAccess = async (collectionId: string, key: CrudKey) => {
    if (!role) return
    const col = collectionAccess.find((c) => c.id === collectionId)
    if (!col) return
    const newValue = !col[key]

    // Optimistic update
    setCollectionAccess((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, [key]: newValue } : c
      )
    )

    setSavingCollectionAccess(true)
    try {
      // Fetch current permission_rules for this collection
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections/${collectionId}`)
      const currentRules = res.data?.data?.permission_rules || {}
      const roleTarget = `role:${role.name}`

      // Ensure each action key is an array
      for (const action of CRUD_KEYS) {
        if (!Array.isArray(currentRules[action])) {
          currentRules[action] = []
        }
      }

      if (newValue) {
        // Add role target to the action array (if not already present)
        if (!currentRules[key].includes(roleTarget)) {
          currentRules[key].push(roleTarget)
        }
      } else {
        // Remove role target from the action array
        currentRules[key] = currentRules[key].filter((t: string) => t !== roleTarget)
      }

      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionId}`,
        { permission_rules: currentRules }
      )
      toast({ message: `Collection access updated`, type: "success" })
    } catch (error: any) {
      // Revert optimistic update
      setCollectionAccess((prev) =>
        prev.map((c) =>
          c.id === collectionId ? { ...c, [key]: !newValue } : c
        )
      )
      const msg = error.response?.data?.error?.message || "Failed to update collection access"
      toast({ message: msg, type: "error" })
    } finally {
      setSavingCollectionAccess(false)
    }
  }

  const setAllCollectionAccess = async (collectionId: string, perms: Record<CrudKey, boolean>) => {
    if (!role) return

    // Optimistic update
    setCollectionAccess((prev) =>
      prev.map((c) =>
        c.id === collectionId ? { ...c, ...perms } : c
      )
    )

    setSavingCollectionAccess(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections/${collectionId}`)
      const currentRules = res.data?.data?.permission_rules || {}
      const roleTarget = `role:${role.name}`

      // Ensure each action key is an array
      for (const action of CRUD_KEYS) {
        if (!Array.isArray(currentRules[action])) {
          currentRules[action] = []
        }
      }

      // Add or remove role target from each action based on perms
      for (const action of CRUD_KEYS) {
        const shouldGrant = perms[action]
        const hasTarget = currentRules[action].includes(roleTarget)
        if (shouldGrant && !hasTarget) {
          currentRules[action].push(roleTarget)
        } else if (!shouldGrant && hasTarget) {
          currentRules[action] = currentRules[action].filter((t: string) => t !== roleTarget)
        }
      }

      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionId}`,
        { permission_rules: currentRules }
      )
      toast({ message: "Collection access updated", type: "success" })
    } catch (error: any) {
      fetchCollections()
      const msg = error.response?.data?.error?.message || "Failed to update collection access"
      toast({ message: msg, type: "error" })
    } finally {
      setSavingCollectionAccess(false)
    }
  }

  /* ---- save ---- */
  const handleSave = async () => {
    setSaving(true)
    try {
      await axiosInstance.db.patch(`/v1/db/databases/${dbId}/roles/${roleId}`, {
        permissions,
      })
      toast({ message: "Permissions saved", type: "success" })
      setIsDirty(false)
      setRole((prev) => prev ? { ...prev, permissions } : prev)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to save permissions"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const grouped = groupPermissions(AVAILABLE_PERMISSIONS)
  const orderedResources = [
    ...RESOURCE_ORDER.filter((r) => grouped[r]),
    ...Object.keys(grouped).filter((r) => !RESOURCE_ORDER.includes(r)),
  ]

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push(`${basePath}/roles`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="size-3.5" />
          Roles
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <button
          onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {role?.name || "..."}
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium flex items-center gap-1.5">
          <Settings className="size-3.5" />
          Permissions
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">
              Permissions
              {role && <span className="text-muted-foreground font-normal"> — {role.name}</span>}
            </h1>
            {isDirty && (
              <span className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          {role?.description && (
            <p className="text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
        {!loadingRole && role && !role.is_system && (
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="shrink-0"
          >
            {saving ? (
              <><Loader2 className="size-4 animate-spin" />Saving...</>
            ) : (
              <><Save className="size-4" />Save permissions</>
            )}
          </Button>
        )}
      </div>

      {/* Sub-navigation */}
      {role && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-border gap-1.5"
            onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          >
            <Users className="size-3.5" />
            Members
          </Button>
          {!role.is_system && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border gap-1.5"
              onClick={() => router.push(`${basePath}/roles/${roleId}/assign`)}
            >
              <UserPlus className="size-3.5" />
              Assign member
            </Button>
          )}
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5"
          >
            <Settings className="size-3.5" />
            Permissions
            <span className="ml-1 text-[10px] text-primary-foreground/70 bg-white/20 px-1.5 py-0.5 rounded-full">
              {permissions.length}
            </span>
          </Button>
        </div>
      )}

      {loadingRole ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : role?.is_system ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
            <Shield className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">System role</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Permissions for system roles are fixed and cannot be modified.
          </p>
          {/* Show read-only permissions */}
          <div className="mt-6 text-left w-full max-w-lg">
            {orderedResources.map((resource) => {
              const resourcePerms = grouped[resource] || []
              return (
                <div key={resource} className="mb-4">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-2 capitalize">{resource}</p>
                  <div className="flex flex-wrap gap-2">
                    {resourcePerms.map((perm) => {
                      const action = perm.split(".")[1]
                      const active = permissions.includes(perm)
                      return (
                        <span
                          key={perm}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono",
                            active
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-secondary text-muted-foreground border border-border opacity-50"
                          )}
                        >
                          {active && <Check className="size-3" />}
                          {action}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 max-w-2xl">
          {/* Quick-apply templates */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Quick-apply template</p>
              <p className="text-xs text-muted-foreground mt-0.5">Apply a preset permission set to quickly configure this role.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ROLE_TEMPLATES.map((t) => {
                const isActive = t.permissions.length === permissions.length &&
                  t.permissions.every((p) => permissions.includes(p))
                return (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors",
                      isActive
                        ? t.label === "Admin" ? "border-emerald-500/60 bg-emerald-500/15"
                          : t.label === "Editor" ? "border-sky-500/60 bg-sky-500/15"
                          : t.label === "Viewer" ? "border-amber-500/60 bg-amber-500/15"
                          : "border-red-500/60 bg-red-500/15"
                        : t.label === "Admin" ? "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10"
                          : t.label === "Editor" ? "border-sky-500/25 bg-sky-500/5 hover:bg-sky-500/10"
                          : t.label === "Viewer" ? "border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10"
                          : "border-red-500/25 bg-red-500/5 hover:bg-red-500/10"
                    )}
                  >
                    <Shield className={cn(
                      "size-4 shrink-0",
                      t.label === "Admin" ? "text-emerald-500"
                      : t.label === "Editor" ? "text-sky-500"
                      : t.label === "Viewer" ? "text-amber-500"
                      : "text-red-500"
                    )} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.permissions.length} perms</p>
                    </div>
                    {isActive && <Check className="size-3 ml-auto shrink-0 text-foreground" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Permission groups */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-foreground">Fine-grained permissions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Toggle individual permissions or click a resource name to select/deselect all.</p>
            </div>

            {orderedResources.map((resource) => {
              const resourcePerms = grouped[resource] || []
              const allActive = resourcePerms.every((p) => permissions.includes(p))
              const someActive = resourcePerms.some((p) => permissions.includes(p))

              return (
                <div key={resource} className="rounded-lg border border-border overflow-hidden">
                  {/* Resource header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleResource(resourcePerms)}
                        className={cn(
                          "flex items-center justify-center size-4 rounded border transition-colors",
                          allActive
                            ? "bg-primary border-primary text-primary-foreground"
                            : someActive
                            ? "bg-primary/30 border-primary/50"
                            : "bg-secondary border-border"
                        )}
                        title={allActive ? "Deselect all" : "Select all"}
                      >
                        {allActive && <Check className="size-2.5" />}
                        {someActive && !allActive && <div className="size-1.5 rounded-sm bg-primary" />}
                      </button>
                      <p className="text-xs font-medium text-foreground capitalize">{resource}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {resourcePerms.filter((p) => permissions.includes(p)).length}/{resourcePerms.length} selected
                    </p>
                  </div>

                  {/* Permission pills */}
                  <div className="p-3 flex flex-wrap gap-2">
                    {resourcePerms.map((perm) => {
                      const action = perm.split(".")[1]
                      const active = permissions.includes(perm)
                      return (
                        <button
                          key={perm}
                          onClick={() => togglePermission(perm)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all",
                            active
                              ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                              : "bg-secondary text-muted-foreground border border-border hover:border-primary/30 hover:text-foreground"
                          )}
                        >
                          {active ? (
                            <Check className="size-3" />
                          ) : (
                            <div className="size-3 rounded-full border border-current opacity-30" />
                          )}
                          {action}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Collection-Level Access */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-foreground">Collection-level access</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure which CRUD operations this role can perform on each collection. These are saved directly to each collection&#39;s permission rules.
              </p>
            </div>

            {loadingCollections ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-4 text-muted-foreground animate-spin" />
              </div>
            ) : collectionAccess.length === 0 ? (
              <div className="rounded-lg border border-border p-6 text-center">
                <FileJson className="size-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No collections found in this database.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1.5fr_repeat(4,1fr)_auto] items-center px-4 py-2 border-b border-border bg-card gap-x-3">
                  <p className="text-xs font-medium text-muted-foreground">Collection</p>
                  {CRUD_KEYS.map((k) => {
                    const Icon = CRUD_ICONS[k]
                    return (
                      <div key={k} className="flex items-center gap-1.5 justify-center">
                        <Icon className="size-3 text-muted-foreground" />
                        <p className="text-xs font-medium text-muted-foreground capitalize">{k}</p>
                      </div>
                    )
                  })}
                  <p className="text-xs font-medium text-muted-foreground text-center min-w-[70px]">Quick</p>
                </div>

                {/* Collection rows */}
                {collectionAccess.map((col) => {
                  const activeCount = CRUD_KEYS.filter((k) => col[k]).length
                  return (
                    <div
                      key={col.id}
                      className="grid grid-cols-[1.5fr_repeat(4,1fr)_auto] items-center px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-card/50 transition-colors gap-x-3"
                    >
                      {/* Collection name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <FileJson className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-foreground truncate">{col.name}</span>
                        <span className={cn(
                          "text-[10px] px-1 py-0.5 rounded shrink-0",
                          activeCount === 4 && "bg-emerald-500/10 text-emerald-500",
                          activeCount > 0 && activeCount < 4 && "bg-sky-500/10 text-sky-500",
                          activeCount === 0 && "bg-secondary text-muted-foreground",
                        )}>
                          {activeCount}/4
                        </span>
                      </div>

                      {/* CRUD toggles */}
                      {CRUD_KEYS.map((k) => (
                        <div key={k} className="flex justify-center">
                          <button
                            onClick={() => toggleCollectionAccess(col.id, k)}
                            disabled={savingCollectionAccess}
                            className={cn(
                              "flex items-center justify-center size-7 rounded-md transition-all",
                              col[k]
                                ? "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
                                : "bg-secondary text-muted-foreground border border-transparent hover:border-border"
                            )}
                          >
                            {col[k] ? <Check className="size-3" /> : <X className="size-3 opacity-40" />}
                          </button>
                        </div>
                      ))}

                      {/* Quick actions */}
                      <div className="flex items-center justify-center gap-1 min-w-[70px]">
                        <button
                          onClick={() => setAllCollectionAccess(col.id, { create: true, read: true, update: true, delete: true })}
                          disabled={savingCollectionAccess}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                          title="Grant full access"
                        >
                          All
                        </button>
                        <button
                          onClick={() => setAllCollectionAccess(col.id, { create: false, read: false, update: false, delete: false })}
                          disabled={savingCollectionAccess}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Revoke all access"
                        >
                          None
                        </button>
                      </div>
                    </div>
                  )
                })}

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-card/50">
                  <p className="text-xs text-muted-foreground">
                    {collectionAccess.filter((c) => CRUD_KEYS.some((k) => c[k])).length} of {collectionAccess.length} collection{collectionAccess.length !== 1 ? "s" : ""} with access
                  </p>
                  {savingCollectionAccess && (
                    <div className="flex items-center gap-1.5">
                      <Loader2 className="size-3 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Saving...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Save bar (sticky at bottom) */}
          {isDirty && (
            <div className="sticky bottom-0 flex items-center justify-between gap-4 bg-card border border-border rounded-xl px-4 py-3 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                <p className="text-sm text-foreground font-medium">You have unsaved changes</p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {permissions.length} permission{permissions.length !== 1 ? "s" : ""} selected
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border h-8"
                  onClick={() => {
                    setPermissions(Array.isArray(role?.permissions) ? [...role!.permissions] : [])
                    setIsDirty(false)
                  }}
                >
                  Discard
                </Button>
                <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="size-4 animate-spin" />Saving...</> : <><Save className="size-4" />Save</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
