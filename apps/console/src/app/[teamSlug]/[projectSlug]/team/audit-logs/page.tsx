"use client"

import { TeamTabsHeader } from "../components/team-tabs-header"
import { useTeamContext } from "../layout"
import { AuditLogsViewer } from "@/components/audit-logs-viewer"

export default function TeamAuditLogsPage() {
  const { team } = useTeamContext()
  if (!team) return null

  return (
    <>
      <TeamTabsHeader />
      <AuditLogsViewer
        defaultScope="team"
        defaultTargetId={team.id}
        teamId={team.id}
      />
    </>
  )
}

