"use client"

import { ProjectTabsHeader } from "../components/project-tabs-header"
import { ApiKeysView } from "@/app/project/components/api-keys-view"
import { useProjectContext } from "@/contexts/project-context"

export default function ProjectApiKeysPage() {
  const { project } = useProjectContext()

  if (!project) return null

  return (
    <>
      <ProjectTabsHeader />
      <ApiKeysView projectId={project.id} />
    </>
  )
}
