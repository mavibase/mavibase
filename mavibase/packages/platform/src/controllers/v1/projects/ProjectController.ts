import type { Request, Response } from "express"
import * as projectService from "@mavibase/platform/services/project-service"
import * as teamService from "@mavibase/platform/services/team-service"
import { pool } from "@mavibase/platform/config/database"

export const createProject = async (req: Request, res: Response) => {
  try {
    const { teamId, name, environment, description, metadata } = req.body

    if (!teamId || !name || !environment) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Team ID, name, and environment are required",
        },
      })
    }

    if (!["production", "staging", "development"].includes(environment)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Environment must be 'production', 'staging', or 'development'",
        },
      })
    }

    // Verify user is an owner or admin of the team
    const memberRole = await teamService.getTeamMemberRole(teamId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can create projects",
        },
      })
    }

    const project = await projectService.createProject({
      teamId,
      name,
      environment,
      description,
      metadata,
    })

    await pool.query(`UPDATE platform_users SET selected_project_id = $1, updated_at = NOW() WHERE id = $2`, [
      project.id,
      req.userId!,
    ])

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: { project },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "PROJECT_CREATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const getProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const project = await projectService.getProjectById(projectId)
    if (!project) {
      return res.status(404).json({
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      })
    }

    // Verify access
    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId!)
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        },
      })
    }

    res.json({
      success: true,
      data: { project },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_PROJECT_FAILED",
        message: error.message,
      },
    })
  }
}

export const listTeamProjects = async (req: Request, res: Response) => {
  try {
    const { teamId } = req.params

    // Verify user is a member of the team
    const isMember = await teamService.isTeamMember(teamId, req.userId!)
    if (!isMember) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You are not a member of this team",
        },
      })
    }

    const projects = await projectService.getProjectsByTeamId(teamId)

    res.json({
      success: true,
      data: { projects },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "LIST_PROJECTS_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, status, metadata, environment } = req.body

    // Validate environment if provided
    if (environment && !["production", "staging", "development"].includes(environment)) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Environment must be 'production', 'staging', or 'development'",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can update projects",
        },
      })
    }

    const project = await projectService.updateProject(projectId, {
      name,
      description,
      status,
      metadata,
      environment,
    })

    res.json({
      success: true,
      message: "Project updated successfully",
      data: { project },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "UPDATE_PROJECT_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    // Verify user is the owner of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || memberRole !== "owner") {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners can delete projects",
        },
      })
    }

    const project = await projectService.getProjectById(projectId)

    await projectService.deleteProject(projectId)

    res.json({
      success: true,
      message: "Project deleted successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "DELETE_PROJECT_FAILED",
        message: error.message,
      },
    })
  }
}

export const getProjectStats = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    // Verify access
    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId!)
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        },
      })
    }

    const stats = await projectService.getProjectStats(projectId)

    res.json({
      success: true,
      data: { stats },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_PROJECT_STATS_FAILED",
        message: error.message,
      },
    })
  }
}

export const getProjectUsage = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    // Verify access
    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId!)
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        },
      })
    }

    const usage = await projectService.getProjectUsage(projectId)

    res.json({
      success: true,
      data: { usage },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_PROJECT_USAGE_FAILED",
        message: error.message,
      },
    })
  }
}

export const getProjectActivity = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    // Verify access
    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId!)
    if (!hasAccess) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have access to this project",
        },
      })
    }

    const activity = await projectService.getProjectActivity(projectId, limit, offset)

    res.json({
      success: true,
      data: { activity },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_PROJECT_ACTIVITY_FAILED",
        message: error.message,
      },
    })
  }
}

export const getProjectTimeSeries = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const range = (req.query.range as string) || "7d"

    if (!["2d", "7d", "30d", "12m"].includes(range)) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "range must be 2d, 7d, 30d, or 12m" },
      })
    }

    const hasAccess = await projectService.verifyProjectAccess(projectId, req.userId!)
    if (!hasAccess) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "You do not have access to this project" },
      })
    }

    const data = await projectService.getProjectTimeSeries(
      projectId,
      range as "2d" | "7d" | "30d" | "12m",
    )

    res.json({ success: true, data: { timeSeries: data, range } })
  } catch (error: any) {
    res.status(500).json({
      error: { code: "GET_TIME_SERIES_FAILED", message: error.message },
    })
  }
}
