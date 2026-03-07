"use client"

import { TeamTabsHeader } from "../components/team-tabs-header"
import { InviteList } from "@/app/team/components/invite-list"
import { useTeamContext } from "../layout"

export default function TeamInvitesPage() {
  const { team } = useTeamContext()

  if (!team) return null

  return (
    <>
      <TeamTabsHeader />
      <InviteList teamId={team.id} />
    </>
  )
}
