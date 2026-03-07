"use client"

import { useState, useEffect } from "react"
import { Key, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"
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

const AVAILABLE_SCOPES = [
  { id: "*", label: "Full Access", description: "Complete access to all resources" },
  { id: "databases:read", label: "Databases Read", description: "Read databases, collections, documents" },
  { id: "databases:write", label: "Databases Write", description: "Create and update databases, collections, documents" },
  { id: "databases:delete", label: "Databases Delete", description: "Delete databases, collections, documents" },
]

const EXPIRY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
]

interface CreateApiKeyDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (rawKey: string) => void
}

export function CreateApiKeyDialog({ projectId, open, onOpenChange, onSuccess }: CreateApiKeyDialogProps) {
  const [name, setName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiry, setExpiry] = useState("never")
  const [showExpiryDropdown, setShowExpiryDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setName("")
      setSelectedScopes([])
      setExpiry("never")
      setShowExpiryDropdown(false)
    }
  }, [open])

  const toggleScope = (scope: string) => {
    if (scope === "*") {
      // If selecting full access, clear other scopes and only set *
      setSelectedScopes(prev => prev.includes("*") ? [] : ["*"])
    } else {
      // If selecting a specific scope, remove * if present
      setSelectedScopes(prev => {
        const withoutWildcard = prev.filter(s => s !== "*")
        return withoutWildcard.includes(scope)
          ? withoutWildcard.filter(s => s !== scope)
          : [...withoutWildcard, scope]
      })
    }
  }

  const hasFullAccess = selectedScopes.includes("*")

  const getExpiryDate = () => {
    if (expiry === "never") return undefined
    const now = new Date()
    switch (expiry) {
      case "30d": return new Date(now.setDate(now.getDate() + 30)).toISOString()
      case "90d": return new Date(now.setDate(now.getDate() + 90)).toISOString()
      case "1y": return new Date(now.setFullYear(now.getFullYear() + 1)).toISOString()
      default: return undefined
    }
  }

  const handleSubmit = async () => {
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      const response = await axiosInstance.auth.post("/api-keys", {
        projectId,
        name: name.trim(),
        scopes: selectedScopes.length > 0 ? selectedScopes : undefined,
        expiresAt: getExpiryDate(),
      })

      if (response.data.success) {
        const rawKey = response.data.data.key || response.data.data.rawKey
        toast.success("API key created successfully")
        setName("")
        setSelectedScopes([])
        setExpiry("never")
        onOpenChange(false)
        onSuccess(rawKey)
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to create API key")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedExpiry = EXPIRY_OPTIONS.find(o => o.value === expiry)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-foreground" />
            <SheetTitle>Create API Key</SheetTitle>
          </div>
          <SheetDescription>
            The key will only be shown once after creation. Make sure to copy it.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Key Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Backend"
              className="w-full h-10 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              autoFocus
            />
          </div>

          {/* Scopes */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Permissions
            </label>
            <div className="flex flex-col gap-2">
              {/* Full Access option - displayed separately */}
              <button
                type="button"
                onClick={() => toggleScope("*")}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                  hasFullAccess
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                  hasFullAccess ? "bg-primary border-primary" : "border-border"
                )}>
                  {hasFullAccess && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">Full Access</span>
                  <span className="text-xs text-muted-foreground">Complete access to all resources</span>
                </div>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or select specific permissions</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Specific scopes */}
              <div className="grid grid-cols-1 gap-2">
                {AVAILABLE_SCOPES.filter(s => s.id !== "*").map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => toggleScope(scope.id)}
                    disabled={hasFullAccess}
                    className={cn(
                      "flex items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
                      selectedScopes.includes(scope.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50",
                      hasFullAccess && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      selectedScopes.includes(scope.id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedScopes.includes(scope.id) && (
                        <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{scope.label}</span>
                      <span className="text-xs text-muted-foreground">{scope.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedScopes.length === 0 
                ? "No permissions selected. The key will have full access by default."
                : hasFullAccess 
                  ? "Full access grants all permissions."
                  : `${selectedScopes.length} permission${selectedScopes.length > 1 ? "s" : ""} selected.`
              }
            </p>
          </div>

          {/* Expiry */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Expiration</label>
            <div className="relative">
              <button
                onClick={() => setShowExpiryDropdown(!showExpiryDropdown)}
                className="w-full h-10 px-3 text-sm border border-border rounded-md bg-background text-foreground flex items-center justify-between hover:border-primary/40 transition-colors"
              >
                <span>{selectedExpiry.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showExpiryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setExpiry(opt.value); setShowExpiryDropdown(false) }}
                      className={cn(
                        "w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors",
                        expiry === opt.value ? "bg-primary/10 text-primary" : "text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Key"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
