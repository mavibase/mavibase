"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Loader2,
  ArrowLeft,
  Shield,
  Users,
  UserPlus,
  Settings,
  ChevronRight,
  User,
  Plus,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
}

interface TeamMember {
  id: string
  user_id: string
  name?: string
  email?: string
  username?: string
  role?: string
}

interface RoleMember {
  user_id: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function truncateId(id: string) {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function AssignMemberPage() {
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(true)
  const [existingMembers, setExistingMembers] = useState<RoleMember[]>([])
  const [assigningId, setAssigningId] = useState<string | null>(null)

  // Tabs: from team vs manual
  const [mode, setMode] = useState<"team" | "manual">("team")
  const [search, setSearch] = useState("")
  const [manualUserId, setManualUserId] = useState("")
  const [assigningManual, setAssigningManual] = useState(false)

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

  /* ---- fetch existing members ---- */
  const fetchExistingMembers = useCallback(async () => {
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}/roles/${roleId}/members`)
      setExistingMembers(res.data?.data || [])
    } catch {
      // non-critical
    }
  }, [dbId, roleId])

  /* ---- fetch team members ---- */
  const fetchTeamMembers = useCallback(async () => {
    if (!teamId) return
    setLoadingTeam(true)
    try {
      const res = await axiosInstance.auth.get(`/teams/${teamId}/members`)
      const data = res.data?.data
      setTeamMembers(Array.isArray(data) ? data : data?.members || [])
    } catch {
      toast({ message: "Failed to load team members", type: "error" })
    } finally {
      setLoadingTeam(false)
    }
  }, [teamId, toast])

  useEffect(() => {
    fetchRole()
    fetchTeamMembers()
    fetchExistingMembers()
  }, [fetchRole, fetchTeamMembers, fetchExistingMembers])

  /* ---- assigned set ---- */
  const assignedIds = useMemo(() => new Set(existingMembers.map((m) => m.user_id)), [existingMembers])

  /* ---- filtered members ---- */
  const filteredTeamMembers = useMemo(() =>
    teamMembers.filter((m) => {
      const q = search.toLowerCase()
      return (
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q) ||
        m.user_id?.toLowerCase().includes(q)
      )
    }), [teamMembers, search])

  /* ---- assign from team ---- */
  const handleAssignTeamMember = async (userId: string) => {
    setAssigningId(userId)
    try {
      await axiosInstance.db.post(`/v1/db/databases/${dbId}/roles/${roleId}/members`, {
        userId,
      })
      toast({ message: "Member assigned successfully", type: "success" })
      fetchExistingMembers()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to assign member"
      toast({ message: msg, type: "error" })
    } finally {
      setAssigningId(null)
    }
  }

  /* ---- assign manually ---- */
  const handleAssignManual = async () => {
    if (!manualUserId.trim()) return
    setAssigningManual(true)
    try {
      await axiosInstance.db.post(`/v1/db/databases/${dbId}/roles/${roleId}/members`, {
        userId: manualUserId.trim(),
      })
      toast({ message: "Member assigned successfully", type: "success" })
      setManualUserId("")
      fetchExistingMembers()
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Failed to assign member"
      toast({ message: msg, type: "error" })
    } finally {
      setAssigningManual(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => router.push(`${basePath}/roles`)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Shield className="size-3.5" />
          Roles
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <button
          onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {role?.name || "..."}
        </button>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <span className="text-foreground font-medium flex items-center gap-1.5">
          <UserPlus className="size-3.5" />
          Assign member
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0 mt-0.5"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex flex-col gap-0.5 min-w-0">
          <h1 className="text-xl font-semibold text-foreground">
            Assign member
            {role && <span className="text-muted-foreground font-normal"> — {role.name}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a team member or enter a user ID manually to assign this role.
          </p>
        </div>
      </div>

      {/* Sub-navigation */}
      {role && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-border gap-1.5"
            onClick={() => router.push(`${basePath}/roles/${roleId}/members`)}
          >
            <Users className="size-3.5" />
            Members
          </Button>
          <Button
            size="sm"
            variant="default"
            className="h-8 gap-1.5"
          >
            <UserPlus className="size-3.5" />
            Assign member
          </Button>
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
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 rounded-md bg-secondary w-fit">
        <button
          onClick={() => setMode("team")}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded transition-colors min-w-[120px]",
            mode === "team" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          From team
        </button>
        <button
          onClick={() => setMode("manual")}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded transition-colors min-w-[120px]",
            mode === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          By User ID
        </button>
      </div>

      {mode === "team" ? (
        <div className="flex flex-col gap-4 max-w-2xl">
          {/* Search */}
          <Input
            placeholder="Search team members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-secondary border-border text-sm h-9"
          />

          {loadingTeam ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 text-muted-foreground animate-spin" />
            </div>
          ) : filteredTeamMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-border">
              <User className="size-6 text-muted-foreground mb-2" />
              <p className="text-sm text-foreground font-medium">
                {teamMembers.length === 0 ? "No team members found" : "No members match your search"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {teamMembers.length === 0
                  ? "Invite team members to your workspace first."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-card">
                      <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[220px]">Member</th>
                      <th className="border-b border-r border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground font-mono min-w-[80px]">Team role</th>
                      <th className="border-b border-border w-[100px] min-w-[100px] px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {filteredTeamMembers.map((m) => {
                      const isAssigned = assignedIds.has(m.user_id)
                      return (
                        <tr key={m.user_id} className="border-b border-border last:border-b-0 hover:bg-secondary/40 transition-colors">
                          <td className="border-r border-border px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex items-center justify-center size-7 rounded-full bg-secondary text-muted-foreground shrink-0 font-medium uppercase text-[11px]">
                                {(m.name || m.email || "?")[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-foreground font-medium truncate">
                                  {m.name || m.email || m.username || "Unknown"}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate font-mono">
                                  {m.email || truncateId(m.user_id)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="border-r border-border px-3 py-2.5">
                            {m.role ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-muted-foreground">
                                {m.role}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5">
                            <div className="flex items-center justify-center">
                              {isAssigned ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                                  <Check className="size-3" />
                                  Assigned
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] border-border gap-1"
                                  onClick={() => handleAssignTeamMember(m.user_id)}
                                  disabled={assigningId === m.user_id}
                                >
                                  {assigningId === m.user_id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <Plus className="size-3" />
                                  )}
                                  Assign
                                </Button>
                              )}
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
                  {filteredTeamMembers.length} of {teamMembers.length} team member{teamMembers.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Manual mode */
        <div className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">User ID</label>
            <p className="text-xs text-muted-foreground">
              Paste the full user ID to assign this role to a specific user.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Enter user ID..."
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                className="bg-secondary border-border font-mono flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualUserId.trim()) handleAssignManual()
                }}
              />
              <Button
                onClick={handleAssignManual}
                disabled={assigningManual || !manualUserId.trim()}
                className="shrink-0"
              >
                {assigningManual ? (
                  <><Loader2 className="size-4 animate-spin" />Assigning...</>
                ) : (
                  <><UserPlus className="size-4" />Assign</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
