"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  Save,
  Trash2,
  AlertTriangle,
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
import axiosInstance from "@/lib/axios-instance"
import { setDbName } from "@/components/dashboard-sidebar"
import { useToast } from "@/components/custom-toast"
import { useDatabaseContext } from "../layout"
import { DatabaseHeader } from "@/components/database-header"

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const { toast } = useToast()
  const { db, setDb } = useDatabaseContext()

  const [editName, setEditName] = useState(db?.name || "")
  const [editDesc, setEditDesc] = useState(db?.description || "")
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  const basePath = `/${teamSlug}/${projectSlug}`

  const handleSaveSettings = async () => {
    setSaving(true)
    try {
      await axiosInstance.db.patch(`/v1/db/databases/${dbId}`, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
      })
      setDbName(dbId, editName.trim())
      setDb((prev) =>
        prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev
      )
      toast({ message: "Database settings saved", type: "success" })
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to save settings"
      toast({ message: msg, type: "error" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDatabase = async () => {
    try {
      await axiosInstance.db.delete(`/v1/db/databases/${dbId}`)
      toast({ message: "Database deleted", type: "error" })
      router.replace(`${basePath}/databases`)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to delete database"
      toast({ message: msg, type: "error" })
    }
  }

  return (
    <>
    <DatabaseHeader />
    <div className="p-4 sm:p-6 lg:p-8 pt-6">
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-card">
          <h2 className="text-sm font-semibold text-foreground">General</h2>
        </div>
        <div className="p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 max-w-md">
            <label className="text-sm font-medium text-foreground">Database name</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder="A brief description..."
              className="bg-secondary border-border"
            />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <label className="text-sm font-medium text-foreground">Database ID</label>
            <Input
              value={dbId}
              readOnly
              className="bg-secondary border-border font-mono text-muted-foreground cursor-not-allowed"
            />
          </div>
          <Button onClick={handleSaveSettings} disabled={saving} className="w-fit mt-2">
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-xl border border-destructive/30 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
          </div>
        </div>
        <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this database</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              All collections and documents in this database will be permanently removed.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" />
            Delete database
          </Button>
        </div>
      </div>

      {/* Delete database dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete database</DialogTitle>
            <DialogDescription>
              {'This action cannot be undone. Type '}
              <span className="font-mono font-semibold text-foreground">
                {db?.name || dbId}
              </span>
              {' to confirm.'}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={db?.name || dbId}
            className="bg-secondary border-border font-mono"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== (db?.name || dbId)}
              onClick={handleDeleteDatabase}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
    </>
  )
}
