"use client"

import { TeamTabsHeader } from "../components/team-tabs-header"
import { TeamUsage } from "@/app/team/components/team-usage"
import { useTeamContext } from "../layout"

export default function TeamUsagePage() {
  const { team } = useTeamContext()

  if (!team) return null

  return (
    <>
      <TeamTabsHeader />
      <TeamUsage teamId={team.id} />
    </>
  )
}
