"use client"

import { useState, useEffect } from "react"
import { BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import axiosInstance from "@/lib/axios-instance"

interface UsageData {
  tier?: string
  quotas?: {
    api_requests?: number
    storage_gb?: number
    bandwidth_gb?: number
    databases?: number
  }
  usage?: {
    api_requests?: number
    storage_bytes?: number
    bandwidth_bytes?: number
    databases?: number
  }
}

function UsageBar({ label, used, total, unit }: { label: string; used: number; total: number; unit: string }) {
  const safeUsed = Number(used) || 0
  const safeTotal = Number(total) || 0
  const percentage = safeTotal > 0 ? Math.min((safeUsed / safeTotal) * 100, 100) : 0
  const isHigh = percentage > 80

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">
          {safeUsed.toLocaleString()} / {safeTotal.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}% used</p>
    </div>
  )
}

export function ProjectUsage({ projectId }: { projectId: string }) {
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsage()
  }, [projectId])

  const fetchUsage = async () => {
    try {
      const response = await axiosInstance.auth.get(`/projects/${projectId}/usage`)
      if (response.data.success) {
        setUsage(response.data.data || null)
      }
    } catch (error) {
      console.error("Failed to fetch usage:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="bg-muted w-48 h-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border rounded-lg bg-card p-4">
              <Skeleton className="bg-muted w-24 h-4 mb-4" />
              <Skeleton className="bg-muted w-full h-3 mb-2" />
              <Skeleton className="bg-muted w-full h-2 mb-2" />
              <Skeleton className="bg-muted w-16 h-3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!usage) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium text-foreground">No usage data available</p>
        <p className="text-xs text-muted-foreground mt-1">Usage metrics will appear here once the project starts receiving traffic.</p>
      </div>
    )
  }

  const storageUsedGB = (usage.usage?.storage_bytes || 0) / (1024 * 1024 * 1024)
  const bandwidthUsedGB = (usage.usage?.bandwidth_bytes || 0) / (1024 * 1024 * 1024)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-medium text-foreground">Resource Usage</h2>
          {usage.tier && (
            <p className="text-sm text-muted-foreground">
              Current billing period &middot; <span className="capitalize">{usage.tier}</span> tier
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageBar
              label="Monthly Requests"
              used={usage.usage?.api_requests || 0}
              total={usage.quotas?.api_requests || 0}
              unit=""
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Databases</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageBar
              label="Active Databases"
              used={usage.usage?.databases || 0}
              total={usage.quotas?.databases || 0}
              unit=""
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageBar
              label="Storage Used"
              used={Number(storageUsedGB.toFixed(2))}
              total={usage.quotas?.storage_gb || 0}
              unit="GB"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
          </CardHeader>
          <CardContent>
            <UsageBar
              label="Bandwidth Used"
              used={Number(bandwidthUsedGB.toFixed(2))}
              total={usage.quotas?.bandwidth_gb || 0}
              unit="GB"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
