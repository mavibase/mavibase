import type { Request, Response } from "express"
import * as teamService from "@mavibase/platform/services/team-service"
import { pool } from "@mavibase/platform/config/database"
import { AuditLogService } from "@mavibase/platform/services/audit-log-service"

export const createTeam = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body

    if (!name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Team name is required",
        },
      })
    }

    const team = await teamService.createTeam(req.userId!, name, description)

    await pool.query(`UPDATE platform_users SET selected_team_id = $1, updated_at = NOW() WHERE id = $2`, [
      team.id,
      req.userId!,
    ])

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: team.id,
      action: "team.create",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} created team "${team.name}"`,
        teamId: team.id,
        teamName: team.name,
      },
    })

    res.status(201).json({
      success: true,
      message: "Team created successfully",
      data: { team },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "TEAM_CREATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const getTeam = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    const team = await teamService.getTeam(teamId, req.userId!)

    res.json({
      success: true,
      data: { team },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "FETCH_TEAM_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateTeam = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params
    const { name, description } = req.body

    const team = await teamService.updateTeam(teamId, req.userId!, {
      name,
      description,
    })

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.update",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} updated team ${teamId}`,
        teamId,
        changes: { name, description },
      },
    })

    res.json({
      success: true,
      message: "Team updated successfully",
      data: { team },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "UPDATE_TEAM_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    await teamService.deleteTeam(teamId, req.userId!)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.delete",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} deleted team ${teamId}`,
        teamId,
      },
    })

    res.json({
      success: true,
      message: "Team deleted successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "DELETE_TEAM_FAILED",
        message: error.message,
      },
    })
  }
}

export const listTeams = async (req: Request, res: Response) => {
  try {
    const teams = await teamService.getUserTeams(req.userId!)

    res.json({
      success: true,
      data: { teams },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LIST_TEAMS_FAILED",
        message: error.message,
      },
    })
  }
}

export const inviteMember = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params
    const { email, role = "member" } = req.body

  if (!email) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Email is required",
        },
      })
    }

    const invite = await teamService.inviteMember(teamId, req.userId!, email, role)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.member.invite",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} invited ${email} to team ${teamId} as ${role}`,
        teamId,
        invitedEmail: email,
        role,
        inviteId: invite?.id,
      },
    })

    res.json({
      success: true,
      message: "Invitation sent successfully",
      data: { invite },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "INVITE_MEMBER_FAILED",
        message: error.message,
      },
    })
  }
}

export const acceptInvite = async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.params

    const result = await teamService.acceptInvite(inviteId, req.userId!)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: result.teamId,
      action: "team.invite.accept",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} accepted invite ${inviteId} to team ${result.teamId}`,
        teamId: result.teamId,
        inviteId,
      },
    })

    res.json({
      success: true,
      message: "Invitation accepted successfully",
      data: { teamId: result.teamId },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "ACCEPT_INVITE_FAILED",
        message: error.message,
      },
    })
  }
}

export const removeMember = async (req: Request, res: Response) => {
  try {
    const { teamId, userId } = req.params

    await teamService.removeMember(teamId, req.userId!, userId)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.member.remove",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} removed user ${userId} from team ${teamId}`,
        teamId,
        removedUserId: userId,
      },
    })

    res.json({
      success: true,
      message: "Member removed successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "REMOVE_MEMBER_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateMemberRole = async (req: Request, res: Response) => {
  try {
    const { teamId, userId } = req.params
    const { role } = req.body

    if (!role) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Role is required",
        },
      })
    }

    await teamService.updateMemberRole(teamId, req.userId!, userId, role)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.member.role.update",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} updated role for user ${userId} in team ${teamId} to ${role}`,
        teamId,
        memberUserId: userId,
        newRole: role,
      },
    })

    res.json({
      success: true,
      message: "Member role updated successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "UPDATE_MEMBER_ROLE_FAILED",
        message: error.message,
      },
    })
  }
}

export const listInvites = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    const invites = await teamService.listTeamInvites(teamId, req.userId!)

    res.json({
      success: true,
      data: { invites },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "LIST_INVITES_FAILED",
        message: error.message,
      },
    })
  }
}

export const revokeInvite = async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.params

    const inviteResult = await pool.query(`SELECT team_id FROM team_invitations WHERE id = $1`, [inviteId])
    const teamId = inviteResult.rows[0]?.team_id

    await teamService.revokeInvite(inviteId, req.userId!)

    void AuditLogService.log({
      scope: "team",
      actorId: req.userId!,
      targetId: teamId,
      action: "team.invite.revoke",
      metadata: {
        actorType: "USER",
        message: `User ${req.userId!} revoked invite ${inviteId}${teamId ? ` for team ${teamId}` : ""}`,
        teamId,
        inviteId,
      },
    })

    res.json({
      success: true,
      message: "Invitation revoked successfully",
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "REVOKE_INVITE_FAILED",
        message: error.message,
      },
    })
  }
}

export const getTeamMembers = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    const members = await teamService.getTeamMembers(teamId, req.userId!)

    res.json({
      success: true,
      data: { members },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "GET_TEAM_MEMBERS_FAILED",
        message: error.message,
      },
    })
  }
}

export const getTeamStats = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    const stats = await teamService.getTeamStats(teamId, req.userId!)

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "GET_TEAM_STATS_FAILED",
        message: error.message,
      },
    })
  }
}

export const getTeamActivity = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params
    const { limit = "50", offset = "0" } = req.query

    const activity = await teamService.getTeamActivity(
      teamId,
      req.userId!,
      Number.parseInt(limit as string),
      Number.parseInt(offset as string),
    )

    res.json({
      success: true,
      data: { activity },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "GET_TEAM_ACTIVITY_FAILED",
        message: error.message,
      },
    })
  }
}

export const getTeamUsage = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    const usage = await teamService.getTeamUsage(teamId, req.userId!)

    res.json({
      success: true,
      data: {
        tier: usage.tier,
        quotas: {
          projects: usage.quota_projects,
          api_requests: usage.quota_api_requests_monthly,
          storage_gb: usage.quota_storage_gb,
          bandwidth_gb: usage.quota_bandwidth_gb,
        },
        usage: {
          projects: usage.current_projects_count,
          api_requests: Number(usage.total_requests) || 0,
          storage_bytes: Number(usage.total_storage_bytes) || 0,
          bandwidth_bytes: Number(usage.total_bandwidth_bytes) || 0,
        },
      },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "GET_TEAM_USAGE_FAILED",
        message: error.message,
      },
    })
  }
}
