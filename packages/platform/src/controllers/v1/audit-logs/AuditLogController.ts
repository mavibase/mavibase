import type { Request, Response } from "express"
import { pool } from "@mavibase/platform/config/database"
import { AuditLogService, type AuditLogScope } from "@mavibase/platform/services/audit-log-service"
import { getAuditRetentionStatus } from "@mavibase/platform/services/audit-retention"
import * as projectService from "@mavibase/platform/services/project-service"
import * as teamService from "@mavibase/platform/services/team-service"

function parseIntParam(value: any, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

function asString(value: any): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s.length ? s : undefined
}

function asScope(value: any): AuditLogScope | undefined {
  const s = asString(value)
  if (!s) return undefined
  const allowed: AuditLogScope[] = ["user", "team", "project", "database", "collection", "document", "system"]
  return allowed.includes(s as AuditLogScope) ? (s as AuditLogScope) : undefined
}

async function enforceScopeAccess(req: Request, scope: AuditLogScope, targetId?: string): Promise<{ projectId?: string; teamId?: string }> {
  if (scope === "user") return {}

  if (scope === "team") {
    if (!targetId) throw Object.assign(new Error("targetId is required for team scope"), { statusCode: 400, code: "VALIDATION_ERROR" })
    // Will throw if no access
    await teamService.getTeam(targetId, req.userId!)
    return { teamId: targetId }
  }

  if (scope === "project") {
    if (!targetId) throw Object.assign(new Error("targetId is required for project scope"), { statusCode: 400, code: "VALIDATION_ERROR" })
    const ok = await projectService.verifyProjectAccess(targetId, req.userId!)
    if (!ok) throw Object.assign(new Error("You do not have access to this project"), { statusCode: 403, code: "FORBIDDEN" })
    return { projectId: targetId }
  }

  // database/collection/document/system are project-scoped for console viewing
  const projectId = req.get("X-Project-Id") || undefined
  if (!projectId) {
    throw Object.assign(new Error("X-Project-Id header is required for this scope"), { statusCode: 400, code: "PROJECT_CONTEXT_REQUIRED" })
  }
  const ok = await projectService.verifyProjectAccess(projectId, req.userId!)
  if (!ok) throw Object.assign(new Error("You do not have access to this project"), { statusCode: 403, code: "FORBIDDEN" })
  return { projectId }
}

export const listAuditLogs = async (req: Request, res: Response) => {
  try {
    const scope = asScope(req.query.scope)
    if (!scope) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "scope is required" },
      })
    }

    const limit = Math.min(parseIntParam(req.query.limit, 50), 200)
    const offset = Math.max(parseIntParam(req.query.offset, 0), 0)

    const targetId = asString(req.query.targetId)
    const action = asString(req.query.action)
    const actorId = asString(req.query.actorId)
    const from = asString(req.query.from)
    const to = asString(req.query.to)

    const ctx = await enforceScopeAccess(req, scope, targetId)

    const where: string[] = ["scope = $1"]
    const params: any[] = [scope]
    let i = 2

    // Enforce user-scope isolation (only the current user)
    if (scope === "user") {
      where.push(`actor_id = $${i}`)
      params.push(req.userId!)
      i++
    } else if (targetId) {
      where.push(`target_id = $${i}`)
      params.push(targetId)
      i++
    }

    if (action) {
      where.push(`action = $${i}`)
      params.push(action)
      i++
    }

    if (actorId && scope !== "user") {
      where.push(`actor_id = $${i}`)
      params.push(actorId)
      i++
    }

    if (from) {
      where.push(`"timestamp" >= $${i}::timestamptz`)
      params.push(from)
      i++
    }

    if (to) {
      where.push(`"timestamp" <= $${i}::timestamptz`)
      params.push(to)
      i++
    }

    // Ensure project scoping for project-scoped scopes (prevents cross-project leakage)
    if (ctx.projectId && scope !== "project") {
      where.push(`(metadata->>'projectId') = $${i}`)
      params.push(ctx.projectId)
      i++
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`,
      params,
    )
    const total = countResult.rows[0]?.total ?? 0

    const rowsResult = await pool.query(
      `SELECT id, scope, actor_id AS "actorId", target_id AS "targetId", action, metadata, "timestamp"
       FROM audit_logs
       ${whereSql}
       ORDER BY "timestamp" DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset],
    )

    res.json({
      success: true,
      data: {
        scope,
        total,
        limit,
        offset,
        retention: AuditLogService.getConfig(),
        logs: rowsResult.rows,
      },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "AUDIT_LOGS_LIST_FAILED",
        message: error.message,
      },
    })
  }
}

export const getAuditLogUsage = async (req: Request, res: Response) => {
  try {
    // Usage excludes user logs by requirement
    const projectId = req.get("X-Project-Id") || undefined
    const teamId = req.get("X-Team-Id") || undefined

    // If context headers are present, validate access; otherwise return global usage
    if (projectId) {
      const ok = await projectService.verifyProjectAccess(projectId, req.userId!)
      if (!ok) return res.status(403).json({ error: { code: "FORBIDDEN", message: "No access to project" } })
    }
    if (teamId) {
      await teamService.getTeam(teamId, req.userId!)
    }

    const where: string[] = [`scope <> 'user'`]
    const params: any[] = []
    let i = 1

    if (projectId) {
      where.push(`(metadata->>'projectId') = $${i}`)
      params.push(projectId)
      i++
    }
    if (teamId) {
      where.push(`(metadata->>'teamId') = $${i}`)
      params.push(teamId)
      i++
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const result = await pool.query(
      `SELECT
         scope,
         COUNT(*)::int AS count,
         COALESCE(SUM(pg_column_size(metadata)), 0)::bigint AS metadata_bytes,
         MAX("timestamp") AS last_timestamp
       FROM audit_logs
       ${whereSql}
       GROUP BY scope
       ORDER BY scope`,
      params,
    )

    res.json({
      success: true,
      data: {
        retention: AuditLogService.getConfig(),
        usage: result.rows.map((r: any) => ({
          scope: r.scope,
          count: r.count,
          metadataBytes: Number(r.metadata_bytes),
          lastTimestamp: r.last_timestamp,
        })),
      },
    })
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || "AUDIT_LOG_USAGE_FAILED",
        message: error.message,
      },
    })
  }
}

export const getAuditLogStatus = async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      retention: AuditLogService.getConfig(),
      rotation: {
        nonUserHardDeleteDays: AuditLogService.getConfig().retentionDays,
        userMaxPerActor: AuditLogService.getConfig().userMax,
      },
      retentionJob: getAuditRetentionStatus(),
    },
  })
}

