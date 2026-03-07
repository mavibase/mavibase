"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthContext } from "@/contexts/auth-context"
import axiosInstance from "@/lib/axios-instance"
import { AppLogoLoader } from "@/components/app-logo-loader"

export default function Home() {
  const { user } = useAuthContext()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const resolve = async () => {
      try {
        // Fetch the user's teams
        const teamsRes = await axiosInstance.auth.get("/teams")
        const teams = teamsRes.data?.data?.teams || []

        if (teams.length === 0) {
          // User has no teams, redirect to team creation
          router.replace("/team/create-new")
          return
        }

        // Pick the first team (or user's selected team if stored)
        const selectedTeamId = localStorage.getItem("mavibase-selected-team-id")
        const team = teams.find((t: any) => t.id === selectedTeamId) || teams[0]

        // Fetch projects for that team
        const projectsRes = await axiosInstance.auth.get(`/projects/team/${team.id}`)
        const projects = projectsRes.data?.data?.projects || []

        if (projects.length === 0) {
          // Team has no projects, redirect to project creation
          localStorage.setItem("mavibase-selected-team-id", team.id)
          router.replace("/project/create-new")
          return
        }

        // Pick the first project (or user's selected project if stored)
        const selectedProjectId = localStorage.getItem("mavibase-selected-project-id")
        const project = projects.find((p: any) => p.id === selectedProjectId) || projects[0]

        // Persist selections
        localStorage.setItem("mavibase-selected-team-id", team.id)
        localStorage.setItem("mavibase-selected-project-id", project.id)

        // Redirect to the team/project overview
        router.replace(`/${team.slug}/${project.slug}/overview`)
      } catch (err: any) {
        console.error("Failed to resolve team/project:", err)
        setError("Failed to load your workspace. Please try again.")
      }
    }

    resolve()
  }, [user, router])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-primary underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return <AppLogoLoader />
}
