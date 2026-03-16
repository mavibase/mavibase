import { Router } from "express"
import { requireAuth } from "../../middleware/auth-middleware"
import { getAuditLogStatus, getAuditLogUsage, listAuditLogs } from "../../controllers/v1/audit-logs/AuditLogController"

const router = Router()

router.get("/", requireAuth, listAuditLogs)
router.get("/usage", requireAuth, getAuditLogUsage)
router.get("/status", requireAuth, getAuditLogStatus)

export default router

