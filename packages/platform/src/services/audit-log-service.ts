import { pool } from "@mavibase/platform/config/database"
import { logger } from "@mavibase/platform/utils/logger"

export type AuditLogScope =
  | "user"
  | "team"
  | "project"
  | "database"
  | "collection"
  | "document"
  | "system"

export type AuditActorType = "USER" | "SYSTEM"

export interface AuditLogEvent {
  scope: AuditLogScope
  actorId?: string | null
  targetId?: string | null
  action: string
  metadata?: Record<string, any>
  timestamp?: Date
}

function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(v)) return true
  if (["0", "false", "no", "n", "off"].includes(v)) return false
  return defaultValue
}

function getRetentionDays(): number {
  const raw = Number.parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || "30", 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 30
}

function getUserRetentionMax(): number {
  const raw = Number.parseInt(process.env.AUDIT_LOG_RETENTION_USER || "50", 10)
  return Number.isFinite(raw) && raw > 0 ? raw : 50
}

function isAuditEnabled(scope: AuditLogScope): boolean {
  const globalEnabled = envBool(process.env.AUDIT_LOGS, true)
  if (!globalEnabled) return false

  if (scope === "user") {
    return envBool(process.env.AUDIT_LOGS_USER, true)
  }

  return true
}

/**
 * Central audit log persistence. Designed to be non-intrusive:
 * - Swallows persistence errors (logs to app logger only)
 * - Applies env toggles and retention policies
 */
export const AuditLogService = {
  isEnabled: isAuditEnabled,

  async log(event: AuditLogEvent): Promise<void> {
    try {
      if (!isAuditEnabled(event.scope)) return

      const timestamp = event.timestamp ?? new Date()
      const metadata = event.metadata ?? {}

      // Normalize common fields used by the UI
      if (!metadata.timestamp) metadata.timestamp = timestamp.toISOString()
      if (!metadata.message && typeof metadata.format === "string") {
        // Backward-compat: allow callers to pass { format: "..." }
        metadata.message = metadata.format
      }

      const client = await pool.connect()
      try {
        await client.query("BEGIN")

        await client.query(
          `INSERT INTO audit_logs (scope, actor_id, target_id, action, metadata, "timestamp")
           VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
          [event.scope, event.actorId ?? null, event.targetId ?? null, event.action, JSON.stringify(metadata), timestamp]
        )

        // User logs are rotated by max count per actorId.
        // We delete oldest logs beyond AUDIT_LOG_RETENTION_USER for this actor.
        if (event.scope === "user" && event.actorId) {
          const maxCount = getUserRetentionMax()
          await client.query(
            `DELETE FROM audit_logs
             WHERE id IN (
               SELECT id
               FROM audit_logs
               WHERE scope = 'user' AND actor_id = $1
               ORDER BY "timestamp" DESC
               OFFSET $2
             )`,
            [event.actorId, maxCount]
          )
        }

        await client.query("COMMIT")
      } catch (e) {
        await client.query("ROLLBACK")
        throw e
      } finally {
        client.release()
      }
    } catch (error: any) {
      logger.warn("Audit log persistence failed", {
        scope: event.scope,
        action: event.action,
        error: error?.message || String(error),
      })
    }
  },

  /**
   * Hard-delete old non-user audit logs using the DB function created by migration.
   */
  async purgeOldNonUserLogs(): Promise<{ deleted: boolean; retentionDays: number }> {
    const retentionDays = getRetentionDays()
    if (!envBool(process.env.AUDIT_LOGS, true)) return { deleted: false, retentionDays }

    try {
      await pool.query("SELECT purge_old_audit_logs($1)", [retentionDays])
      return { deleted: true, retentionDays }
    } catch (error: any) {
      logger.warn("Audit log purge failed", { error: error?.message || String(error) })
      return { deleted: false, retentionDays }
    }
  },

  getConfig(): { enabled: boolean; userEnabled: boolean; retentionDays: number; userMax: number } {
    return {
      enabled: envBool(process.env.AUDIT_LOGS, true),
      userEnabled: envBool(process.env.AUDIT_LOGS_USER, true),
      retentionDays: getRetentionDays(),
      userMax: getUserRetentionMax(),
    }
  },
}

