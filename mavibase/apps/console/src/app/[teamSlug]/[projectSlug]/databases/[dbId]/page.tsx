"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function DatabaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string

  useEffect(() => {
    router.replace(`/${teamSlug}/${projectSlug}/databases/${dbId}/collections`)
  }, [router, teamSlug, projectSlug, dbId])

  return null
}
