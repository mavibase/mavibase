"use client"

import { useEffect, useState, useCallback, createContext, useContext } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { setDbName } from "@/components/dashboard-sidebar"
import { useToast } from "@/components/custom-toast"
import { useProjectContext } from "@/contexts/project-context"

/* ------------------------------------------------------------------ */
/*  Database context – share db info with child routes                  */
/* ------------------------------------------------------------------ */
interface DbInfo {
  id: string
  name: string
  description?: string
}

interface DatabaseContextValue {
  db: DbInfo | null
  setDb: React.Dispatch<React.SetStateAction<DbInfo | null>>
  loading: boolean
  refreshDb: () => Promise<void>
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  setDb: () => {},
  loading: true,
  refreshDb: async () => {},
})

export function useDatabaseContext() {
  return useContext(DatabaseContext)
}

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */
export default function DatabaseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { projectId, teamId } = useProjectContext()

  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string

  const [db, setDb] = useState<DbInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDb = useCallback(async () => {
    // Wait until project context headers are available
    if (!projectId || !teamId) return

    setLoading(true)
    try {
      const res = await axiosInstance.db.get(`/v1/db/databases/${dbId}`)
      const data = res.data?.data
      if (data) {
        setDb({ id: data.id, name: data.name, description: data.description })
        setDbName(dbId, data.name)
      }
    } catch (err: any) {
      // Only redirect on 404 (database truly not found), not on transient errors
      if (err?.response?.status === 404) {
        router.replace(`/${teamSlug}/${projectSlug}/databases`)
      } else {
        toast({ message: "Failed to load database", type: "error" })
      }
    } finally {
      setLoading(false)
    }
  }, [dbId, teamSlug, projectSlug, router, projectId, teamId, toast])

  useEffect(() => {
    fetchDb()
  }, [fetchDb])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <DatabaseContext.Provider value={{ db, setDb, loading, refreshDb: fetchDb }}>
      {children}
    </DatabaseContext.Provider>
  )
}
