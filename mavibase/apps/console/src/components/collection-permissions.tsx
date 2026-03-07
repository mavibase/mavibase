"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { useParams } from "next/navigation"
import { createPortal } from "react-dom"
import {
  Plus,
  Trash2,
  Loader2,
  Shield,
  Eye,
  Pencil,
  Trash,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Info,
  ChevronDown,
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
import { useToast } from "@/components/custom-toast"
import axiosInstance from "@/lib/axios-instance"

/* ------------------------------------------------------------------ */
/*  Types matching backend PermissionRules exactly                      */
/* ------------------------------------------------------------------ */
const ACTIONS = ["read", "create", "update", "delete"] as const
type Action = (typeof ACTIONS)[number]

const ACTION_META: Record<Action, { icon: React.ElementType; label: string; description: string }> = {
  read:   { icon: Eye,     label: "Read",   description: "View documents in this collection" },
  create: { icon: Plus,    label: "Create", description: "Add new documents" },
  update: { icon: Pencil,  label: "Update", description: "Modify existing documents" },
  delete: { icon: Trash,   label: "Delete", description: "Remove documents" },
}

/** Normalize any target entry (string or object) to a display string */
function targetToString(target: any): string {
  if (typeof target === "string") return target
  if (typeof target === "object" && target !== null) {
    if (target.role) return target.role
    return JSON.stringify(target)
  }
  return String(target)
}

/* ------------------------------------------------------------------ */
/*  Target Picker                                                      */
/* ------------------------------------------------------------------ */
const TARGET_PRESETS = [
  { value: "any",   label: "Any user",      description: "All authenticated and guest users" },
  { value: "owner", label: "Owner only",     description: "Only the document owner" },
  { value: "none",  label: "Nobody",         description: "Deny all access" },
] as const

function TargetPicker({
  onAdd,
  existingTargets,
}: {
  onAdd: (target: string) => void
  existingTargets: string[]
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"preset" | "custom">("preset")
  const [customValue, setCustomValue] = useState("")
  const [prefix, setPrefix] = useState<"role:" | "user:" | "team:" | "scope:">("role:")
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuHeight = 200
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    const left = rect.left
    setPos({ top: Math.max(8, top), left: Math.max(8, left) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const handleAddCustom = () => {
    const val = `${prefix}${customValue.trim()}`
    if (!customValue.trim()) return
    if (existingTargets.includes(val)) return
    onAdd(val)
    setCustomValue("")
    setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors font-medium"
      >
        <Plus className="size-3" />
        Add target
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-72 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
        >
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setMode("preset")}
              className={cn(
                "flex-1 text-xs font-medium py-2 transition-colors",
                mode === "preset" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Presets
            </button>
            <button
              onClick={() => setMode("custom")}
              className={cn(
                "flex-1 text-xs font-medium py-2 transition-colors",
                mode === "custom" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Custom
            </button>
          </div>

          <div className="p-2">
            {mode === "preset" ? (
              <div className="flex flex-col gap-0.5">
                {TARGET_PRESETS.map((t) => {
                  const alreadyExists = existingTargets.includes(t.value)
                  return (
                    <button
                      key={t.value}
                      onClick={() => { if (!alreadyExists) { onAdd(t.value); setOpen(false) } }}
                      disabled={alreadyExists}
                      className={cn(
                        "flex flex-col items-start px-3 py-2 rounded-md text-left transition-colors",
                        alreadyExists
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-secondary"
                      )}
                    >
                      <span className="text-xs font-medium text-foreground">{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.description}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-1">
                <div className="flex gap-1.5">
                  {(["role:", "user:", "team:", "scope:"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPrefix(p)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors",
                        prefix === p
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "bg-secondary text-muted-foreground border border-transparent hover:border-border"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <div className="flex items-center gap-0 flex-1 border border-border rounded-md bg-secondary overflow-hidden">
                    <span className="text-[10px] font-mono text-muted-foreground pl-2 shrink-0">{prefix}</span>
                    <input
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="value"
                      className="flex-1 bg-transparent text-xs font-mono text-foreground px-1 py-1.5 outline-none"
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom() }}
                    />
                  </div>
                  <button
                    onClick={handleAddCustom}
                    disabled={!customValue.trim()}
                    className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Role Picker (fetches database roles for quick-add)                 */
/* ------------------------------------------------------------------ */
function RolePicker({
  dbId,
  action,
  existingTargets,
  onAdd,
}: {
  dbId: string
  action: Action
  existingTargets: string[]
  onAdd: (target: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuHeight = 260
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight ? rect.top - menuHeight : rect.bottom + 4
    const left = rect.left
    setPos({ top: Math.max(8, top), left: Math.max(8, left) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    axiosInstance.db
      .get(`/v1/db/databases/${dbId}/roles`)
      .then((res) => setRoles(res.data?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, dbId])

  const filtered = roles.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Shield className="size-3" />
        Add role
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="w-60 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
        >
          <div className="p-2 border-b border-border">
            <Input
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 text-xs bg-secondary border-border"
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="size-3.5 text-muted-foreground animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-3">No roles found</p>
            ) : (
              filtered.map((role) => {
                const roleTarget = `role:${role.name}`
                const exists = existingTargets.includes(roleTarget)
                return (
                  <button
                    key={role.id}
                    onClick={() => { if (!exists) { onAdd(roleTarget); setOpen(false); setSearch("") } }}
                    disabled={exists}
                    className={cn(
                      "flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-left transition-colors",
                      exists ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary"
                    )}
                  >
                    <Shield className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-mono text-foreground truncate">{role.name}</span>
                    {exists && <Check className="size-3 text-primary ml-auto shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Target Badge                                                       */
/* ------------------------------------------------------------------ */
function TargetBadge({
  target,
  onRemove,
}: {
  target: string
  onRemove: () => void
}) {
  const display = target
  let variant = "bg-secondary text-muted-foreground border-border"
  if (target === "any") variant = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  else if (target === "owner") variant = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
  else if (target === "none") variant = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
  else if (target.startsWith("role:")) variant = "bg-primary/10 text-primary border-primary/20"
  else if (target.startsWith("user:")) variant = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
  else if (target.startsWith("team:")) variant = "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border", variant)}>
      {display}
      <button
        onClick={onRemove}
        className="ml-0.5 hover:opacity-70 transition-opacity"
      >
        <X className="size-2.5" />
      </button>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component (embeddable, accepts optional props)                 */
/* ------------------------------------------------------------------ */
export function PermissionsContent({ embedded }: { embedded?: boolean } = {}) {
  const params = useParams()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const { toast } = useToast()

  // State: action-keyed permission rules matching backend format
  const [rules, setRules] = useState<Record<Action, string[]>>({
    read: [],
    create: [],
    update: [],
    delete: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  /* ---- Fetch ---- */
  const fetchPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`
      )
      const collection = res.data?.data
      const pr = collection?.permission_rules
      if (pr && typeof pr === "object") {
        setRules({
          read:   Array.isArray(pr.read)   ? pr.read.map(targetToString)   : [],
          create: Array.isArray(pr.create) ? pr.create.map(targetToString) : [],
          update: Array.isArray(pr.update) ? pr.update.map(targetToString) : [],
          delete: Array.isArray(pr.delete) ? pr.delete.map(targetToString) : [],
        })
      } else {
        setRules({ read: [], create: [], update: [], delete: [] })
      }
    } catch {
      setRules({ read: [], create: [], update: [], delete: [] })
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug])

  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  /* ---- Save ---- */
  const saveRules = async (newRules: Record<Action, string[]>) => {
    setSaving(true)
    try {
      // Build payload: only include actions that have targets
      const payload: Record<string, string[]> = {}
      for (const action of ACTIONS) {
        if (newRules[action].length > 0) {
          payload[action] = newRules[action]
        }
      }
      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`,
        { permission_rules: Object.keys(payload).length > 0 ? payload : null }
      )
      toast({ message: "Permissions saved", type: "success" })
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to save permissions"
      toast({ message: msg, type: "error" })
      // Revert on failure
      fetchPermissions()
    } finally {
      setSaving(false)
    }
  }

  /* ---- Mutators ---- */
  const addTarget = (action: Action, target: string) => {
    if (rules[action].includes(target)) return
    const newRules = { ...rules, [action]: [...rules[action], target] }
    setRules(newRules)
    saveRules(newRules)
  }

  const removeTarget = (action: Action, target: string) => {
    const newRules = { ...rules, [action]: rules[action].filter((t) => t !== target) }
    setRules(newRules)
    saveRules(newRules)
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`,
        { permission_rules: null }
      )
      setRules({ read: [], create: [], update: [], delete: [] })
      toast({ message: "All permissions cleared", type: "success" })
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to clear permissions"
      toast({ message: msg, type: "error" })
    } finally {
      setClearing(false)
      setClearDialogOpen(false)
    }
  }

  /* ---- Quick presets ---- */
  const applyPublicRead = () => {
    const newRules = { ...rules, read: rules.read.includes("any") ? rules.read : [...rules.read, "any"] }
    setRules(newRules)
    saveRules(newRules)
  }

  const applyOwnerOnly = () => {
    const newRules: Record<Action, string[]> = {
      read: ["owner"],
      create: ["any"],
      update: ["owner"],
      delete: ["owner"],
    }
    setRules(newRules)
    saveRules(newRules)
  }

  const applyFullAccess = () => {
    const newRules: Record<Action, string[]> = {
      read: ["any"],
      create: ["any"],
      update: ["any"],
      delete: ["any"],
    }
    setRules(newRules)
    saveRules(newRules)
  }

  const totalTargets = ACTIONS.reduce((sum, a) => sum + rules[a].length, 0)
  const configuredActions = ACTIONS.filter((a) => rules[a].length > 0).length

  return (
    <div className={cn("flex flex-col gap-6", !embedded && "p-4 sm:p-6 lg:p-8")}>
      {/* Header */}
      {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
              <Shield className="size-5 text-foreground stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                  Permissions
                </h1>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Define who can read, create, update, and delete documents in this collection.
              </p>
            </div>
          </div>
          {totalTargets > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setClearDialogOpen(true)}
            >
              <RotateCcw className="size-3.5" />
              Clear all
            </Button>
          )}
        </div>
      )}

      {/* Embedded header with clear button */}
      {embedded && totalTargets > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap px-4 py-2.5 bg-card rounded-lg border border-border flex-1">
            <div className="flex items-center gap-2">
              <Shield className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{configuredActions}</span> of 4 actions configured
              </span>
            </div>
            <div className="h-3.5 w-px bg-border" />
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{totalTargets}</span> total target{totalTargets !== 1 ? "s" : ""}
            </span>
            {saving && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Loader2 className="size-3 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Saving...</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="ml-3 shrink-0"
            onClick={() => setClearDialogOpen(true)}
          >
            <RotateCcw className="size-3.5" />
            Clear all
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Quick presets (only show when no rules configured) */}
          {totalTargets === 0 && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center justify-center size-12 rounded-xl bg-secondary mb-3">
                  <Shield className="size-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No permission rules configured</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Without permission rules, access is controlled by the collection visibility setting. Add rules below to each action, or start with a preset.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Button size="sm" variant="outline" className="border-border text-xs h-8" onClick={applyPublicRead}>
                    Public read
                  </Button>
                  <Button size="sm" variant="outline" className="border-border text-xs h-8" onClick={applyOwnerOnly}>
                    Owner only
                  </Button>
                  <Button size="sm" variant="outline" className="border-border text-xs h-8" onClick={applyFullAccess}>
                    Full public access
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Action rows */}
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {ACTIONS.map((action) => {
              const meta = ACTION_META[action]
              const Icon = meta.icon
              const targets = rules[action]
              const hasTargets = targets.length > 0

              return (
                <div key={action} className="flex flex-col">
                  {/* Action header */}
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 transition-colors",
                    hasTargets ? "bg-card" : "bg-card/50"
                  )}>
                    <div className={cn(
                      "flex items-center justify-center size-8 rounded-lg shrink-0",
                      hasTargets ? "bg-primary/10" : "bg-secondary"
                    )}>
                      <Icon className={cn("size-4", hasTargets ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{meta.label}</p>
                        {hasTargets && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {targets.length} target{targets.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{meta.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <TargetPicker
                        onAdd={(target) => addTarget(action, target)}
                        existingTargets={targets}
                      />
                      <RolePicker
                        dbId={dbId}
                        action={action}
                        existingTargets={targets}
                        onAdd={(target) => addTarget(action, target)}
                      />
                    </div>
                  </div>

                  {/* Targets list */}
                  {hasTargets && (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 bg-background/50">
                      {targets.map((target) => (
                        <TargetBadge
                          key={target}
                          target={target}
                          onRemove={() => removeTarget(action, target)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Quick presets (when already configured) */}
          {totalTargets > 0 && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">Quick presets:</span>
              <button
                onClick={applyPublicRead}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                Public read
              </button>
              <button
                onClick={applyOwnerOnly}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                Owner only
              </button>
              <button
                onClick={applyFullAccess}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
              >
                Full public access
              </button>
            </div>
          )}
        </div>
      )}

      {/* Clear All Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
              <div>
                <DialogTitle className="text-foreground">Clear all permissions</DialogTitle>
                <DialogDescription className="mt-1">
                  This will remove all permission rules from this collection.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 mt-2">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs text-foreground">
                <p className="font-medium">This action affects:</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  <li>{totalTargets} permission target{totalTargets !== 1 ? "s" : ""} across {configuredActions} action{configuredActions !== 1 ? "s" : ""}</li>
                  <li>Access will fall back to collection visibility setting</li>
                  <li>You can reconfigure permissions after clearing</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleClearAll} disabled={clearing}>
              {clearing ? (
                <><Loader2 className="size-4 animate-spin" />Clearing...</>
              ) : (
                <><RotateCcw className="size-4" />Clear all permissions</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
