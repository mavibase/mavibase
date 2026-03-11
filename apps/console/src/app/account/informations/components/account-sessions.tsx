"use client"

import { useState, useEffect } from "react"
import { Monitor, Smartphone, Globe, Trash2, LogOut, Loader2 } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"

interface Session {
  id: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  last_used_at: string
  access_token_expires_at: string
  refresh_token_expires_at: string
  is_current: boolean
}

function parseUserAgent(ua: string | null): { device: string; browser: string; os: string } {
  if (!ua) return { device: "Unknown", browser: "Unknown", os: "Unknown" }
  
  let device = "Desktop"
  let browser = "Unknown"
  let os = "Unknown"
  
  // Detect device
  if (/mobile/i.test(ua)) device = "Mobile"
  else if (/tablet|ipad/i.test(ua)) device = "Tablet"
  
  // Detect browser
  if (/firefox/i.test(ua)) browser = "Firefox"
  else if (/edg/i.test(ua)) browser = "Edge"
  else if (/chrome/i.test(ua)) browser = "Chrome"
  else if (/safari/i.test(ua)) browser = "Safari"
  else if (/opera|opr/i.test(ua)) browser = "Opera"
  
  // Detect OS
  if (/windows/i.test(ua)) os = "Windows"
  else if (/mac os/i.test(ua)) os = "macOS"
  else if (/linux/i.test(ua)) os = "Linux"
  else if (/android/i.test(ua)) os = "Android"
  else if (/iphone|ipad/i.test(ua)) os = "iOS"
  
  return { device, browser, os }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getRelativeTime(date: string): string {
  const now = new Date()
  const then = new Date(date)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export function AccountSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [revokingAll, setRevokingAll] = useState(false)

  const fetchSessions = async () => {
    try {
      const res = await axiosInstance.auth.get("/sessions")
      if (res.data.success) {
        setSessions(res.data.data.sessions)
      }
    } catch (error: any) {
      toast.error("Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const handleRevokeSession = async (sessionId: string) => {
    setRevoking(sessionId)
    try {
      await axiosInstance.auth.delete(`/sessions/${sessionId}`)
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      toast.success("Session revoked")
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to revoke session")
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAllSessions = async () => {
    setRevokingAll(true)
    try {
      await axiosInstance.auth.delete("/sessions")
      toast.success("All other sessions revoked")
      // Refresh the list - current session should remain
      await fetchSessions()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to revoke sessions")
    } finally {
      setRevokingAll(false)
    }
  }

  if (loading) {
    return (
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Active Sessions</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Active Sessions</h3>
        {sessions.length > 1 && (
          <button
            onClick={handleRevokeAllSessions}
            disabled={revokingAll}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
          >
            {revokingAll ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <LogOut className="w-3 h-3" />
            )}
            Revoke All Others
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Manage your active sessions across devices. Revoke any session you don't recognize.
      </p>

      {sessions.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No active sessions found
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => {
            const { device, browser, os } = parseUserAgent(session.user_agent)
            const isCurrentSession = session.is_current
            const DeviceIcon = device === "Mobile" ? Smartphone : Monitor

            return (
              <div
                key={session.id}
                className="flex items-start justify-between gap-3 p-3 bg-muted/50 border border-border rounded-md"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-background border border-border rounded-md">
                    <DeviceIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {browser} on {os}
                      </span>
                      {isCurrentSession && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary rounded">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      <span>{session.ip_address || "Unknown IP"}</span>
                      <span>·</span>
                      <span>Last active {getRelativeTime(session.last_used_at)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Created {formatDate(session.created_at)}
                    </div>
                  </div>
                </div>

                {!isCurrentSession && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                    title="Revoke session"
                  >
                    {revoking === session.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
