"use client"

import { ProjectTabsHeader } from "../components/project-tabs-header"
import { ProjectSettings } from "@/app/project/components/project-settings"
import { useProjectContext } from "@/contexts/project-context"

export default function ProjectSettingsPage() {
  const { project } = useProjectContext()

  if (!project) return null

  return (
    <>
      <ProjectTabsHeader />
      <ProjectSettings project={project} />
    </>
  )
}
