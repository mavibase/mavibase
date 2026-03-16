"use client"

import { ProjectTabsHeader } from "../components/project-tabs-header"
import { useProjectContext } from "@/contexts/project-context"
import { AuditLogsViewer } from "@/components/audit-logs-viewer"

export default function ProjectAuditLogsPage() {
  const { project } = useProjectContext()
  if (!project) return null

  return (
    <>
      <ProjectTabsHeader />
      <AuditLogsViewer
        defaultScope="project"
        defaultTargetId={project.id}
        projectId={project.id}
        teamId={project.team_id}
      />
    </>
  )
}

