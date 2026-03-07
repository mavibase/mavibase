"use client"

import { ProjectTabsHeader } from "../components/project-tabs-header"
import { ProjectUsage } from "@/app/project/components/project-usage"
import { useProjectContext } from "@/contexts/project-context"

export default function ProjectUsagePage() {
  const { project } = useProjectContext()

  if (!project) return null

  return (
    <>
      <ProjectTabsHeader />
      <ProjectUsage projectId={project.id} />
    </>
  )
}
