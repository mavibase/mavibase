"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
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

interface CompareResult {
  version1: DocumentVersion | null
  version2: DocumentVersion | null
  changes: string[]
  added: { path: string; value: unknown }[]
  removed: { path: string; value: unknown }[]
  modified: { path: string; oldValue: unknown; newValue: unknown }[]
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "null"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export function VersionCompareContent() {
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const collectionSlug = params.collectionSlug as string
  const documentId = params.documentId as string
  const versionNumber = Number(params.versionNumber as string)
  const { toast } = useToast()

  const prevVersion = versionNumber - 1

  const [comparison, setComparison] = useState<CompareResult | null>(null)
  const [loading, setLoading] = useState(true)

  const basePath = `/${teamSlug}/${projectSlug}`
  const documentsPath = `${basePath}/databases/${dbId}/${collectionSlug}/documents`
  const versionsPath = `${documentsPath}/${documentId}/versions`

  const fetchComparison = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.db.get(
        `/v1/db/databases/${dbId}/collections/${collectionSlug}/documents/${documentId}/versions/compare/${prevVersion}/${versionNumber}`
      )
      setComparison(res.data?.data || null)
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to load comparison"
      toast({ message: msg, type: "error" })
      setComparison(null)
    } finally {
      setLoading(false)
    }
  }, [dbId, collectionSlug, documentId, prevVersion, versionNumber, toast])

  useEffect(() => {
    fetchComparison()
  }, [fetchComparison])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!comparison || !comparison.version1 || !comparison.version2) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-sm text-muted-foreground font-sans">Could not load comparison data.</p>
        <Button variant="outline" size="sm" className="border-border" asChild>
          <Link href={versionsPath}>
            <ArrowLeft className="size-3.5" />
            Back to versions
          </Link>
        </Button>
      </div>
    )
  }

  const { version1: v1, version2: v2, added, removed, modified } = comparison

  const allKeys = new Set([
    ...Object.keys(v1!.data),
    ...Object.keys(v2!.data),
  ])

  const addedKeys = new Set(added.map((a) => a.path))
  const removedKeys = new Set(removed.map((r) => r.path))
  const modifiedKeys = new Set(modified.map((m) => m.path))

  const sortedKeys = [...allKeys].sort((a, b) => {
    const order = (k: string) => {
      if (modifiedKeys.has(k)) return 1
      if (addedKeys.has(k)) return 2
      if (removedKeys.has(k)) return 3
      return 0
    }
    return order(a) - order(b)
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="size-8 border-border" asChild>
          <Link href={versionsPath}>
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to versions</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground font-sans">
            Comparing v{prevVersion} with v{versionNumber}
          </h1>
          <p className="text-sm text-muted-foreground font-sans">
            {comparison.changes.length} change{comparison.changes.length !== 1 ? "s" : ""} detected
          </p>
        </div>
      </div>

      {/* Diff view */}
      <div className="rounded-lg border border-border overflow-hidden font-mono text-sm">
        {sortedKeys.map((key, i) => {
          const isAdded = addedKeys.has(key)
          const isRemoved = removedKeys.has(key)
          const isModified = modifiedKeys.has(key)

          if (isModified) {
            const mod = modified.find((m) => m.path === key)!
            return (
              <div key={key}>
                <div className={cn(
                  "flex items-start gap-3 px-4 py-2 border-b border-border",
                  "bg-red-500/10"
                )}>
                  <span className="text-red-400 shrink-0 w-3 text-center select-none">-</span>
                  <span className="text-red-400">
                    {key}: {formatValue(mod.oldValue)}
                  </span>
                </div>
                <div className={cn(
                  "flex items-start gap-3 px-4 py-2",
                  i < sortedKeys.length - 1 && "border-b border-border",
                  "bg-green-500/10"
                )}>
                  <span className="text-green-400 shrink-0 w-3 text-center select-none">+</span>
                  <span className="text-green-400">
                    {key}: {formatValue(mod.newValue)}
                  </span>
                </div>
              </div>
            )
          }

          if (isRemoved) {
            const rem = removed.find((r) => r.path === key)!
            return (
              <div
                key={key}
                className={cn(
                  "flex items-start gap-3 px-4 py-2 bg-red-500/10",
                  i < sortedKeys.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-red-400 shrink-0 w-3 text-center select-none">-</span>
                <span className="text-red-400">
                  {key}: {formatValue(rem.value)}
                </span>
              </div>
            )
          }

          if (isAdded) {
            const add = added.find((a) => a.path === key)!
            return (
              <div
                key={key}
                className={cn(
                  "flex items-start gap-3 px-4 py-2 bg-green-500/10",
                  i < sortedKeys.length - 1 && "border-b border-border"
                )}
              >
                <span className="text-green-400 shrink-0 w-3 text-center select-none">+</span>
                <span className="text-green-400">
                  {key}: {formatValue(add.value)}
                </span>
              </div>
            )
          }

          const value = v2!.data[key]
          return (
            <div
              key={key}
              className={cn(
                "flex items-start gap-3 px-4 py-2",
                i < sortedKeys.length - 1 && "border-b border-border"
              )}
            >
              <span className="text-muted-foreground shrink-0 w-3 text-center select-none">&nbsp;</span>
              <span className="text-muted-foreground">
                {key}: {formatValue(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
