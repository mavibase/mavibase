"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { setRequestContext, clearRequestContext } from "@/lib/axios-instance"

const SIDEBAR_STORAGE_KEY = "mavibase-sidebar-collapsed"

export interface Team {
  id: string
  name: string
  slug: string
  description?: string
  tier?: string
  is_personal?: boolean
  avatar_url?: string | null
  owner_id?: string
  role?: string
  created_at?: string
}

export interface Project {
  id: string
  name: string
  slug: string
  description?: string
  team_id: string
  environment?: string
  status?: string
  region?: string
  created_at?: string
}

interface ProjectContextType {
  team: Team | null
  project: Project | null
  teamId: string | null
  projectId: string | null
  // Sidebar collapse state lives here so all slug-based pages share it
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

interface ProjectProviderProps {
  children: ReactNode
  team: Team
  project: Project
}

export function ProjectProvider({ children, team, project }: ProjectProviderProps) {
  // Set request context SYNCHRONOUSLY so child components fetching on mount
  // always see the correct project/team headers.
  // The useEffect cleanup handles clearing on unmount.
  if (team?.id && project?.id) {
    setRequestContext(team.id, project.id)
  }

  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() => {
    if (typeof window === "undefined") return false
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (stored !== null) return stored === "true"
    return window.innerWidth < 768
  })

  // Clean up on unmount only
  useEffect(() => {
    // Also set on mount (covers HMR / strict-mode double-invoke)
    if (team?.id && project?.id) {
      setRequestContext(team.id, project.id)
    }
    return () => {
      clearRequestContext()
    }
  }, [team?.id, project?.id])

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setSidebarCollapsedState(collapsed)
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed))
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsedState((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return (
    <ProjectContext.Provider
      value={{
        team,
        project,
        teamId: team.id,
        projectId: project.id,
        sidebarCollapsed,
        setSidebarCollapsed,
        toggleSidebar,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjectContext must be used within ProjectProvider")
  return ctx
}
