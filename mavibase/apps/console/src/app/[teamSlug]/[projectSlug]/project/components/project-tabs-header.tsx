"use client"

import { useRouter, usePathname, useParams } from "next/navigation"
import { Info, Key, BarChart3, Settings } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useProjectContext } from "@/contexts/project-context"

const envColors: Record<string, string> = {
  production: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-xs",
  staging: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs",
  development: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-xs",
}

export function ProjectTabsHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const { project } = useProjectContext()

  if (!project) return null

  const basePath = `/${teamSlug}/${projectSlug}/project`

  const tabs = [
    { id: "general", label: "General", icon: Info, href: basePath },
    { id: "api-keys", label: "API Keys", icon: Key, href: `${basePath}/api-keys` },
    { id: "usage", label: "Usage", icon: BarChart3, href: `${basePath}/usage` },
    { id: "settings", label: "Settings", icon: Settings, href: `${basePath}/settings` },
  ] as const

  const activeTab = tabs.find((tab) => {
    if (tab.href === basePath) return pathname === basePath
    return pathname.startsWith(tab.href)
  })?.id || "general"

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl text-foreground">{project.name}</h1>
          <span className="capitalize">
            <Badge className={envColors[project.environment || ""] || ""}>
              {project.environment}
            </Badge>
          </span>
        </div>
        {project.description && (
          <p className="text-[13px] text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => router.push(tab.href)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 cursor-pointer text-sm font-medium transition-colors relative whitespace-nowrap",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
            )}
          </button>
        ))}
      </div>
    </>
  )
}
