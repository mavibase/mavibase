"use client"

import { useRouter, usePathname, useParams } from "next/navigation"
import { Users, Mail, BarChart3, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTeamContext } from "../layout"

export function TeamTabsHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const { team } = useTeamContext()

  if (!team) return null

  const basePath = `/${teamSlug}/${projectSlug}/team`

  const tabs = [
    { id: "members", label: "Members", icon: Users, href: basePath },
    { id: "invites", label: "Invites", icon: Mail, href: `${basePath}/invites` },
    { id: "usage", label: "Usage", icon: BarChart3, href: `${basePath}/usage` },
    { id: "settings", label: "Settings", icon: Settings, href: `${basePath}/settings` },
  ] as const

  const activeTab = tabs.find((tab) => {
    if (tab.href === basePath) return pathname === basePath
    return pathname.startsWith(tab.href)
  })?.id || "members"

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-2xl text-foreground font-mono">{team.name} </h1>
          <div className="flex items-center gap-1">
            <span className="inline-flex font-mono items-center capitalize rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {team.tier}
            </span>
            {team.is_personal && (
              <span className="inline-flex font-mono items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                Personal
              </span>
            )}
          </div>
        </div>
        {team.description && (
          <p className="text-[13px] text-muted-foreground mt-1">{team.description}</p>
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
