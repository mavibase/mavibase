"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { usePathname } from "next/navigation"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "@/components/ui/skeleton"
import { ToastNotifications } from "@/components/toast-notification"

interface TeamData {
  id: string
  name: string
  slug: string
  description: string | null
  tier: string
  is_personal: boolean
  avatar_url: string | null
  created_at: string
}

interface TeamContextValue {
  team: TeamData | null
  loading: boolean
  fetchTeam: () => Promise<void>
}

const TeamContext = createContext<TeamContextValue>({
  team: null,
  loading: true,
  fetchTeam: async () => {},
})

export function useTeamContext() {
  return useContext(TeamContext)
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [team, setTeam] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamId, setTeamId] = useState<string | null>(null)

  // Read team ID from localStorage (single source of truth)
  useEffect(() => {
    const storedTeamId = localStorage.getItem("mavibase-selected-team-id")
    setTeamId(storedTeamId)

    // Listen for storage changes (when team is switched in another tab or component)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "mavibase-selected-team-id") {
        setTeamId(e.newValue)
      }
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const fetchTeam = async () => {
    const currentTeamId = localStorage.getItem("mavibase-selected-team-id")
    if (!currentTeamId) return
    try {
      const response = await axiosInstance.auth.get(`/teams/${currentTeamId}`)
      if (response.data.success) {
        setTeam(response.data.data.team)
      }
    } catch {
      // silently fail — team data is non-critical for this layout
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (teamId) {
      fetchTeam()
    } else {
      setLoading(false)
    }
  }, [teamId])

  // create-new page manages its own full-screen layout
  if (pathname === "/team/create-new") {
    return <>{children}</>
  }

  return (
    <TeamContext.Provider value={{ team, loading, fetchTeam }}>
      <div className="min-h-screen bg-background">
        <main className="p-6 max-w-6xl mx-auto">
          {loading ? (
            <div className="animate-pulse">
              <div className="mb-6">
                <Skeleton className="bg-muted w-48 h-8 mb-2" />
                <Skeleton className="bg-muted w-64 h-4" />
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
          ) : !team ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">No team selected. Please select or create a team.</p>
            </div>
          ) : (
            children
          )}
        </main>
        <ToastNotifications />
      </div>
    </TeamContext.Provider>
  )
}
