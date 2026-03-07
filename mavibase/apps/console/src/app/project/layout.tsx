"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import axiosInstance from "@/lib/axios-instance"
import { useAuthContext } from "@/contexts/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { ToastNotifications } from "@/components/toast-notification"

interface ProjectData {
  id: string
  name: string
  slug: string
  description: string | null
  environment: string
  status: string
  team_id: string
  created_at: string
  metadata: Record<string, any> | null
}

interface ProjectManagementContextValue {
  project: ProjectData | null
  loading: boolean
  fetchProject: () => Promise<void>
}

const ProjectManagementContext = createContext<ProjectManagementContextValue>({
  project: null,
  loading: true,
  fetchProject: async () => {},
})

export function useProjectManagementContext() {
  return useContext(ProjectManagementContext)
}

export default function ProjectManagementLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuthContext()
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)

  const projectId = user?.selected_project_id

  const fetchProject = async () => {
    if (!projectId) return
    try {
      const response = await axiosInstance.auth.get(`/projects/${projectId}`)
      if (response.data.success) {
        setProject(response.data.data.project)
      }
    } catch {
      // silently fail — project data is non-critical for this layout
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (projectId) {
      fetchProject()
    } else {
      setLoading(false)
    }
  }, [projectId])

  // create-new page manages its own full-screen layout
  if (pathname === "/project/create-new") {
    return <>{children}</>
  }

  return (
    <ProjectManagementContext.Provider value={{ project, loading, fetchProject }}>
      <div className="min-h-screen bg-background">
        <main className="p-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="animate-pulse">
              <div className="mb-6">
                <Skeleton className="bg-muted w-48 h-8 mb-2" />
                <Skeleton className="bg-muted w-64 h-4 mb-2" />
                <Skeleton className="bg-muted w-32 h-3" />
              </div>
              <div className="flex gap-4 mb-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="bg-muted w-24 h-10 rounded" />
                ))}
              </div>
              <Skeleton className="bg-muted w-full h-5" />
              <Skeleton className="bg-muted w-full h-5 mt-2" />
              <Skeleton className="bg-muted w-full h-5 mt-2" />
            </div>
          ) : !project ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No project selected. Please select or create a project.</p>
            </div>
          ) : (
            children
          )}
        </main>
        <ToastNotifications />
      </div>
    </ProjectManagementContext.Provider>
  )
}
