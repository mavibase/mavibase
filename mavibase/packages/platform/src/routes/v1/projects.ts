import { Router } from "express"
import { requireAuth } from "../../middleware/auth-middleware"
import { requireTeamMembership } from "../../middleware/project-access"
import {
  createProject,
  getProject,
  listTeamProjects,
  updateProject,
  deleteProject,
  getProjectStats,
  getProjectUsage,
  getProjectActivity,
  getProjectTimeSeries,
} from "../../controllers"
import projectRoleRoutes from "./project-roles"

const router = Router()

// All project routes require authentication
router.use(requireAuth)

// Create project (requires team membership)
router.post("/", createProject)

// Get single project
router.get("/:projectId", getProject)

router.get("/:projectId/stats", getProjectStats)
router.get("/:projectId/usage", getProjectUsage)
router.get("/:projectId/activity", getProjectActivity)
router.get("/:projectId/time-series", getProjectTimeSeries)

// List projects for a team
router.get("/team/:teamId", requireTeamMembership, listTeamProjects)

// Update project
router.patch("/:projectId", updateProject)

// Delete project
router.delete("/:projectId", deleteProject)

router.use("/", projectRoleRoutes)

export default router
