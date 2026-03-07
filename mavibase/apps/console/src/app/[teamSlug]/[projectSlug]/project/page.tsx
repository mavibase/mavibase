"use client"

import { ProjectTabsHeader } from "./components/project-tabs-header"
import { useProjectContext } from "@/contexts/project-context"

export default function ProjectGeneralPage() {
  const { project } = useProjectContext()

  if (!project) return null

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })

  return (
    <>
      <ProjectTabsHeader />
      <div className="max-w-full flex flex-col gap-6">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Project ID</span>
              <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">{project.id}</code>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Slug</span>
              <span className="text-sm text-foreground">{project.slug}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Environment</span>
              <span className="text-sm text-foreground capitalize">{project.environment}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className="text-sm text-foreground capitalize">{project.status}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Created</span>
              <span className="text-sm text-foreground">{project.created_at ? formatDate(project.created_at) : "-"}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
