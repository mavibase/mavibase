"use client"

import { useState } from "react"
import { Trash2, AlertTriangle, Save, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { useAuthContext } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"

const ENVIRONMENTS = [
  { value: "development", label: "Development", hint: "Local iteration and testing" },
  { value: "staging",     label: "Staging",     hint: "Pre-production QA"          },
  { value: "production",  label: "Production",  hint: "Live environment"            },
]

interface ProjectSettingsProps {
  project: {
    id: string
    name: string
    description: string | null
    environment: string
  }
  onUpdate?: () => void
}

export function ProjectSettings({ project, onUpdate }: ProjectSettingsProps) {
  const router = useRouter()
  const { refreshUser } = useAuthContext()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || "")
  const [environment, setEnvironment] = useState(project.environment)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const hasChanges =
    name !== project.name ||
    description !== (project.description || "") ||
    environment !== project.environment

  const handleSave = async () => {
    if (!name.trim()) return
    setIsSaving(true)
    try {
      await axiosInstance.auth.patch(`/projects/${project.id}`, {
        name: name.trim(),
        description: description.trim() || null,
        environment,
      })
      toast.success("Project settings updated")
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to update project")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await axiosInstance.auth.delete(`/projects/${project.id}`)
      toast.success("Project deleted successfully")
      await refreshUser()
      router.push("/")
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to delete project")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-8">
      {/* General Settings */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Project name
            </label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
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
              placeholder="A short description of your project"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Project ID
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={project.id}
                readOnly
                className="flex-1 bg-muted text-muted-foreground font-mono"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(project.id)
                  toast.success("Copied to clipboard")
                }}
              >
                <Copy className="size-3.5 mr-1.5" />
                Copy
              </Button>
            </div>
          </div>

          {/* Environment */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-2">
              Environment
            </label>
            <div className="grid grid-cols-1 gap-2">
              {ENVIRONMENTS.map((env) => {
                const isSelected = environment === env.value
                return (
                  <button
                    key={env.value}
                    type="button"
                    onClick={() => setEnvironment(env.value)}
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
                        {env.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{env.hint}</p>
                    </div>
                  </button>
                )
              })}
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
      </div>

      {/* Danger Zone */}
      <div className="border-t border-border pt-8">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Permanently delete this project and all of its data, including databases, API keys, and
          functions. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="size-3.5 mr-1.5" />
          Delete project
        </Button>
      </div>

      {/* Delete Project Sheet */}
      <Sheet open={deleteOpen} onOpenChange={setDeleteOpen}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <SheetTitle>Delete Project</SheetTitle>
            </div>
            <SheetDescription>
              This will permanently delete <strong>{project.name}</strong> and all associated
              data. Type <strong>{project.name}</strong> to confirm.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={project.name}
            />
          </SheetBody>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false)
                setDeleteConfirm("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirm !== project.name || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Project"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
