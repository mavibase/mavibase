import { AuditLogService } from "@mavibase/platform/services/audit-log-service"
import { logger } from "@mavibase/platform/utils/logger"

let _started = false
let _lastRunAt: string | null = null
let _lastResult: { deleted: boolean; retentionDays: number } | null = null

function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const v = value.trim().toLowerCase()
  if (["1", "true", "yes", "y", "on"].includes(v)) return true
  if (["0", "false", "no", "n", "off"].includes(v)) return false
  return defaultValue
}

/**
 * Best-effort retention job. Non-intrusive:
 * - Runs periodically (default daily)
 * - Uses the DB-side purge function for non-user logs
 */
export function startAuditLogRetentionJob(): void {
  if (_started) return
  _started = true

  if (!envBool(process.env.AUDIT_LOGS, true)) return

  const intervalHours = Number.parseInt(process.env.AUDIT_LOG_RETENTION_INTERVAL_HOURS || "24", 10)
  const intervalMs = Number.isFinite(intervalHours) && intervalHours > 0
    ? intervalHours * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000

  const run = async () => {
    _lastRunAt = new Date().toISOString()
    _lastResult = await AuditLogService.purgeOldNonUserLogs()
    logger.info("Audit log retention run complete", { ..._lastResult, at: _lastRunAt })
  }

  // Run once shortly after startup, then on interval
  setTimeout(() => { void run() }, 30_000).unref?.()
  const timer = setInterval(() => { void run() }, intervalMs)
  timer.unref?.()
}

export function getAuditRetentionStatus(): {
  started: boolean
  lastRunAt: string | null
  lastResult: { deleted: boolean; retentionDays: number } | null
} {
  return { started: _started, lastRunAt: _lastRunAt, lastResult: _lastResult }
}

