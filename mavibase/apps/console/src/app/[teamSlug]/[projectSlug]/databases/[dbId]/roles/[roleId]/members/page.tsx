"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Trash2,
  Settings,
  ChevronRight,
} from "lucide-react"
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
import axiosInstance from "@/lib/axios-instance"
import { useToast } from "@/components/custom-toast"
import { useProjectContext } from "@/contexts/project-context"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RoleRecord {
  id: string
  name: string
  description?: string | null
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

interface RoleMember {
  user_id: string
  role_name: string
  assigned_at: string
  assigned_by?: string
  expires_at?: string | null
  _name?: string
  _email?: string
}

interface TeamMember {
  id: string
  user_id: string
  name?: string
  email?: string
  username?: string
  role?: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  } catch { return iso }
}

function truncateId(id: string) {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function RoleMembersPage() {
  const params = useParams()
  const router = useRouter()
  const { teamId } = useProjectContext()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const roleId = params.roleId as string
  const { toast } = useToast()

  const [role, setRole] = useState<RoleRecord | null>(null)
  const [loadingRole, setLoadingRole] = useState(true)
  const [members, setMembers] = useState<RoleMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Remove member dialog
  const [removeTarget, setRemoveTarget] = useState<RoleMember | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)

  const basePath = `/${teamSlug}/${projectSlug}/databases/${dbId}`

  /* ---- fetch role ---- */
  const fetchRole = useCallback(async () => {
    setLoadingRole(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/roles/${roleId}`)
      setRole(res.data?.data || null)
    } catch {
      toast({ message: "Failed to load role", type: "error" })
    } finally {
      setLoadingRole(false)
    }
  }, [dbId, roleId, toast])

  /* ---- fetch members ---- */
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/roles/${roleId}/members`)
      setMembers(res.data?.data || [])
    } catch {
      toast({ message: "Failed to load role members", type: "error" })
    } finally {
      setLoadingMembers(false)
    }
  }, [dbId, roleId, toast])

  /* ---- fetch team members for name resolution ---- */
  const fetchTeamMembers = useCallback(async () => {
    if (!teamId) return
    try {
      const res = await axiosInstance.auth.get(`/teams/${teamId}/members`)
      const data = res.data?.data
      setTeamMembers(Array.isArray(data) ? data : data?.members || [])
    } catch {
      // non-critical
    }
  }, [teamId])

  useEffect(() => {
    fetchRole()
    fetchMembers()
    fetchTeamMembers()
  }, [fetchRole, fetchMembers, fetchTeamMembers])

  /* ---- resolve names ---- */
  const teamMemberMap = useMemo(() => {
    const map: Record<string, TeamMember> = {}
    teamMembers.forEach((m) => { if (m.user_id) map[m.user_id] = m })
    return map
  }, [teamMembers])

  const enrichedMembers = useMemo(() =>
    members.map((m) => {
      const tm = teamMemberMap[m.user_id]
      return {
        ...m,
        _name: tm?.name || tm?.email || tm?.username || undefined,
        _email: tm?.email || undefined,
      }
    }),
    [members, teamMemberMap]
  )

  /* ---- remove member ---- */
  const handleRemoveMember = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await axiosInstance.db.delete(`/v1/db/databases/${dbId}/roles/${roleId}/members/${removeTarget.user_id}`)
      toast({ message: "Member removed from role", type: "success" })
      setRemoveOpen(false)
      setRemoveTarget(null)
      fetchMembers()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to remove member"
      toast({ message: msg, type: "error" })
    } finally {
      setRemoving(false)
    }
  }

  const isLoading = loadingRole || loadingMembers

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push(`${basePath}/roles`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="size-3.5" />
          Roles
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium">{role?.name || "..."}</span>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium flex items-center gap-1.5">
          <Users className="size-3.5" />
          Members
        </span>
      </div>

      {/* Back button + title */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push(`${basePath}/roles`)}
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {isLoading ? "Loading..." : `${role?.name} — Members`}
          </h1>
          {role?.description && (
            <p className="text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
      </div>

      {/* Sub-navigation for this role */}
      {role && (
        <div className="flex items-center gap-2 flex-wrap">
          {/* Members — active */}
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5"
          >
            <Users className="size-3.5" />
            Members
          </Button>
          {/* Assign */}
          {!role.is_system && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border gap-1.5"
              onClick={() => router.push(`${basePath}/roles/${roleId}/assign`)}
            >
              <UserPlus className="size-3.5" />
              Assign member
            </Button>
          )}
          {/* Permissions */}
          {!role.is_system && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-border gap-1.5"
              onClick={() => router.push(`${basePath}/roles/${roleId}/select-permissions`)}
            >
              <Settings className="size-3.5" />
              Permissions
              <span className="ml-1 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                {Array.isArray(role.permissions) ? role.permissions.length : 0}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Members content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      ) : enrichedMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center size-14 rounded-2xl bg-secondary mb-4">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No members assigned</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Assign team members to this role to grant them the associated permissions.
          </p>
          {role && !role.is_system && (
            <Button
              className="mt-5"
              onClick={() => router.push(`${basePath}/roles/${roleId}/assign`)}
            >
              <UserPlus className="size-4" />
              Assign member
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Members table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-card">
                    <th className="w-10 min-w-10 border-b border-r border-border px-2 py-1.5 text-center">
                      <span className="text-[11px] text-muted-foreground">#</span>
                    </th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[180px]">Member</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[180px]">User ID</th>
                    <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[100px]">Assigned</th>
                    {role && !role.is_system && (
                      <th className="border-b border-border w-[60px] min-w-[60px] px-1 py-1.5" />
                    )}
                  </tr>
                </thead>
                <tbody className="text-xs font-mono">
                  {enrichedMembers.map((m, idx) => {
                    const displayName = m._name || truncateId(m.user_id)
                    const isResolved = !!(m._name)
                    return (
                      <tr key={m.user_id} className="group border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                        <td className="w-10 min-w-10 border-r border-border px-2 py-1.5 text-center">
                          <span className="text-[11px] text-muted-foreground tabular-nums">{idx + 1}</span>
                        </td>
                        <td className="border-r border-border px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex items-center justify-center size-7 rounded-full bg-secondary text-muted-foreground shrink-0 font-sans text-[11px] font-medium uppercase">
                              {(m._name || m._email || "?")[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs text-foreground font-medium font-sans truncate">{displayName}</p>
                              {isResolved && m._email && (
                                <p className="text-[10px] text-muted-foreground truncate font-sans">{m._email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="border-r border-border px-3 py-2.5">
                          <span className="text-muted-foreground" title={m.user_id}>{truncateId(m.user_id)}</span>
                        </td>
                        <td className={cn("px-3 py-2.5", role && !role.is_system && "border-r border-border")}>
                          <span className="text-muted-foreground whitespace-nowrap">{formatDate(m.assigned_at)}</span>
                        </td>
                        {role && !role.is_system && (
                          <td className="px-1 py-1">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={() => { setRemoveTarget(m); setRemoveOpen(true) }}
                                className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Remove member"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-card/50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {enrichedMembers.length} member{enrichedMembers.length !== 1 ? "s" : ""}
              </p>
              {role && !role.is_system && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-border"
                  onClick={() => router.push(`${basePath}/roles/${roleId}/assign`)}
                >
                  <UserPlus className="size-3" />
                  Assign member
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Remove member dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Remove member</DialogTitle>
            <DialogDescription>
              Remove{" "}
              <span className="font-semibold text-foreground">
                {removeTarget?._name || truncateId(removeTarget?.user_id || "")}
              </span>{" "}
              from the <span className="font-semibold text-foreground">{role?.name}</span> role?
              They will lose all permissions granted by this role.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="border-border">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={removing}>
              {removing ? <><Loader2 className="size-4 animate-spin" />Removing...</> : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
