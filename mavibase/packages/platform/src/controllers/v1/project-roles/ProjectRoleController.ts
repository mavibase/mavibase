import type { Request, Response } from "express"
import * as projectRoleService from "@mavibase/platform/services/project-role-service"
import * as projectService from "@mavibase/platform/services/project-service"
import * as teamService from "@mavibase/platform/services/team-service"

export const createRole = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, permissions } = req.body

    if (!name || !permissions) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Name and permissions are required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage project roles",
        },
      })
    }

    const role = await projectRoleService.createProjectRole({
      project_id: projectId,
      name,
      description,
      permissions,
    })

    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: { role },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "ROLE_CREATION_FAILED",
        message: error.message,
      },
    })
  }
}

export const getRoles = async (req: Request, res: Response) => {
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

    const roles = await projectRoleService.getProjectRoles(projectId)

    res.json({
      success: true,
      data: { roles },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_ROLES_FAILED",
        message: error.message,
      },
    })
  }
}

export const getRole = async (req: Request, res: Response) => {
  try {
    const { projectId, roleId } = req.params

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

    const role = await projectRoleService.getProjectRoleById(roleId)

    if (!role || role.project_id !== projectId) {
      return res.status(404).json({
        error: {
          code: "ROLE_NOT_FOUND",
          message: "Role not found",
        },
      })
    }

    res.json({
      success: true,
      data: { role },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_ROLE_FAILED",
        message: error.message,
      },
    })
  }
}

export const updateRole = async (req: Request, res: Response) => {
  try {
    const { projectId, roleId } = req.params
    const { name, description, permissions } = req.body

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage project roles",
        },
      })
    }

    const existingRole = await projectRoleService.getProjectRoleById(roleId)
    if (!existingRole || existingRole.project_id !== projectId) {
      return res.status(404).json({
        error: {
          code: "ROLE_NOT_FOUND",
          message: "Role not found",
        },
      })
    }

    if (existingRole.is_system) {
      return res.status(403).json({
        error: {
          code: "CANNOT_MODIFY_SYSTEM_ROLE",
          message: "System roles cannot be modified",
        },
      })
    }

    const role = await projectRoleService.updateProjectRole(roleId, {
      name,
      description,
      permissions,
    })

    res.json({
      success: true,
      message: "Role updated successfully",
      data: { role },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "ROLE_UPDATE_FAILED",
        message: error.message,
      },
    })
  }
}

export const deleteRole = async (req: Request, res: Response) => {
  try {
    const { projectId, roleId } = req.params

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can manage project roles",
        },
      })
    }

    const role = await projectRoleService.getProjectRoleById(roleId)
    if (!role || role.project_id !== projectId) {
      return res.status(404).json({
        error: {
          code: "ROLE_NOT_FOUND",
          message: "Role not found",
        },
      })
    }

    if (role.is_system) {
      return res.status(403).json({
        error: {
          code: "CANNOT_DELETE_SYSTEM_ROLE",
          message: "System roles cannot be deleted",
        },
      })
    }

    await projectRoleService.deleteProjectRole(roleId)

    res.json({
      success: true,
      message: "Role deleted successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "ROLE_DELETION_FAILED",
        message: error.message,
      },
    })
  }
}

export const assignRole = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { user_id, role_name, expires_at } = req.body

    if (!user_id || !role_name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "user_id and role_name are required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can assign project roles",
        },
      })
    }

    const assignment = await projectRoleService.assignRoleToUser({
      user_id,
      project_id: projectId,
      role_name,
      assigned_by: req.userId,
      expires_at: expires_at ? new Date(expires_at) : undefined,
    })

    res.status(201).json({
      success: true,
      message: "Role assigned successfully",
      data: { assignment },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "ROLE_ASSIGNMENT_FAILED",
        message: error.message,
      },
    })
  }
}

export const removeRole = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { user_id, role_name } = req.body

    if (!user_id || !role_name) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "user_id and role_name are required",
        },
      })
    }

    // Verify user is an owner or admin of the project's team
    const memberRole = await teamService.getProjectMemberRole(projectId, req.userId!)
    if (!memberRole || !["owner", "admin"].includes(memberRole)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "Only team owners and admins can remove project roles",
        },
      })
    }

    await projectRoleService.removeRoleFromUser(user_id, projectId, role_name)

    res.json({
      success: true,
      message: "Role removed successfully",
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "ROLE_REMOVAL_FAILED",
        message: error.message,
      },
    })
  }
}

export const getRoleAssignments = async (req: Request, res: Response) => {
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

    const assignments = await projectRoleService.getProjectRoleAssignments(projectId)

    res.json({
      success: true,
      data: { assignments },
    })
  } catch (error: any) {
    res.status(500).json({
      error: {
        code: "GET_ASSIGNMENTS_FAILED",
        message: error.message,
      },
    })
  }
}
