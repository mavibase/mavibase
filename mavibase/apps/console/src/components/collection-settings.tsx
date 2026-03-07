"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Save,
  Loader2,
  AlertTriangle,
  Trash2,
  Copy,
  Settings,
} from "lucide-react"
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
import { cn } from "@/lib/utils"

import { clearCollectionsCache } from "@/components/dashboard-sidebar"
import axiosInstance from "@/lib/axios-instance"

const VISIBILITY_OPTIONS = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can read documents in this collection",
  },
  {
    value: "private",
    label: "Private",
    description: "Only users with explicit permissions can access",
  },
  {
    value: "internal",
    label: "Internal",
    description: "Accessible to all authenticated users in the project",
  },
  {
    value: "team",
    label: "Team",
    description: "Only team members can access this collection",
  },
]

export function CollectionSettingsContent() {
  const params = useParams()
  const router = useRouter()
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const { toast } = useToast()

  const [collName, setCollName] = useState("")
  const [collDesc, setCollDesc] = useState("")
  const [visibility, setVisibility] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  const fetchCollection = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`
      )
      const col = res.data?.data
      if (col) {
        setCollName(col.name || "")
        setCollDesc(col.description || "")
        setVisibility(col.visibility || "")
      }
    } catch {
      // Fail gracefully
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug])

  useEffect(() => {
    fetchCollection()
  }, [fetchCollection])

  const handleSave = async () => {
    setSaving(true)
    try {
      await axiosInstance.db.patch(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`,
        {
          name: collName.trim(),
          description: collDesc.trim() || undefined,
          visibility: visibility || undefined,
        }
      )
      clearCollectionsCache(dbId)
      toast({ message: "Collection settings updated", type: "success" })
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to save settings"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await axiosInstance.db.delete(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}`
      )
      clearCollectionsCache(dbId)
      toast({ message: "Collection deleted", type: "error" })
      router.replace(`/${teamSlug}/${projectSlug}/databases/${dbId}`)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete collection"
      toast({ message: msg, type: "error" })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  const selectedVisibility = VISIBILITY_OPTIONS.find(v => v.value === visibility)

  return (
    <div className="w-full flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Settings className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Collection Settings
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Manage this collection&apos;s configuration.
            </p>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Collection name
          </label>
          <Input
            value={collName}
            onChange={(e) => setCollName(e.target.value)}
            placeholder="My Collection"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <span className="text-[10px] text-muted-foreground">Optional</span>
          </div>
          <Input
            value={collDesc}
            onChange={(e) => setCollDesc(e.target.value)}
            placeholder="A brief description..."
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Collection ID
          </label>
          <div className="flex items-center gap-2">
            <Input
              value={collectionSlug}
              readOnly
              className="flex-1 bg-muted text-muted-foreground font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(collectionSlug)
                toast({ message: "Copied to clipboard", type: "success" })
              }}
            >
              <Copy className="size-3.5 mr-1.5" />
              Copy
            </Button>
          </div>
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-2">
            Visibility
          </label>
          <div className="grid grid-cols-1 gap-2">
            {VISIBILITY_OPTIONS.map((opt) => {
              const isSelected = visibility === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVisibility(opt.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-border/80 hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "size-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                      isSelected ? "bg-primary border-primary" : "bg-transparent border-muted-foreground/40"
                    )}
                  >
                    {isSelected && (
                      <svg
                        viewBox="0 0 10 10"
                        className="size-2.5"
                        fill="none"
                        stroke="white"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1.5 5l2.5 2.5L8.5 2.5" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium leading-none",
                        isSelected ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {opt.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {selectedVisibility && (
            <div className="mt-3 rounded-md border border-border bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selectedVisibility.label}:</span>{" "}
                {selectedVisibility.description}
              </p>
            </div>
          )}
        </div>

        <div className="pt-2">
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5 mr-1.5" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete this collection and all of its documents. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5 mr-1.5" />
          Delete collection
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete collection</DialogTitle>
            <DialogDescription>
              {'This action cannot be undone. Type '}
              <span className="font-mono font-semibold text-foreground">{collName}</span>
              {' to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={collName}
            className="bg-secondary border-border font-mono"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== collName || deleting}
              onClick={handleDelete}
            >
              {deleting ? <><Loader2 className="size-4 animate-spin" /> Deleting...</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
