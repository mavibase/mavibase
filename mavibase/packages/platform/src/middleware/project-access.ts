import type { Request, Response, NextFunction } from "express"
import * as projectService from "../services/project-service"
import * as teamService from "../services/team-service"

/**
 * Middleware to verify user has access to a project via team membership
 * Used for platform user routes (not API key routes)
 */
export const requireProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })
    }

    const projectId = req.params.projectId || req.body.projectId

    if (!projectId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Project ID required",
        },
      })
    }

    // Verify user has access to the project
    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId)

    if (!hasAccess) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        },
      })
    }

    // Attach project ID to request for downstream use
    req.projectId = projectId

    next()
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "PROJECT_ACCESS_CHECK_FAILED",
        message: error.message,
      },
    })
  }
}

/**
 * Middleware to verify user is a team member
 * Used for team-level operations
 */
export const requireTeamMembership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required",
        },
      })
    }

    const teamId = req.params.teamId || req.body.teamId

    if (!teamId) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Team ID required",
        },
      })
    }

    // Verify user is a member of the team
    const isMember = await teamService.isTeamMember(teamId, req.userId)

    if (!isMember) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You are not a member of this team",
        },
      })
    }

    next()
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "TEAM_MEMBERSHIP_CHECK_FAILED",
        message: error.message,
      },
    })
  }
}
