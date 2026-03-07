import type { Request, Response, NextFunction } from "express"
import { query } from "@mavibase/database/config/database"
import { AppError } from "@mavibase/api/middleware/error-handler"
import { InputValidator } from "@mavibase/api/middleware/input-validator"
import { generateId } from "@mavibase/database/utils/id-generator"

export class RoleController {
  // List all custom roles for a project
  listRoles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.identity!.project_id
      if (!projectId) {
        throw new AppError(500, "MISSING_PROJECT_CONTEXT", "Project context not found in identity")
      }

      const result = await query(
        `SELECT id, project_id, name, description, permissions, is_system, created_at, updated_at
         FROM project_roles 
         WHERE project_id = $1 AND deleted_at IS NULL 
         ORDER BY created_at DESC`,
        [projectId],
      )

      res.json({
        success: true,
        message: `Retrieved ${result.rows.length} role(s)`,
        data: result.rows,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get a specific role
  getRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params
      const projectId = req.identity!.project_id

      const result = await query(
        `SELECT id, project_id, name, description, permissions, is_system, created_at, updated_at
         FROM project_roles 
         WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (result.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      res.json({
        success: true,
        message: "Role retrieved successfully",
        data: result.rows[0],
      })
    } catch (error) {
      next(error)
    }
  }

  // Create a custom role
  createRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, permissions } = req.body

      if (!name || typeof name !== "string") {
        throw new AppError(400, "INVALID_INPUT", "Role name is required")
      }

      // Validate name format (lowercase, alphanumeric, hyphens)
      if (!/^[a-z0-9-]+$/.test(name)) {
        throw new AppError(
          400,
          "INVALID_NAME_FORMAT",
          "Role name must be lowercase alphanumeric with hyphens only",
        )
      }

      const projectId = req.identity!.project_id

      // Check if role already exists
      const existing = await query(
        `SELECT id FROM project_roles WHERE project_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [projectId, name],
      )

      if (existing.rows.length > 0) {
        throw new AppError(409, "ROLE_EXISTS", `Role with name '${name}' already exists`)
      }

      // Insert new role
      const roleId = generateId()
      const result = await query(
        `INSERT INTO project_roles (id, project_id, name, description, permissions, is_system, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
         RETURNING id, project_id, name, description, permissions, is_system, created_at, updated_at`,
        [roleId, projectId, name, description || null, permissions || [], false],
      )

      res.status(201).json({
        success: true,
        message: `Role '${name}' created successfully`,
        data: result.rows[0],
      })
    } catch (error) {
      next(error)
    }
  }

  // Update a role
  updateRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params
      const { name, description, permissions } = req.body

      if (!name && !description && !permissions) {
        throw new AppError(400, "NO_UPDATE_FIELDS", "At least one field must be provided for update")
      }

      const projectId = req.identity!.project_id

      // Check if role exists
      const existing = await query(
        `SELECT id, is_system FROM project_roles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (existing.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      // Prevent modification of system roles
      if (existing.rows[0].is_system) {
        throw new AppError(403, "SYSTEM_ROLE", "System roles cannot be modified")
      }

      // Build update query
      const updates: string[] = []
      const values: any[] = []
      let paramCount = 1

      if (name) {
        updates.push(`name = $${paramCount++}`)
        values.push(name)
      }

      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`)
        values.push(description)
      }

      if (permissions) {
        updates.push(`permissions = $${paramCount++}`)
        values.push(permissions)
      }

      updates.push(`updated_at = NOW()`)
      values.push(roleId, projectId)

      const result = await query(
        `UPDATE project_roles 
         SET ${updates.join(", ")}
         WHERE id = $${paramCount} AND project_id = $${paramCount + 1}
         RETURNING id, project_id, name, description, permissions, is_system, created_at, updated_at`,
        values,
      )

      res.json({
        success: true,
        message: "Role updated successfully",
        data: result.rows[0],
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete a role
  deleteRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params
      const projectId = req.identity!.project_id

      // Check if role exists
      const existing = await query(
        `SELECT id, name, is_system FROM project_roles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (existing.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      // Prevent deletion of system roles
      if (existing.rows[0].is_system) {
        throw new AppError(403, "SYSTEM_ROLE", "System roles cannot be deleted")
      }

      // Soft delete
      await query(
        `UPDATE project_roles SET deleted_at = NOW() WHERE id = $1 AND project_id = $2`,
        [roleId, projectId],
      )

      // Also remove all user assignments for this role
      await query(`DELETE FROM user_project_roles WHERE project_id = $1 AND role_name = $2`, [
        projectId,
        existing.rows[0].name,
      ])

      res.json({
        success: true,
        message: `Role '${existing.rows[0].name}' deleted successfully`,
        data: { deletedId: roleId },
      })
    } catch (error) {
      next(error)
    }
  }

  // List members with a specific role
  listRoleMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params
      const projectId = req.identity!.project_id

      // First, get the role name
      const roleResult = await query(
        `SELECT name FROM project_roles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (roleResult.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      const roleName = roleResult.rows[0].name

      // Get all user assignments
      const result = await query(
        `SELECT user_id, role_name, assigned_at, assigned_by, expires_at
         FROM user_project_roles
         WHERE project_id = $1 AND role_name = $2
         ORDER BY assigned_at DESC`,
        [projectId, roleName],
      )

      res.json({
        success: true,
        message: `Retrieved ${result.rows.length} member(s) with role '${roleName}'`,
        data: result.rows,
      })
    } catch (error) {
      next(error)
    }
  }

  // Assign role to a user
  assignRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params
      const { userId, expiresAt } = req.body

      if (!userId) {
        throw new AppError(400, "INVALID_INPUT", "userId is required")
      }

      const projectId = req.identity!.project_id
      const assignedBy = req.identity!.user_id || req.identity!.api_key_id

      // Get the role name
      const roleResult = await query(
        `SELECT name FROM project_roles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (roleResult.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      const roleName = roleResult.rows[0].name

      // Insert or update assignment
      await query(
        `INSERT INTO user_project_roles (user_id, project_id, role_name, assigned_at, assigned_by, expires_at)
         VALUES ($1, $2, $3, NOW(), $4, $5)
         ON CONFLICT (user_id, project_id, role_name) 
         DO UPDATE SET assigned_at = NOW(), assigned_by = $4, expires_at = $5`,
        [userId, projectId, roleName, assignedBy, expiresAt || null],
      )

      res.status(201).json({
        success: true,
        message: `Role '${roleName}' assigned to user successfully`,
        data: { userId, roleName, projectId },
      })
    } catch (error) {
      next(error)
    }
  }

  // Remove role from a user
  removeRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId, userId } = req.params
      const projectId = req.identity!.project_id

      // Get the role name
      const roleResult = await query(
        `SELECT name FROM project_roles WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [roleId, projectId],
      )

      if (roleResult.rows.length === 0) {
        throw new AppError(404, "ROLE_NOT_FOUND", "Role not found or access denied")
      }

      const roleName = roleResult.rows[0].name

      // Remove assignment
      const result = await query(
        `DELETE FROM user_project_roles WHERE user_id = $1 AND project_id = $2 AND role_name = $3`,
        [userId, projectId, roleName],
      )

      if (result.rowCount === 0) {
        throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "Role assignment not found")
      }

      res.json({
        success: true,
        message: `Role '${roleName}' removed from user successfully`,
        data: { userId, roleName },
      })
    } catch (error) {
      next(error)
    }
  }
}
