"use client"

import { useParams, useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import {
  Database,
  ArrowLeft,
  Copy,
} from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/custom-toast"
import { useDatabaseContext } from "@/app/[teamSlug]/[projectSlug]/databases/[dbId]/layout"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function truncateId(id: string) {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

/* ------------------------------------------------------------------ */
/*  Tabs config                                                        */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: "collections", label: "Collections" },
  { key: "activity", label: "Activity" },
  { key: "roles", label: "Roles" },
  { key: "slow-queries", label: "Slow Queries" },
  { key: "usage", label: "Usage" },
  { key: "settings", label: "Settings" },
] as const

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function DatabaseHeader() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const { db } = useDatabaseContext()

  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string
  const basePath = `/${teamSlug}/${projectSlug}/databases/${dbId}`

  const handleCopyId = () => {
    navigator.clipboard.writeText(dbId)
    toast({ message: "Database ID copied", type: "success" })
  }

  // Determine active tab from pathname
  const segments = pathname.split("/")
  const afterDbId = segments[segments.indexOf(dbId) + 1] || "collections"
  const activeTab = TABS.find((t) => t.key === afterDbId)?.key
    ?? TABS.find((t) => afterDbId.startsWith(t.key))?.key
    ?? "collections"

  return (
    <div className="flex flex-col gap-0 p-4 sm:p-6 lg:p-8 pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/${teamSlug}/${projectSlug}/databases`)}
          className="flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground truncate">
            {db?.name || dbId}
          </h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-secondary rounded-md px-2 py-1 shrink-0">
            <Database className="size-3" />
            {truncateId(dbId)}
            <button
              onClick={handleCopyId}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="size-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          router.push(`${basePath}/${value}`)
        }}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} asChild>
              <Link href={`${basePath}/${tab.key}`}>
                {tab.label}
              </Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
