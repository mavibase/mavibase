"use client"

import { useState, useEffect } from "react"
import { MoreHorizontal, Shield, Crown, User, UserMinus, Eye, AlertTriangle, Users } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuthContext } from "@/contexts/auth-context"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"
import { InviteMemberDialog } from "./invite-member-dialog"

interface Member {
  user_id: string
  role: string
  joined_at: string
  email: string
  username: string
  name: string | null
  firstname: string | null
  lastname: string | null
  avatar_url: string | null
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: Eye,
}

const roleColors: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  member: "bg-muted text-muted-foreground border-border",
  viewer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
}

export function MemberList({ teamId }: { teamId: string }) {
  const { user } = useAuthContext()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [removeTarget, setRemoveTarget] = useState<Member | null>(null)
  const [roleChangeTarget, setRoleChangeTarget] = useState<Member | null>(null)
  const [newRole, setNewRole] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [teamId])

  const fetchMembers = async () => {
    try {
      const response = await axiosInstance.auth.get(`/teams/${teamId}/members`)
      if (response.data.success) {
        setMembers(response.data.data.members)
      }
    } catch (error) {
      console.error("Failed to fetch members:", error)
    } finally {
      setLoading(false)
    }
  }

  const currentUserRole = members.find(m => m.user_id === user?.id)?.role
  const canManage = currentUserRole === "owner" || currentUserRole === "admin"
  const isOwner = currentUserRole === "owner"

  const handleRemoveMember = async () => {
    if (!removeTarget) return
    try {
      await axiosInstance.auth.delete(`/teams/${teamId}/members/${removeTarget.user_id}`)
      toast.success("Member removed successfully")
      setRemoveTarget(null)
      fetchMembers()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to remove member")
    }
  }

  const handleRoleChange = async () => {
    if (!roleChangeTarget || !newRole) return
    try {
      await axiosInstance.auth.put(`/teams/${teamId}/members/${roleChangeTarget.user_id}/role`, {
        role: newRole,
      })
      toast.success("Role updated successfully")
      setRoleChangeTarget(null)
      setNewRole("")
      fetchMembers()
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to update role")
    }
  }

  const getDisplayName = (member: Member) => {
    if (member.name) return member.name
    if (member.firstname || member.lastname) return `${member.firstname || ""} ${member.lastname || ""}`.trim()
    return member.username || member.email
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
            <Users className="size-5 text-foreground stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg text-foreground leading-tight flex items-center gap-2">
                Members [ {loading ? <Skeleton className="h-3 w-4"/> : `${members.length}`} ]
              </h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              View and manage all members of this team.
            </p>
          </div>
        </div>
        {canManage && (
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
                    <span className="text-xs font-medium text-muted-foreground font-mono">Member</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Email</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Role</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Joined</span>
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
                    <Skeleton className="bg-muted w-full h-5 mt-2"/>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="relative w-full mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/50">
          <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center backdrop-blur-xs">
            <div className="flex items-center justify-center size-10 rounded-xl border border-border bg-background">
              <Users className="size-5" strokeWidth={1.5} />
            </div>
            <h3 className="mt-2 text-lg tracking-tight text-foreground text-balance">
              No members yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md leading-relaxed text-pretty">
              Invite team members to start collaborating.
            </p>
            {canManage && (
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
                    <span className="text-xs font-medium text-muted-foreground font-mono">Member</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden sm:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Email</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Role</span>
                  </th>
                  <th className="border-b border-r border-border px-3 py-1.5 text-left hidden md:table-cell">
                    <span className="text-xs font-medium text-muted-foreground font-mono">Joined</span>
                  </th>
                  <th className="border-b border-border w-[72px] min-w-[72px] px-1 py-1.5" />
                </tr>
              </thead>
              <tbody className="text-xs font-mono">
                {members.map((member, idx) => {
                  const RoleIcon = roleIcons[member.role] || User
                  const rowNum = idx + 1
                  return (
                    <tr key={member.user_id} className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                      <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                        <span className="text-[11px] text-muted-foreground tabular-nums">{rowNum}</span>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <span className="text-xs font-medium text-primary">
                                {getDisplayName(member).charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-foreground truncate font-sans">{getDisplayName(member)}</span>
                              {member.user_id === user?.id && (
                                <span className="text-xs text-muted-foreground font-sans">(you)</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate sm:hidden font-sans">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 text-muted-foreground text-xs hidden sm:table-cell">{member.email}</td>
                      <td className="border-r border-border px-3 py-1.5">
                        <Badge variant="outline" className={`gap-1.5 capitalize ${roleColors[member.role] || ""}`}>
                          <RoleIcon className="w-3 h-3" />
                          {member.role}
                        </Badge>
                      </td>
                      <td className="border-r border-border px-3 py-1.5 text-muted-foreground text-xs hidden md:table-cell whitespace-nowrap">
                        {new Date(member.joined_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-1 py-1">
                        {canManage && member.user_id !== user?.id && member.role !== "owner" && (
                          <div className="flex items-center justify-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRoleChangeTarget(member)
                                    setNewRole(member.role)
                                  }}
                                >
                                  <Shield className="w-4 h-4 mr-2" />
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setRemoveTarget(member)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
              {members.length} member{members.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Remove Member Sheet */}
      <Sheet open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <SheetTitle>Remove Member</SheetTitle>
            </div>
            <SheetDescription>
              Are you sure you want to remove <strong>{removeTarget && getDisplayName(removeTarget)}</strong> from this team? They will lose access to all team resources.
            </SheetDescription>
          </SheetHeader>
          <SheetBody />
          <SheetFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveMember}>
              Remove
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Change Role Sheet */}
      <Sheet open={!!roleChangeTarget} onOpenChange={() => setRoleChangeTarget(null)}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-foreground" />
              <SheetTitle>Change Role</SheetTitle>
            </div>
            <SheetDescription>
              Update the role for <strong>{roleChangeTarget && getDisplayName(roleChangeTarget)}</strong>.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setRoleChangeTarget(null)}>Cancel</Button>
            <Button onClick={handleRoleChange}>
              Update Role
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <InviteMemberDialog
        teamId={teamId}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={fetchMembers}
      />
    </div>
  )
}
