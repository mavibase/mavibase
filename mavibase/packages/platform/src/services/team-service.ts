import { pool } from "../config/database"
import { v4 as uuidv4 } from "uuid"
import { nanoid } from "nanoid"
import type { PoolClient } from "pg"
import crypto from "crypto"
import { sendTeamInviteEmail, sendMemberRemovedEmail, sendRoleChangedEmail } from "./email-service"

// Default avatar URLs for teams
const TEAM_AVATAR_URLS = [
  "https://api.dicebear.com/9.x/shapes/svg?seed=Kane",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Derek",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Zoie",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Amie",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Yesenia",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Elna",
  "https://api.dicebear.com/9.x/shapes/svg?seed=Annabelle",
]

const getRandomTeamAvatarUrl = () => TEAM_AVATAR_URLS[Math.floor(Math.random() * TEAM_AVATAR_URLS.length)]

const generateTeamSlug = (name: string): string => {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  // Add 6-character random suffix
  return `${baseSlug}-${nanoid(6)}`
}

const checkTeamQuota = async (teamId: string): Promise<void> => {
  const result = await pool.query(
    `SELECT tier, quota_projects, current_projects_count FROM teams WHERE id = $1`,
    [teamId],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 404,
      code: "TEAM_NOT_FOUND",
      message: "Team not found",
    }
  }

  const team = result.rows[0]

  // Check if team has reached project quota
  if (team.current_projects_count >= team.quota_projects) {
    throw {
      statusCode: 403,
      code: "QUOTA_EXCEEDED",
      message: `Your ${team.tier} tier allows ${team.quota_projects} projects. Contact support to increase your quota.`,
    }
  }
}

export const createTeam = async (
  userId: string,
  name: string,
  description?: string,
  isPersonal = false,
  client?: PoolClient,
) => {
  const teamId = uuidv4()
  const slug = generateTeamSlug(name)

  // Get resource tier limits from env or defaults
  const quotaProjects = Number.parseInt(process.env.FREE_PLAN_MAX_PROJECTS || "3")
  const quotaApiRequests = Number.parseInt(process.env.FREE_PLAN_API_REQUESTS || "1000000")
  const quotaStorage = Number.parseInt(process.env.FREE_PLAN_STORAGE_GB || "10")
  const quotaBandwidth = Number.parseInt(process.env.FREE_PLAN_BANDWIDTH_GB || "100")

  const dbClient = client || (await pool.connect())
  const shouldManageTransaction = !client

  try {
    if (shouldManageTransaction) {
      await dbClient.query("BEGIN")
    }

    // Create team with random avatar
    const avatarUrl = getRandomTeamAvatarUrl()
    const teamResult = await dbClient.query(
      `INSERT INTO teams (
        id, name, slug, description, is_personal, tier, 
        quota_projects, quota_api_requests_monthly, quota_storage_gb, quota_bandwidth_gb, avatar_url
      )
      VALUES ($1, $2, $3, $4, $5, 'free', $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        teamId,
        name,
        slug,
        description || null,
        isPersonal,
        quotaProjects,
        quotaApiRequests,
        quotaStorage,
        quotaBandwidth,
        avatarUrl,
      ],
    )

    const team = teamResult.rows[0]

    // Add user as owner
    await dbClient.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`, [teamId, userId])

    if (shouldManageTransaction) {
      await dbClient.query("COMMIT")
    }

    return team
  } catch (error) {
    if (shouldManageTransaction) {
      await dbClient.query("ROLLBACK")
    }
    throw error
  } finally {
    if (shouldManageTransaction) {
      dbClient.release()
    }
  }
}

export const createPersonalTeam = async (userId: string, username: string, client?: PoolClient) => {
  const teamName = `${username}-team`
  return createTeam(userId, teamName, "Personal workspace", true, client)
}

export const getTeam = async (teamId: string, userId: string) => {
  // Verify user has access to this team
  const result = await pool.query(
    `SELECT t.* FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE t.id = $1 AND tm.user_id = $2`,
    [teamId, userId],
  )

  if (result.rows.length === 0) {
    throw {
      statusCode: 403,
      code: "TEAM_ACCESS_DENIED",
      message: "Team not found or access denied",
    }
  }

  return result.rows[0]
}

export const updateTeam = async (teamId: string, userId: string, updates: any) => {
  // Verify user is owner or admin
  const memberCheck = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    userId,
  ])

  if (memberCheck.rows.length === 0 || !["owner", "admin"].includes(memberCheck.rows[0].role)) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners and admins can update team settings",
    }
  }

  const fields: string[] = []
  const values: any[] = []
  let paramIndex = 1

  if (updates.name) {
    fields.push(`name = $${paramIndex}`)
    values.push(updates.name)
    paramIndex++

    // Update slug if name changes
    fields.push(`slug = $${paramIndex}`)
    values.push(generateTeamSlug(updates.name))
    paramIndex++
  }

  if (updates.description !== undefined) {
    fields.push(`description = $${paramIndex}`)
    values.push(updates.description)
    paramIndex++
  }

  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex}`)
    values.push(updates.avatar_url)
    paramIndex++
  }

  if (fields.length === 0) {
    return getTeam(teamId, userId)
  }

  values.push(teamId)
  const result = await pool.query(
    `UPDATE teams SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
    values,
  )

  return result.rows[0]
}

export const deleteTeam = async (teamId: string, userId: string) => {
  // Verify user is owner
  const memberCheck = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    userId,
  ])

  if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== "owner") {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only team owners can delete teams",
    }
  }

  // Check if it's user's last team
  const teamsCount = await pool.query(`SELECT COUNT(*) as count FROM team_members WHERE user_id = $1`, [userId])

  if (Number.parseInt(teamsCount.rows[0].count) <= 1) {
    throw {
      statusCode: 400,
      code: "CANNOT_DELETE_LAST_TEAM",
      message: "Cannot delete your last team",
    }
  }

  // Delete team (cascade will handle members and projects)
  await pool.query(`DELETE FROM teams WHERE id = $1`, [teamId])
}

export const getUserTeams = async (userId: string) => {
  const result = await pool.query(
    `SELECT t.*, tm.role, tm.joined_at 
     FROM teams t
     JOIN team_members tm ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId],
  )

  return result.rows
}

export const getTeamUsage = async (teamId: string, userId: string) => {
  // Verify access
  await getTeam(teamId, userId)

  // Get team quotas and tracked counters from the teams table
  const teamResult = await pool.query(
    `SELECT 
      tier,
      quota_projects,
      quota_api_requests_monthly,
      quota_storage_gb,
      quota_bandwidth_gb,
      current_projects_count,
      COALESCE(current_api_requests, 0) as current_api_requests,
      COALESCE(current_storage_gb, 0) as current_storage_gb,
      COALESCE(current_database_gb, 0) as current_database_gb
     FROM teams
     WHERE id = $1`,
    [teamId],
  )

  if (teamResult.rows.length === 0) return null

  const team = teamResult.rows[0]

  // Also aggregate from the project_usage key-value table for per-metric detail
  const usageResult = await pool.query(
    `SELECT 
      pu.metric,
      COALESCE(SUM(pu.value), 0) as total_value,
      MAX(pu.quota_limit) as quota_limit
     FROM project_usage pu
     JOIN projects p ON pu.project_id = p.id
     WHERE p.team_id = $1 AND p.status != 'deleted'
     GROUP BY pu.metric`,
    [teamId],
  )

  const metrics: Record<string, { value: number; limit: number | null }> = {}
  for (const row of usageResult.rows) {
    metrics[row.metric] = { value: Number(row.total_value), limit: row.quota_limit ? Number(row.quota_limit) : null }
  }

  return {
    tier: team.tier,
    quota_projects: Number(team.quota_projects),
    quota_api_requests_monthly: Number(team.quota_api_requests_monthly),
    quota_storage_gb: Number(team.quota_storage_gb),
    quota_bandwidth_gb: Number(team.quota_bandwidth_gb),
    current_projects_count: Number(team.current_projects_count),
    current_api_requests: Number(team.current_api_requests),
    current_storage_gb: Number(team.current_storage_gb),
    current_database_gb: Number(team.current_database_gb),
    metrics,
  }
}

export const inviteMember = async (teamId: string, inviterId: string, email: string, role: string) => {
  // Validate role
  const VALID_INVITE_ROLES = ["admin", "member", "viewer"]
  if (!VALID_INVITE_ROLES.includes(role)) {
    throw {
      statusCode: 400,
      code: "INVALID_ROLE",
      message: `Invalid role "${role}". Must be one of: ${VALID_INVITE_ROLES.join(", ")}`,
    }
  }

  // Verify inviter has permission
  const memberCheck = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    inviterId,
  ])

  if (memberCheck.rows.length === 0 || !["owner", "admin"].includes(memberCheck.rows[0].role)) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners and admins can invite members",
    }
  }

  // Admins cannot invite other admins — only owners can
  if (role === "admin" && memberCheck.rows[0].role !== "owner") {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners can invite users as admin",
    }
  }

  // Check if user is already a member
  const existingMember = await pool.query(
    `SELECT tm.id FROM team_members tm
     JOIN platform_users pu ON tm.user_id = pu.id
     WHERE tm.team_id = $1 AND pu.email = $2`,
    [teamId, email],
  )

  if (existingMember.rows.length > 0) {
    throw {
      statusCode: 400,
      code: "ALREADY_MEMBER",
      message: "User is already a member of this team",
    }
  }

  // Check for existing pending invite
  const existingInvite = await pool.query(
    `SELECT id FROM team_invitations 
     WHERE team_id = $1 AND email = $2 AND status = 'pending' AND expires_at > NOW()`,
    [teamId, email],
  )

  if (existingInvite.rows.length > 0) {
    throw {
      statusCode: 400,
      code: "INVITE_ALREADY_SENT",
      message: "An invitation has already been sent to this email",
    }
  }

  const inviteId = uuidv4()
  const token = uuidv4()
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  const result = await pool.query(
    `INSERT INTO team_invitations (id, team_id, invited_by, email, role, token_hash, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW() + INTERVAL '7 days')
     RETURNING *`,
    [inviteId, teamId, inviterId, email, role, tokenHash],
  )

  // Get team name for email
  const teamResult = await pool.query(`SELECT name FROM teams WHERE id = $1`, [teamId])
  const teamName = teamResult.rows[0]?.name || "Unknown Team"

  // Send invitation email
  try {
    await sendTeamInviteEmail(email, teamName, token, inviteId)
  } catch (emailError) {
    console.error("Failed to send invitation email:", emailError)
    // Don't fail the invitation if email fails
  }

  return { inviteId, invite: result.rows[0] }
}

export const acceptInvite = async (inviteId: string, userId: string) => {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    // Get the invitation
    const inviteResult = await client.query(
      `SELECT * FROM team_invitations WHERE id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [inviteId],
    )

    if (inviteResult.rows.length === 0) {
      throw {
        statusCode: 404,
        code: "INVITATION_NOT_FOUND",
        message: "Invitation not found or expired",
      }
    }

    const invite = inviteResult.rows[0]

    // Verify the email matches
    const userResult = await client.query(`SELECT email FROM platform_users WHERE id = $1`, [userId])

    if (userResult.rows.length === 0 || userResult.rows[0].email !== invite.email) {
      throw {
        statusCode: 403,
        code: "EMAIL_MISMATCH",
        message: "This invitation is for a different email address",
      }
    }

    // Check if user is already a member
    const memberCheck = await client.query(`SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2`, [
      invite.team_id,
      userId,
    ])

    if (memberCheck.rows.length > 0) {
      throw {
        statusCode: 400,
        code: "ALREADY_MEMBER",
        message: "You are already a member of this team",
      }
    }

    // Add user to team
    await client.query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)`, [
      invite.team_id,
      userId,
      invite.role,
    ])

    // Update invitation status
    await client.query(`UPDATE team_invitations SET status = 'accepted', responded_at = NOW() WHERE id = $1`, [
      inviteId,
    ])

    await client.query("COMMIT")

    return { teamId: invite.team_id }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export const removeMember = async (teamId: string, requesterId: string, targetUserId: string) => {
  // Verify requester has permission
  const requesterRole = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    requesterId,
  ])

  if (requesterRole.rows.length === 0 || !["owner", "admin"].includes(requesterRole.rows[0].role)) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners and admins can remove members",
    }
  }

  // Check if target user is an owner
  const targetRole = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    targetUserId,
  ])

  if (targetRole.rows.length > 0 && targetRole.rows[0].role === "owner") {
    throw {
      statusCode: 403,
      code: "CANNOT_REMOVE_OWNER",
      message: "Cannot remove the team owner. Transfer ownership first.",
    }
  }

  // Cannot remove yourself if you're the last owner
  const ownerCount = await pool.query(
    `SELECT COUNT(*) as count FROM team_members WHERE team_id = $1 AND role = 'owner'`,
    [teamId],
  )

  if (
    requesterId === targetUserId &&
    requesterRole.rows[0].role === "owner" &&
    Number.parseInt(ownerCount.rows[0].count) === 1
  ) {
    throw {
      statusCode: 400,
      code: "CANNOT_REMOVE_LAST_OWNER",
      message: "Cannot remove the last owner from a team",
    }
  }

  const userInfo = await pool.query(
    `SELECT pu.email, pu.name, pu.username, t.name as team_name, requester.name as requester_name
     FROM platform_users pu
     CROSS JOIN teams t
     LEFT JOIN platform_users requester ON requester.id = $2
     WHERE pu.id = $1 AND t.id = $3`,
    [targetUserId, requesterId, teamId],
  )

  await pool.query(`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, targetUserId])

  if (userInfo.rows.length > 0) {
    const { email, name, username, team_name, requester_name } = userInfo.rows[0]
    try {
      await sendMemberRemovedEmail(email, name || username, team_name, requester_name || "Team Admin")
    } catch (emailError) {
      console.error("Failed to send member removal email:", emailError)
    }
  }
}

export const updateMemberRole = async (teamId: string, requesterId: string, targetUserId: string, newRole: string) => {
  // Validate new role
  const VALID_ROLES = ["owner", "admin", "member", "viewer"]
  if (!VALID_ROLES.includes(newRole)) {
    throw {
      statusCode: 400,
      code: "INVALID_ROLE",
      message: `Invalid role "${newRole}". Must be one of: ${VALID_ROLES.join(", ")}`,
    }
  }

  // Verify requester is owner or admin
  const requesterRole = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    requesterId,
  ])

  if (requesterRole.rows.length === 0 || !["owner", "admin"].includes(requesterRole.rows[0].role)) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners and admins can change member roles",
    }
  }

  // Check if target user is an owner - cannot change owner's role
  const targetRole = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    teamId,
    targetUserId,
  ])

  if (targetRole.rows.length > 0 && targetRole.rows[0].role === "owner") {
    throw {
      statusCode: 403,
      code: "CANNOT_CHANGE_OWNER_ROLE",
      message: "Cannot change the team owner's role. Transfer ownership first.",
    }
  }

  // Only owners can promote/demote to owner or admin
  if ((newRole === "owner" || newRole === "admin") && requesterRole.rows[0].role !== "owner") {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners can promote members to owner or admin",
    }
  }

  const memberInfo = await pool.query(
    `SELECT tm.role as old_role, pu.email, pu.name, pu.username, t.name as team_name, requester.name as requester_name
     FROM team_members tm
     JOIN platform_users pu ON tm.user_id = pu.id
     CROSS JOIN teams t
     LEFT JOIN platform_users requester ON requester.id = $2
     WHERE tm.team_id = $1 AND tm.user_id = $3 AND t.id = $1`,
    [teamId, requesterId, targetUserId],
  )

  await pool.query(`UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`, [
    newRole,
    teamId,
    targetUserId,
  ])

  if (memberInfo.rows.length > 0) {
    const { old_role, email, name, username, team_name, requester_name } = memberInfo.rows[0]
    try {
      await sendRoleChangedEmail(email, name || username, team_name, old_role, newRole, requester_name || "Team Owner")
    } catch (emailError) {
      console.error("Failed to send role change email:", emailError)
    }
  }
}

export const listTeamInvites = async (teamId: string, userId: string) => {
  // Verify access
  await getTeam(teamId, userId)

  const result = await pool.query(
    `SELECT * FROM team_invitations WHERE team_id = $1 AND expires_at > NOW() ORDER BY created_at DESC`,
    [teamId],
  )

  return result.rows
}

export const revokeInvite = async (inviteId: string, userId: string) => {
  // Get invitation to check team
  const inviteResult = await pool.query(`SELECT team_id, invited_by FROM team_invitations WHERE id = $1`, [inviteId])

  if (inviteResult.rows.length === 0) {
    throw {
      statusCode: 404,
      code: "INVITATION_NOT_FOUND",
      message: "Invitation not found",
    }
  }

  const invite = inviteResult.rows[0]

  // Verify user has permission (owner, admin, or person who sent the invite)
  const memberCheck = await pool.query(`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`, [
    invite.team_id,
    userId,
  ])

  if (memberCheck.rows.length === 0) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Access denied",
    }
  }

  const userRole = memberCheck.rows[0].role
  const isInviter = invite.invited_by === userId

  if (!["owner", "admin"].includes(userRole) && !isInviter) {
    throw {
      statusCode: 403,
      code: "INSUFFICIENT_PERMISSIONS",
      message: "Only owners, admins, or the inviter can revoke invitations",
    }
  }

  await pool.query(`UPDATE team_invitations SET status = 'expired' WHERE id = $1`, [inviteId])
}

export const getTeamMembers = async (teamId: string, userId: string) => {
  // Verify access
  await getTeam(teamId, userId)

  const result = await pool.query(
    `SELECT 
      tm.user_id,
      tm.role,
      tm.joined_at,
      pu.email,
      pu.username,
      pu.name,
      pu.firstname,
      pu.lastname,
      pu.avatar_url
     FROM team_members tm
     JOIN platform_users pu ON tm.user_id = pu.id
     WHERE tm.team_id = $1
     ORDER BY 
       CASE tm.role 
         WHEN 'owner' THEN 1
         WHEN 'admin' THEN 2
         WHEN 'member' THEN 3
         ELSE 4
       END,
       tm.joined_at ASC`,
    [teamId],
  )

  return result.rows
}

export const getTeamStats = async (teamId: string, userId: string) => {
  // Verify access
  await getTeam(teamId, userId)

  // Get team stats including member count, project count, and resource usage
  const statsResult = await pool.query(
    `SELECT 
      (SELECT COUNT(*) FROM team_members WHERE team_id = $1) as member_count,
      (SELECT COUNT(*) FROM projects WHERE team_id = $1 AND status = 'active') as active_projects_count,
      (SELECT COUNT(*) FROM team_invitations WHERE team_id = $1 AND expires_at > NOW()) as pending_invites_count,
      t.tier,
      t.quota_projects,
      t.quota_api_requests_monthly,
      t.quota_storage_gb,
      t.quota_bandwidth_gb,
      t.current_projects_count,
      t.created_at
     FROM teams t
     WHERE t.id = $1`,
    [teamId],
  )

  const stats = statsResult.rows[0]

  // Get usage across all projects
  const usageResult = await pool.query(
    `SELECT 
       metric,
       SUM(value) as total_value,
       MAX(quota_limit) as quota_limit
     FROM project_usage
     WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1)
     GROUP BY metric`,
    [teamId],
  )

  stats.usage = usageResult.rows.reduce((acc: any, row: any) => {
    acc[row.metric] = {
      value: row.total_value,
      limit: row.quota_limit,
    }
    return acc
  }, {})

  return stats
}



export const isTeamMember = async (teamId: string, userId: string): Promise<boolean> => {
  const result = await pool.query(`SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2`, [teamId, userId])

  return result.rows.length > 0
}

/**
 * Get a user's role within a team.
 * Returns the role string ("owner", "admin", "member", "viewer") or null if not a member.
 */
export const getTeamMemberRole = async (teamId: string, userId: string): Promise<string | null> => {
  const result = await pool.query(
    `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId],
  )

  return result.rows.length > 0 ? result.rows[0].role : null
}

/**
 * Get a user's role within the team that owns a given project.
 * Returns the role string or null if not a member.
 */
export const getProjectMemberRole = async (projectId: string, userId: string): Promise<string | null> => {
  const result = await pool.query(
    `SELECT tm.role
     FROM team_members tm
     JOIN projects p ON p.team_id = tm.team_id
     WHERE p.id = $1 AND tm.user_id = $2 AND p.status != 'deleted'`,
    [projectId, userId],
  )

  return result.rows.length > 0 ? result.rows[0].role : null
}

export { checkTeamQuota }
