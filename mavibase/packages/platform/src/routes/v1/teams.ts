import { Router } from "express"
import {
  createTeam,
  getTeam,
  updateTeam,
  deleteTeam,
  listTeams,
  inviteMember,
  acceptInvite,
  removeMember,
  updateMemberRole,
  listInvites,
  revokeInvite,
  getTeamMembers,
  getTeamStats,
  getTeamActivity,
  getTeamUsage, // Added getTeamUsage controller
} from "../../controllers"
import { requireAuth } from "../../middleware/auth-middleware"

const router = Router()

router.post("/", requireAuth, createTeam)
router.get("/", requireAuth, listTeams)
router.get("/:teamId", requireAuth, getTeam)
router.put("/:teamId", requireAuth, updateTeam)
router.delete("/:teamId", requireAuth, deleteTeam)

router.get("/:teamId/stats", requireAuth, getTeamStats)
router.get("/:teamId/activity", requireAuth, getTeamActivity)
router.get("/:teamId/usage", requireAuth, getTeamUsage) // Added usage endpoint

// Members
router.get("/:teamId/members", requireAuth, getTeamMembers)
router.post("/:teamId/invite", requireAuth, inviteMember)
router.post("/invites/:inviteId/accept", requireAuth, acceptInvite)
router.delete("/:teamId/members/:userId", requireAuth, removeMember)
router.put("/:teamId/members/:userId/role", requireAuth, updateMemberRole)

// Invites
router.get("/:teamId/invites", requireAuth, listInvites)
router.delete("/invites/:inviteId", requireAuth, revokeInvite)

export default router
