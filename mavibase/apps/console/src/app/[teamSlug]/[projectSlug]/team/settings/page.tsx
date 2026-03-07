"use client"

import { TeamTabsHeader } from "../components/team-tabs-header"
import { TeamSettings } from "@/app/team/components/team-settings"
import { useTeamContext } from "../layout"

export default function TeamSettingsPage() {
  const { team, fetchTeam } = useTeamContext()

  if (!team) return null

  return (
    <>
      <TeamTabsHeader />
      <TeamSettings team={team} onUpdate={fetchTeam} />
    </>
  )
}
