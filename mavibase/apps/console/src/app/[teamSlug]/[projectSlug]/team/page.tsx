"use client"

import { TeamTabsHeader } from "./components/team-tabs-header"
import { MemberList } from "@/app/team/components/member-list"
import { useTeamContext } from "./layout"

export default function TeamMembersPage() {
  const { team } = useTeamContext()

  if (!team) return null

  return (
    <>
      <TeamTabsHeader />
      <MemberList teamId={team.id} />
    </>
  )
}
