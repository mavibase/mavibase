"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, Save, Copy } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface TeamSettingsProps {
  team: {
    id: string
    name: string
    slug: string
    description: string | null
    is_personal: boolean
  }
  onUpdate: () => void
}

export function TeamSettings({ team, onUpdate }: TeamSettingsProps) {
  const router = useRouter()
  const [name, setName] = useState(team.name)
  const [description, setDescription] = useState(team.description || "")
  const [isSaving, setIsSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const hasChanges = name !== team.name || description !== (team.description || "")

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await axiosInstance.auth.put(`/teams/${team.id}`, {
        name: name.trim(),
        description: description.trim() || null,
      })
      toast.success("Team settings updated")
      onUpdate()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to update team")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await axiosInstance.auth.delete(`/teams/${team.id}`)
      toast.success("Team deleted successfully")
      router.push("/")
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to delete team")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-8">
      {/* General Settings */}
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Team name
          </label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Team"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-foreground">
              Description
            </label>
            <span className="text-[10px] text-muted-foreground">Optional</span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            placeholder="A short description of your team"
            rows={3}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">
            Team ID
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={team.id}
              readOnly
              className="flex-1 bg-muted text-muted-foreground font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => { navigator.clipboard.writeText(team.id); toast.success("Copied to clipboard") }}
            >
              <Copy className="size-3.5 mr-1.5" />
              Copy
            </Button>
          </div>
        </div>

        {hasChanges && (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="w-full"
            >
              <Save className="size-3.5 mr-1.5" />
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete this team and all of its resources. This action cannot be undone.
        </p>
        {team.is_personal ? (
          <p className="text-xs text-muted-foreground italic">Personal teams cannot be deleted.</p>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5 mr-1.5" />
            Delete team
          </Button>
        )}
      </div>

      {/* Delete Team Sheet */}
      <Sheet open={deleteOpen} onOpenChange={setDeleteOpen}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <SheetTitle className="font-normal text-base">Delete Team</SheetTitle>
            </div>
            <SheetDescription className="text-[13px]">
              This will permanently delete <strong>{team.name}</strong> and all associated projects, databases, and API keys. Type <strong>{team.name}</strong> to confirm.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={team.name}
            />
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirm("") }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== team.name || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Team"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
