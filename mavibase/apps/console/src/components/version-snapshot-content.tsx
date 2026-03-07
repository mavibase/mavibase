"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, RotateCcw, Loader2, Braces, Table2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

interface DocumentVersion {
  id: string
  document_id: string
  collection_id: string
  data: Record<string, unknown>
  schema_version?: number
  version: number
  created_at: string
}

function formatDate(raw: string | Date | undefined) {
  if (!raw) return "-"
  const d = new Date(raw)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function VersionSnapshotContent() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const documentId = params.documentId as string
  const versionNumber = params.versionNumber as string
  const { toast } = useToast()

  const [version, setVersion] = useState<DocumentVersion | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [viewMode, setViewMode] = useState<"card" | "json">("card")

  const basePath = `/${teamSlug}/${projectSlug}`
  const documentsPath = `${basePath}/databases/${dbId}/${collectionSlug}/documents`
  const versionsPath = `${documentsPath}/${documentId}/versions`

  const fetchVersion = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/${documentId}/versions/${versionNumber}`
      )
      setVersion(res.data?.data || null)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load version"
      toast({ message: msg, type: "error" })
      setVersion(null)
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, documentId, versionNumber, toast])

  useEffect(() => {
    fetchVersion()
  }, [fetchVersion])

  const handleRestore = async () => {
    setRestoring(true)
    try {
      await axiosInstance.db.post(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/${documentId}/versions/${versionNumber}/restore`
      )
      toast({ message: `Document restored to version ${versionNumber}`, type: "success" })
      setRestoreOpen(false)
      router.push(versionsPath)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to restore version"
      toast({ message: msg, type: "error" })
    } finally {
      setRestoring(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!version) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-muted-foreground">Version not found.</p>
        <Button variant="outline" size="sm" className="border-border" asChild>
          <Link href={versionsPath}>
            <ArrowLeft className="size-3.5" />
            Back to versions
          </Link>
        </Button>
      </div>
    )
  }

  const entries = Object.entries(version.data)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="size-8 border-border" asChild>
            <Link href={versionsPath}>
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to versions</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground font-sans">
              Snapshot &mdash; v{versionNumber}
            </h1>
            <p className="text-sm text-muted-foreground font-sans">
              {formatDate(version.created_at)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-border bg-secondary p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "card"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Table2 className="size-3.5" />
              Card
            </button>
            <button
              type="button"
              onClick={() => setViewMode("json")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "json"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Braces className="size-3.5" />
              JSON
            </button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-border"
            onClick={() => setRestoreOpen(true)}
          >
            <RotateCcw className="size-3.5" />
            Restore this version
          </Button>
        </div>
      </div>

      {/* Data */}
      {viewMode === "card" ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full border-collapse">
            <tbody>
              {entries.map(([key, value], i) => (
                <tr
                  key={key}
                  className={cn(
                    "hover:bg-secondary/40 transition-colors",
                    i < entries.length - 1 ? "border-b border-border" : ""
                  )}
                >
                  <td className="border-r border-border px-4 py-2.5 text-sm text-muted-foreground font-mono font-medium w-[200px] bg-card">
                    {key}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-foreground font-mono break-all">
                    {typeof value === "object" && value !== null
                      ? JSON.stringify(value, null, 2)
                      : String(value ?? "null")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <pre className="p-4 text-sm font-mono text-foreground overflow-auto max-h-[70vh] whitespace-pre">
            {JSON.stringify(version.data, null, 2)}
          </pre>
        </div>
      )}

      {/* Restore dialog */}
      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-foreground font-sans">Restore to version {versionNumber}?</DialogTitle>
            <DialogDescription className="font-sans">
              This will overwrite the current document data with the snapshot from version {versionNumber}.
              A new version entry will be created to record this change. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button onClick={handleRestore} disabled={restoring}>
              {restoring && <Loader2 className="size-3.5 animate-spin" />}
              Restore version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
