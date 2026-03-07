"use client"

import { useState, useEffect } from "react"
import { Trash2, Clock, Mail, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
import { InviteMemberDialog } from "./invite-member-dialog"
import { useAuthContext } from "@/contexts/auth-context"

interface Invite {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

export function InviteList({ teamId }: { teamId: string }) {
  const { user } = useAuthContext()
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [revokeTarget, setRevokeTarget] = useState<Invite | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  // Fetch current user's role in this team
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const response = await axiosInstance.auth.get(`/teams/${teamId}/members`)
        if (response.data.success) {
          const me = response.data.data.members?.find((m: any) => m.user_id === user?.id)
          setCurrentUserRole(me?.role || null)
        }
      } catch {
        // fallback: hide invite button
      }
    }
    if (user?.id) fetchRole()
  }, [teamId, user?.id])

  const canInvite = currentUserRole === "owner" || currentUserRole === "admin"

  useEffect(() => {
    fetchInvites()
  }, [teamId])

  const fetchInvites = async () => {
    try {
      const response = await axiosInstance.auth.get(`/teams/${teamId}/invites`)
      if (response.data.success) {
        setInvites(response.data.data.invites)
      }
    } catch (error) {
      console.error("Failed to fetch invites:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    try {
      await axiosInstance.auth.delete(`/teams/invites/${revokeTarget.id}`)
      toast.success("Invitation revoked")
      setRevokeTarget(null)
      fetchInvites()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to revoke invitation")
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isExpired = (dateStr: string) => {
    return new Date(dateStr) < new Date()
  }

  const pendingInvites = loading ? [] : invites.filter(i => i.status === "pending" && !isExpired(i.expires_at))

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Mail className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Invitations [ {loading ? <Skeleton className="h-3 w-4"/> : `${pendingInvites.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View and manage pending team invitations.
            </p>
          </div>
        </div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)} size="sm">
            Invite Member
          </Button>
        )}
      </div>

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
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[180px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Email</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Role</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Sent</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Expires</span>
                  </th>
                  <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} className="px-3 pt-3 py-8 text-center">
                    <Skeleton className="bg-muted w-full h-5"/>
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : pendingInvites.length === 0 ? (
        <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
            <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
              <Mail className="size-5" strokeWidth={1.5} />
            </div>
            <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
              No Pending Invitations
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
              Invite team members to start collaborating.
            </p>
            {canInvite && (
              <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
                <Button onClick={() => setInviteOpen(true)}>
                  Invite Member
                </Button>
              </div>
            )}
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
                  <th className="border-b border-r border-border px-3 py-1.5 text-left min-w-[180px]">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Email</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Role</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Sent</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Expires</span>
                  </th>
                  <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {pendingInvites.map((invite, idx) => {
                  const rowNum = idx + 1
                  return (
                    <tr key={invite.id} className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                      <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{rowNum}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <span className="text-sm text-foreground truncate font-sans">{invite.email}</span>
                        </div>
                      </td>
                      <td className="border-r border-border px-3 py-1.5">
                        <Badge variant="outline" className="capitalize">{invite.role}</Badge>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 text-muted-foreground text-xs hidden sm:table-cell whitespace-nowrap">
                        {formatDate(invite.created_at)}
                      </td>
                      <td className="border-r border-border px-3 py-1.5 hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(invite.expires_at)}
                        </div>
                      </td>
                      <td className="px-1 py-1">
                        {canInvite && (
                          <div className="flex items-center justify-center">
                            <button
                              onClick={() => setRevokeTarget(invite)}
                              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              aria-label="Revoke invitation"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-card/50">
            <p className="text-xs text-muted-foreground">
              {pendingInvites.length} pending invite{pendingInvites.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Revoke Invitation Sheet */}
      <Sheet open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <SheetTitle className="font-normal text-base">Revoke Invitation</SheetTitle>
            </div>
            <SheetDescription className="text-[13px]">
              Are you sure you want to revoke the invitation sent to <strong>{revokeTarget?.email}</strong>? They will no longer be able to join the team with this invite.
            </SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke}>
              Revoke
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <InviteMemberDialog
        teamId={teamId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={fetchInvites}
      />
    </div>
  )
}
