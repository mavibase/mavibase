"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { ToastProvider } from "@/components/custom-toast"
import { ContentFooter } from "@/components/content-footer"
import { ProjectProvider, type Team, type Project } from "@/contexts/project-context"
import { useAuthContext } from "@/contexts/auth-context"
import { EmailVerificationBanner } from "@/components/email-verification-banner"
import axiosInstance from "@/lib/axios-instance"
import { Loader2, ShieldAlert } from "lucide-react"
import { AppLogoLoader } from "@/components/app-logo-loader"

export default function TeamProjectLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthContext()

  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string

  const [team, setTeam] = useState<Team | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [unauthorized, setUnauthorized] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolveTeamAndProject = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setUnauthorized(false)
    setError(null)

    try {
      // Fetch user's teams
      const teamsRes = await axiosInstance.auth.get("/teams")
      const teams: Team[] = teamsRes.data?.data?.teams || []

      // Find the team by slug
      const foundTeam = teams.find((t) => t.slug === teamSlug)

      if (!foundTeam) {
        // User is not a member of this team
        setUnauthorized(true)
        setLoading(false)
        return
      }

      // Fetch projects for this team
      const projectsRes = await axiosInstance.auth.get(`/projects/team/${foundTeam.id}`)
      const projects: Project[] = projectsRes.data?.data?.projects || []

      // Find the project by slug
      const foundProject = projects.find((p) => p.slug === projectSlug)

      if (!foundProject) {
        // Project doesn't exist or user doesn't have access
        setUnauthorized(true)
        setLoading(false)
        return
      }

      // Persist selections
      localStorage.setItem("mavibase-selected-team-id", foundTeam.id)
      localStorage.setItem("mavibase-selected-project-id", foundProject.id)

      setTeam(foundTeam)
      setProject(foundProject)
    } catch (err: any) {
      if (err?.response?.status === 403 || err?.response?.status === 401) {
        setUnauthorized(true)
      } else {
        setError("Failed to load workspace. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [user, teamSlug, projectSlug])

  useEffect(() => {
    resolveTeamAndProject()
  }, [resolveTeamAndProject])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <AppLogoLoader />
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <div className="flex items-center justify-center size-14 rounded-2xl bg-destructive/10">
          <ShieldAlert className="size-6 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Unauthorized</h2>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          You do not have access to this workspace. Please contact the team owner to get an invitation.
        </p>
        <button
          onClick={() => router.replace("/")}
          className="text-sm text-primary underline mt-2"
        >
          Go to your workspace
        </button>
      </div>
    )
  }

  if (error || !team || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <p className="text-sm text-destructive">{error || "Something went wrong"}</p>
        <button
          onClick={() => resolveTeamAndProject()}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <ProjectProvider team={team} project={project}>
      <ToastProvider>
        <EmailVerificationBanner />
        <div className="flex flex-col lg:flex-row h-screen bg-background overflow-hidden">
          <DashboardSidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              <div className="w-full 2xl:max-w-6xl 2xl:mx-auto">
                {children}
              </div>
            </main>
            <ContentFooter />
          </div>
        </div>
      </ToastProvider>
    </ProjectProvider>
  )
}
