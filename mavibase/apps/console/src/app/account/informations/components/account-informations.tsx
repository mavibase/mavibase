"use client"

import { Copy, Shield, Mail, Calendar, Clock, User } from "lucide-react"
import { useAuthContext } from "@/contexts/auth-context"
import { toast } from "sonner"

export function AccountInformations() {
  const { user } = useAuthContext()

  if (!user) return null

  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "N/A"

  const lastLogin = user.last_login_at
    ? new Date(user.last_login_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "N/A"

  const initials = user.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() || "U"

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      {/* Profile */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Profile</h3>
        <div className="flex flex-col gap-3">
          {/* Avatar */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Avatar
            </label>
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt="" 
                  className="size-12 rounded-full bg-secondary"
                />
              ) : (
                <div className="size-12 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-sm font-semibold">
                  {initials}
                </div>
              )}
              <span className="text-xs text-muted-foreground">Avatar is automatically assigned on registration</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Full Name
            </label>
            <div className="h-9 px-3 flex items-center text-sm bg-muted border border-border rounded-md text-foreground">
              {user.name || "Not set"}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email Address
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-9 px-3 flex items-center text-sm bg-muted border border-border rounded-md text-foreground">
                {user.email}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(user.email); toast.success("Copied to clipboard") }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-card text-foreground hover:bg-accent transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Email Verified
            </label>
            <div className="h-9 px-3 flex items-center gap-2 text-sm bg-muted border border-border rounded-md">
              <div className={`w-2 h-2 rounded-full ${user.email_verified ? "bg-green-500" : "bg-amber-500"}`} />
              <span className="text-foreground">
                {user.email_verified ? "Verified" : "Not verified"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Account Status
            </label>
            <div className="h-9 px-3 flex items-center text-sm bg-muted border border-border rounded-md text-foreground capitalize">
              {user.status || "active"}
            </div>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="border border-border rounded-lg bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Account Details</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              User ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={user.id}
                readOnly
                className="flex-1 h-9 px-3 text-sm bg-muted border border-border rounded-md text-muted-foreground font-mono"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(user.id); toast.success("Copied to clipboard") }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-card text-foreground hover:bg-accent transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Default Team ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={user.default_team_id || "N/A"}
                readOnly
                className="flex-1 h-9 px-3 text-sm bg-muted border border-border rounded-md text-muted-foreground font-mono"
              />
              {user.default_team_id && (
                <button
                  onClick={() => { navigator.clipboard.writeText(user.default_team_id); toast.success("Copied to clipboard") }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-md bg-card text-foreground hover:bg-accent transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Account Created
            </label>
            <div className="h-9 px-3 flex items-center gap-2 text-sm bg-muted border border-border rounded-md text-foreground">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              {createdAt}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Last Login
            </label>
            <div className="h-9 px-3 flex items-center gap-2 text-sm bg-muted border border-border rounded-md text-foreground">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              {lastLogin}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
