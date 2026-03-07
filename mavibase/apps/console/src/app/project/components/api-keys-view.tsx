"use client"

import { useState, useEffect } from "react"
import { Key, MoreHorizontal, RefreshCw, Copy, Check, Ban, Trash2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"
import { CreateApiKeyDialog } from "./create-api-key-dialog"

const SCOPE_LABELS: Record<string, string> = {
  "*": "Full Access",
  "databases:read": "Read",
  "databases:write": "Write",
  "databases:delete": "Delete",
  // Legacy scope formats (for backward compatibility)
  "database:read": "Read",
  "database:write": "Write",
  "database:delete": "Delete",
  "read:databases": "Read",
  "write:databases": "Write",
  "delete:databases": "Delete",
}

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[] | null
  status: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
}

export function ApiKeysView({ projectId }: { projectId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)
  const [rotateTarget, setRotateTarget] = useState<ApiKey | null>(null)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchKeys()
  }, [projectId])

  const fetchKeys = async () => {
    try {
      const response = await axiosInstance.auth.get(`/api-keys/project/${projectId}`)
      if (response.data.success) {
        setKeys(response.data.data.keys)
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      await axiosInstance.auth.post(`/api-keys/${revokeTarget.id}/revoke`, { projectId })
      toast.success("API key revoked")
      setRevokeTarget(null)
      fetchKeys()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to revoke key")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await axiosInstance.auth.delete(`/api-keys/${deleteTarget.id}`, { data: { projectId } })
      toast.success("API key deleted")
      setDeleteTarget(null)
      fetchKeys()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to delete key")
    }
  }

  const handleRotate = async () => {
    if (!rotateTarget) return
    try {
      const response = await axiosInstance.auth.post(`/api-keys/${rotateTarget.id}/rotate`, { projectId })
      if (response.data.success) {
        setNewKeyValue(response.data.data.key || response.data.data.rawKey)
        toast.success("API key rotated. Save the new key now.")
        setRotateTarget(null)
        fetchKeys()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to rotate key")
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Key className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                API Keys [ {loading ? <Skeleton className="h-3 w-4"/> : `${keys.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Manage API keys for this project.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          Create API Key
        </Button>
      </div>

      {/* New key reveal sheet */}
      <Sheet open={!!newKeyValue} onOpenChange={(open) => { if (!open) setNewKeyValue(null) }}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-foreground" />
              <SheetTitle>API Key Created</SheetTitle>
            </div>
            <SheetDescription>
              {"Copy your new API key now. You won't be able to see it again."}
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-4">
            <code className="w-full bg-muted rounded-md px-3 py-2.5 text-sm font-mono border border-border break-all select-all">
              {newKeyValue}
            </code>
            <Button
              variant="outline"
              onClick={() => newKeyValue && handleCopy(newKeyValue)}
              className="gap-1.5 w-full"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied to clipboard" : "Copy to clipboard"}
            </Button>
          </SheetBody>
          <SheetFooter>
            <Button onClick={() => setNewKeyValue(null)}>
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Content */}
      {loading ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-card">
                  <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                    <span className="text-[11px] text-muted-foreground">#</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[140px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Name</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Key</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Status</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Created</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Scopes</span>
                  </th>
                  <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="px-3 pt-3 py-8 text-center">
                    <Skeleton className="bg-muted w-full h-5"/>
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : keys.length === 0 ? (
        <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
            <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
              <Key className="size-5" strokeWidth={1.5} />
            </div>
            <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
              No API Keys
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
              Create an API key to authenticate requests to your project.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              <Button onClick={() => setCreateOpen(true)}>
                Create API Key
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
            <svg
              viewBox="0 0 600 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
              preserveAspectRatio="none"
            >
              <path d="M-20 140 C60 140, 100 60, 180 80 S300 140, 400 100 S520 30, 620 60" stroke="currentColor" className="text-primary/10" strokeWidth="1.5" fill="none" />
              <path d="M-20 135 C80 130, 120 50, 200 75 S320 145, 420 95 S540 25, 620 55" stroke="currentColor" className="text-primary/10" strokeWidth="1.2" fill="none" />
              <path d="M-20 130 C50 120, 90 70, 170 90 S290 130, 390 85 S510 40, 620 70" stroke="currentColor" className="text-primary/15" strokeWidth="1.5" fill="none" />
              <path d="M-20 125 C70 110, 110 65, 190 85 S310 135, 410 80 S530 35, 620 65" stroke="currentColor" className="text-primary/15" strokeWidth="1.2" fill="none" />
              <path d="M-20 118 C40 100, 80 80, 160 95 S280 120, 380 70 S500 50, 620 80" stroke="currentColor" className="text-primary/20" strokeWidth="1.5" fill="none" />
              <path d="M-20 112 C60 95, 100 75, 180 90 S300 125, 400 65 S520 45, 620 75" stroke="currentColor" className="text-primary/20" strokeWidth="1.2" fill="none" />
              <path d="M-20 105 C30 85, 70 90, 150 100 S270 110, 370 55 S490 60, 620 85" stroke="currentColor" className="text-primary/25" strokeWidth="1.5" fill="none" />
              <path d="M-20 100 C50 78, 90 85, 170 95 S290 115, 390 50 S510 55, 620 80" stroke="currentColor" className="text-primary/25" strokeWidth="1.2" fill="none" />
              <path d="M-20 92 C20 70, 60 95, 140 105 S260 100, 360 42 S480 65, 620 90" stroke="currentColor" className="text-primary/30" strokeWidth="1.5" fill="none" />
              <path d="M-20 86 C40 65, 80 100, 160 108 S280 95, 380 38 S500 60, 620 85" stroke="currentColor" className="text-primary/30" strokeWidth="1.2" fill="none" />
              <path d="M-20 148 C90 150, 130 50, 210 70 S340 148, 440 108 S560 20, 620 50" stroke="currentColor" className="text-chart-1/8" strokeWidth="1" fill="none" />
              <path d="M-20 80 C10 55, 50 100, 130 110 S250 90, 350 35 S470 70, 620 95" stroke="currentColor" className="text-chart-2/8" strokeWidth="1" fill="none" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-card">
                  <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                    <span className="text-[11px] text-muted-foreground">#</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[140px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Name</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Key</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Status</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Created</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Scopes</span>
                  </th>
                  <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {keys.map((key, idx) => {
                  const isActive = key.status === "active"
                  const rowNum = idx + 1
                  return (
                    <tr key={key.id} className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                      <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{rowNum}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 min-w-[140px]">
                        <span className="text-sm font-medium text-foreground font-sans">{key.name}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <code className="text-xs text-muted-foreground">{key.key_prefix}...</code>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <Badge
                          variant="outline"
                          className={isActive
                            ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                            : "bg-muted text-muted-foreground border-border"
                          }
                        >
                          {key.status}
                        </Badge>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatDate(key.created_at)}
                      </td>
                      <td className="border-r border-border px-3 py-1.5 hidden md:table-cell">
                        {key.scopes && key.scopes.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {key.scopes.slice(0, 2).map((scope) => (
                              <Badge key={scope} variant="secondary" className="text-xs">
                                {SCOPE_LABELS[scope] || scope}
                              </Badge>
                            ))}
                            {key.scopes.length > 2 && (
                              <Badge variant="secondary" className="text-xs">+{key.scopes.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground font-sans">Full access</span>
                        )}
                      </td>
                      <td className="px-1 py-1">
                        <div className="flex items-center justify-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isActive && (
                                <>
                                  <DropdownMenuItem onClick={() => setRotateTarget(key)}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Rotate Key
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => setRevokeTarget(key)}
                                    className="text-amber-600 focus:text-amber-600"
                                  >
                                    <Ban className="w-4 h-4 mr-2" />
                                    Revoke Key
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(key)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Key
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-card/50">
            <p className="text-xs text-muted-foreground">
              {keys.length} API key{keys.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      <CreateApiKeyDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(rawKey) => {
          setNewKeyValue(rawKey)
          fetchKeys()
        }}
      />

      {/* Revoke sheet */}
      <Sheet open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <SheetTitle>Revoke API Key</SheetTitle>
            </div>
            <SheetDescription>
              Revoking <strong>{revokeTarget?.name}</strong> will immediately invalidate all requests using this key. This cannot be undone.
            </SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke}>
              Revoke Key
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete sheet */}
      <Sheet open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              <SheetTitle>Delete API Key</SheetTitle>
            </div>
            <SheetDescription>
              Permanently delete <strong>{deleteTarget?.name}</strong>. This cannot be undone.
            </SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Key
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rotate sheet */}
      <Sheet open={!!rotateTarget} onOpenChange={() => setRotateTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-foreground" />
              <SheetTitle>Rotate API Key</SheetTitle>
            </div>
            <SheetDescription>
              This will generate a new key and immediately revoke <strong>{rotateTarget?.name}</strong>. Make sure to update your applications with the new key.
            </SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button variant="outline" onClick={() => setRotateTarget(null)}>Cancel</Button>
            <Button onClick={handleRotate}>
              Rotate Key
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
