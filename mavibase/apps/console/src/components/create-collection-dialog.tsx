"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface CreateCollectionDialogProps {
  dbId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}

export function CreateCollectionDialog({
  dbId,
  open,
  onOpenChange,
  onCreated,
}: CreateCollectionDialogProps) {
  const [name, setName] = useState("")
  const [customId, setCustomId] = useState("")
  const [description, setDescription] = useState("")
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ message: "Collection name is required", type: "error" })
      return
    }
    setCreating(true)
    try {
      await axiosInstance.db.post(`/v1/db/databases/${dbId}/collections`, {
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
        "Failed to create collection"
      toast({ message: msg, type: "error" })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md bg-popover border-border">
        <SheetHeader className="px-6">
          <SheetTitle className="text-foreground">Create collection</SheetTitle>
          <SheetDescription>
            Add a new collection to this database to organize your data.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-6 py-4 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Name</label>
            <Input
              placeholder="Enter collection name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-secondary border-border"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleCreate()
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Collection ID
            </label>
            <p className="text-xs text-muted-foreground">
              Enter a custom Collection ID. Leave blank for a randomly generated one.
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
            <p className="text-xs text-muted-foreground">
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
          <Button variant="outline" className="border-border" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim()}>
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
