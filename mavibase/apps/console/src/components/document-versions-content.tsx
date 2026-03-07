"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Eye, GitCompareArrows, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
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

function describeVersion(v: DocumentVersion, prev: DocumentVersion | null): string {
  if (v.version === 1) return "Document created"
  if (!prev) return "Document updated"

  const prevKeys = new Set(Object.keys(prev.data))
  const currKeys = new Set(Object.keys(v.data))
  const changes: string[] = []

  for (const key of currKeys) {
    if (!prevKeys.has(key)) changes.push(`added ${key}`)
  }
  for (const key of prevKeys) {
    if (!currKeys.has(key)) changes.push(`removed ${key}`)
  }
  for (const key of currKeys) {
    if (prevKeys.has(key) && JSON.stringify(prev.data[key]) !== JSON.stringify(v.data[key])) {
      const oldVal = JSON.stringify(prev.data[key])
      const newVal = JSON.stringify(v.data[key])
      if (oldVal.length < 30 && newVal.length < 30) {
        changes.push(`changed ${key} from ${oldVal} to ${newVal}`)
      } else {
        changes.push(`changed ${key}`)
      }
    }
  }

  if (changes.length === 0) return "Document updated"
  if (changes.length <= 2) return changes.join(", ").replace(/^./, (c) => c.toUpperCase())
  return `${changes.slice(0, 2).join(", ")} and ${changes.length - 2} more`.replace(/^./, (c) => c.toUpperCase())
}

export function DocumentVersionsContent() {
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const documentId = params.documentId as string
  const { toast } = useToast()

  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [versioningEnabled, setVersioningEnabled] = useState(true)

  const basePath = `/${teamSlug}/${projectSlug}`
  const documentsPath = `${basePath}/databases/${dbId}/${collectionSlug}/documents`
  const versionsBase = `${documentsPath}/${documentId}/versions`

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/${documentId}/versions`
      )
      setVersions(res.data?.data || [])
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load versions"
      toast({ message: msg, type: "error" })
      setVersions([])
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, documentId, toast])

  useEffect(() => {
    axiosInstance.db
      .get("/v1/db/config")
      .then((res) => {
        setVersioningEnabled(res.data?.data?.versioning_enabled ?? true)
      })
      .catch(() => setVersioningEnabled(true))
  }, [])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const sorted = [...versions].sort((a, b) => b.version - a.version)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="size-8 border-border" asChild>
          <Link href={documentsPath}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to documents</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground font-sans">Version history</h1>
          <p className="text-sm text-muted-foreground font-mono truncate max-w-[300px]" title={documentId}>{documentId}</p>
        </div>
      </div>

      {/* Versioning disabled warning */}
      {!versioningEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground font-sans">Versioning is disabled</p>
            <p className="text-sm text-muted-foreground mt-0.5 font-sans">
              Document versioning is currently turned off. New changes will not be tracked.
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground font-sans">
          No versions found for this document.
        </div>
      ) : (
        <div className="relative ml-4">
          {/* Vertical line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {sorted.map((v, idx) => {
              const prev = sorted[idx + 1] ?? null
              const isFirst = v.version === 1
              const description = describeVersion(v, prev)

              return (
                <div key={v.id} className="relative flex gap-4 pb-7 last:pb-0">
                  {/* Version badge */}
                  <div className="relative z-10 flex items-center justify-center size-7 rounded-full border border-border bg-card text-[10px] font-semibold text-foreground shrink-0 font-mono">
                    v{v.version}
                  </div>

                  {/* Content */}
                  <div className="flex flex-col gap-2 pt-0.5 flex-1 min-w-0">
                    <div>
                      <p className="text-sm font-semibold text-foreground font-sans">
                        {isFirst ? "Created" : "Updated"}
                      </p>
                      <p className="text-sm text-muted-foreground font-sans truncate">{description}</p>
                      <p className="text-xs text-muted-foreground mt-1 font-sans">{formatDate(v.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 border-border" asChild>
                        <Link href={`${versionsBase}/${v.version}`}>
                          <Eye className="size-3.5" />
                          View Snapshot
                        </Link>
                      </Button>
                      {!isFirst && prev && (
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5 border-border" asChild>
                          <Link href={`${versionsBase}/${v.version}/compare`}>
                            <GitCompareArrows className="size-3.5" />
                            Compare with v{prev.version}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
