"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Home,
  BarChart2,
  Settings,
  BookOpen,
  MessageSquare,
  ChevronDown,
  Check,
  Plus,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Database,
  ArrowLeft,
  FileJson,
  BarChart,
  Columns3,
  Zap,
  Shield,
  Link as LinkIcon,
  Loader2,
  Search,
  FileText,
  Settings2,
  Globe,
  Boxes,
  Bot,
  Cpu,
  HardDrive,
  Key,
  Radio,
  Rocket,
  Info,
  Users,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from "@/components/ui/sheet"
import AppLogo from "@/assets/components/app-logo"
import { useProjectContext, type Team, type Project } from "@/contexts/project-context"
import { useAuthContext } from "@/contexts/auth-context"
import axiosInstance from "@/lib/axios-instance"
import { CreateCollectionDialog } from "@/components/create-collection-dialog"

/* ------------------------------------------------------------------ */
/*  Collection/database data fetched from API (cached in memory)      */
/* ------------------------------------------------------------------ */
const collectionsCache: Record<string, { slug: string; name: string; icon: React.ElementType; docCount: number }[]> = {}
const dbNamesCache: Record<string, string> = {}

export function getCollectionsForDb(dbId: string) {
  return collectionsCache[dbId] || []
}

export function setCollectionsForDb(dbId: string, collections: { slug: string; name: string; icon: React.ElementType; docCount: number }[]) {
  collectionsCache[dbId] = collections
}

export function getDbName(dbId: string) {
  return dbNamesCache[dbId] || dbId
}

export function setDbName(dbId: string, name: string) {
  dbNamesCache[dbId] = name
}

export function clearCollectionsCache(dbId: string) {
  delete collectionsCache[dbId]
}

/* ------------------------------------------------------------------ */
/*  Collection sub-tabs                                               */
/* ------------------------------------------------------------------ */
const COLLECTION_TABS = [
  { slug: "documents", label: "Documents", icon: FileText },
  { slug: "attributes", label: "Attributes", icon: Columns3 },
  { slug: "indexes", label: "Indexes", icon: Zap },
  { slug: "permissions", label: "Permissions", icon: Shield },
  { slug: "activity", label: "Activity", icon: FileJson },
  { slug: "usage", label: "Usage", icon: BarChart2 },
  { slug: "settings", label: "Settings", icon: Settings },
  { slug: "relationships", label: "Relationships", icon: LinkIcon },
]

/* ------------------------------------------------------------------ */
/*  Main nav structure (matches the screenshots + user's requirements) */
/* ------------------------------------------------------------------ */
const NAV_SECTIONS = [
  {
    items: [
      { label: "Overview", href: "overview", icon: Home },
      { label: "Databases", href: "databases", icon: Database },
      { label: "Authentication", href: "authentication", icon: Key },
      { label: "Realtime", href: "realtime", icon: Radio },
      { label: "Edge Functions", href: "edge-functions", icon: Zap },
      { label: "Storage", href: "storage", icon: HardDrive },
      { label: "Deployments", href: "deployments", icon: Rocket },
    ],
  },
  {
    items: [
      { label: "Team", href: "team", icon: Users },
      { label: "Project", href: "project", icon: Layers },
    ],
  },
  {
    items: [
      { label: "Documentation", href: "#", icon: BookOpen },
      { label: "Support", href: "#", icon: MessageSquare },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Team logo bubble                                                   */
/* ------------------------------------------------------------------ */
function TeamBubble({ name, avatarUrl, className }: { name: string; avatarUrl?: string | null; className?: string }) {
  const colors = [
    "bg-green-500", "bg-blue-500", "bg-indigo-500",
    "bg-orange-500", "bg-pink-500", "bg-teal-500",
  ]
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  
  if (avatarUrl) {
    return (
      <img 
        src={avatarUrl} 
        alt="" 
        className={cn("rounded-full shrink-0 bg-secondary", className)}
      />
    )
  }
  
  return (
    <div className={cn("flex items-center justify-center rounded-full text-white text-[10px] font-bold shrink-0", colors[idx], className)}>
      {name ? name[0].toUpperCase() : "?"}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  User dropdown menu                                                 */
/* ------------------------------------------------------------------ */
function UserDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuthContext()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [onClose])

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U"

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border border-border bg-popover shadow-xl z-50 overflow-hidden"
    >
      {/* User info header */}
      <div className="px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          {user?.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt="" 
              className="size-8 rounded-full shrink-0 bg-secondary"
            />
          ) : (
            <div className="size-8 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            {user?.name && (
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            )}
            <p className="text-xs text-muted-foreground truncate">{user?.email || "account"}</p>
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="py-1">
        <Link
          href="/account/informations"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          <Info className="size-4 text-muted-foreground shrink-0" />
          <span>Informations</span>
        </Link>
        <Link
          href="/account/settings"
          onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
        >
          <Settings className="size-4 text-muted-foreground shrink-0" />
          <span>Settings</span>
        </Link>
      </div>

      {/* Theme toggle */}
      {mounted && (
        <div className="px-3 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1.5">Theme</p>
          <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
            {[
              { value: "light", icon: Sun, label: "Light" },
              { value: "dark", icon: Moon, label: "Dark" },
              { value: "system", icon: Monitor, label: "System" },
            ].map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs transition-colors",
                  theme === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3" />
               
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="py-1 border-t border-border">
        <button
          onClick={() => { onClose(); logout() }}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="size-4 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Find dialog: portal-based, proper backdrop + z-index               */
/* ------------------------------------------------------------------ */
function FindDialog({
  open,
  onClose,
  mode,
}: {
  open: boolean
  onClose: () => void
  mode: "team" | "project"
}) {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const [query, setQuery] = useState("")
  const [teams, setTeams] = useState<Team[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<"team" | "project">(mode)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) { setQuery(""); setStep(mode); setSelectedTeam(null); return }
    setTimeout(() => inputRef.current?.focus(), 50)
    fetchTeams()
  }, [open, mode])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.auth.get("/teams")
      setTeams(res.data?.data?.teams || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const fetchProjects = async (team: Team) => {
    setLoading(true)
    try {
      const res = await axiosInstance.auth.get(`/projects/team/${team.id}`)
      const fetched = res.data?.data?.projects || []
      setProjects(fetched)
      // If team has no projects, redirect to create-new
      if (fetched.length === 0) {
        localStorage.setItem("mavibase-selected-team-id", team.id)
        onClose()
        router.push("/project/create-new")
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team)
    setQuery("")
    setStep("project")
    fetchProjects(team)
    // Persist the team selection to localStorage + backend (silently, no context update yet)
    localStorage.setItem("mavibase-selected-team-id", team.id)
    axiosInstance.auth.post("/users/me/select-team", { teamId: team.id })
      .catch(() => { /* silent */ })
  }

  const handleSelectProject = (project: Project, team: Team) => {
    localStorage.setItem("mavibase-selected-team-id", team.id)
    localStorage.setItem("mavibase-selected-project-id", project.id)
    // Persist to backend + update auth context only when navigating away
    axiosInstance.auth.post("/users/me/select-project", { projectId: project.id })
      .catch(() => { /* silent */ })
    router.push(`/${team.slug}/${project.slug}/overview`)
    onClose()
  }

  const filteredTeams = teams.filter(t =>
    !query || t.name.toLowerCase().includes(query.toLowerCase())
  )
  const filteredProjects = projects.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  )

  if (!mounted || !open) return null

  const dialog = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[14vh]"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          {step === "project" && selectedTeam && (
            <button
              onClick={() => { setStep("team"); setSelectedTeam(null); setQuery("") }}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={step === "team" ? "Search teams..." : `Search projects in ${selectedTeam?.name}...`}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Breadcrumb */}
        {step === "project" && selectedTeam && (
          <div className="flex items-center gap-1.5 px-4 py-2 bg-secondary/40 border-b border-border">
            <TeamBubble name={selectedTeam.name} avatarUrl={selectedTeam.avatar_url} className="size-4" />
            <span className="text-xs font-medium text-foreground">{selectedTeam.name}</span>
            {selectedTeam.tier && (
              <span className="text-[10px] border border-border rounded px-1.5 py-px text-muted-foreground ml-0.5">
                {selectedTeam.tier}
              </span>
            )}
            <ChevronRight className="size-3 text-muted-foreground/50 mx-0.5" />
            <span className="text-xs text-muted-foreground">Select project</span>
          </div>
        )}

        {/* Section label */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {step === "team" ? "Teams" : "Projects"}
          </p>
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto pb-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : step === "team" ? (
            <>
              {filteredTeams.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No teams found</p>
              )}
              {filteredTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60 text-left group",
                    team.slug === teamSlug ? "bg-secondary/40" : ""
                  )}
                >
                  <TeamBubble name={team.name} avatarUrl={team.avatar_url} className="size-6 shrink-0" />
                  <span className="truncate text-foreground flex-1 font-medium">{team.name}</span>
                  {team.tier && (
                    <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-px shrink-0">
                      {team.tier}
                    </span>
                  )}
                  {team.slug === teamSlug
                    ? <Check className="size-3.5 text-foreground shrink-0" />
                    : <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  }
                </button>
              ))}
            </>
          ) : (
            <>
              {filteredProjects.length === 0 && !loading && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No projects found</p>
              )}
              {filteredProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelectProject(project, selectedTeam!)}
                  className={cn(
                    "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors hover:bg-secondary/60 text-left group",
                    project.slug === projectSlug && selectedTeam?.slug === teamSlug ? "bg-secondary/40" : ""
                  )}
                >
                  <div className="size-6 shrink-0 rounded-md bg-secondary flex items-center justify-center text-muted-foreground">
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="truncate text-foreground flex-1 font-medium">{project.name}</span>
                  {project.slug === projectSlug && selectedTeam?.slug === teamSlug
                    ? <Check className="size-3.5 text-foreground shrink-0" />
                    : <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  }
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-border px-4 py-2.5">
          {step === "team" ? (
            <Link
              href="/team/create-new"
              onClick={onClose}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Create Team</span>
            </Link>
          ) : (
            <Link
              href="/project/create-new"
              onClick={() => {
                if (selectedTeam) {
                  localStorage.setItem("mavibase-selected-team-id", selectedTeam.id)
                }
                onClose()
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Create Project</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(dialog, document.body)
}

/* ------------------------------------------------------------------ */
/*  Sidebar header: Logo + team/project switcher                       */
/* ------------------------------------------------------------------ */
function SidebarHeader() {
  const params = useParams()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const { team: currentTeam, project: currentProject } = useProjectContext()
  const [findOpen, setFindOpen] = useState(false)

  return (
    <>
      {/* Logo row */}
      <div className="flex items-center px-4 py-3 border-b border-border">
        <AppLogo type="long" height={18} width={105} className="dark:brightness-0 dark:invert" />
      </div>

      {/* Team + Project switcher — single pill button */}
      <div className="px-3 py-2.5 border-b border-border">
        <button
          onClick={() => setFindOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm bg-secondary/50 hover:bg-secondary border border-border/60 transition-colors group"
        >
          <TeamBubble name={currentTeam?.name || teamSlug} avatarUrl={currentTeam?.avatar_url} className="size-5 shrink-0" />
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground truncate max-w-[68px]">
              {currentTeam?.name || teamSlug}
            </span>
            {currentTeam?.tier && (
              <span className="text-[10px] border border-border rounded px-1 py-px text-muted-foreground shrink-0 leading-tight">
                {currentTeam.tier}
              </span>
            )}
            <ChevronRight className="size-3 text-muted-foreground/40 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate max-w-[68px]">
              {currentProject?.name || projectSlug}
            </span>
          </div>
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0 group-hover:text-foreground transition-colors" />
        </button>
      </div>

      <FindDialog open={findOpen} onClose={() => setFindOpen(false)} mode="team" />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Collection sidebar nav (inside databases/[dbId])                  */
/* ------------------------------------------------------------------ */
function CollectionNav({ basePath, dbId }: { basePath: string; dbId: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const collectionSlug = params.collectionSlug as string | undefined
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const [collections, setCollections] = useState(getCollectionsForDb(dbId))
  const [dbName, setDbNameState] = useState(getDbName(dbId))
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const fetchCollections = useCallback(async () => {
    setLoadingCollections(true)
    try {
      const dbRes = await axiosInstance.db.get(`/v1/db/databases/${dbId}`)
      if (dbRes.data?.data?.name) {
        setDbName(dbId, dbRes.data.data.name)
        setDbNameState(dbRes.data.data.name)
      }
      const colRes = await axiosInstance.db.get(`/v1/db/databases/${dbId}/collections`)
      const rawCollections = colRes.data?.data || []
      const mapped = rawCollections.map((c: any) => ({
        slug: c.id,
        name: c.name,
        icon: FileJson,
        docCount: c.document_count || 0,
      }))
      setCollectionsForDb(dbId, mapped)
      setCollections(mapped)
    } catch {
      // Silently fail
    } finally {
      setLoadingCollections(false)
    }
  }, [dbId])

  useEffect(() => {
    if (getCollectionsForDb(dbId).length > 0) {
      setCollections(getCollectionsForDb(dbId))
      setDbNameState(getDbName(dbId))
      return
    }
    fetchCollections()
  }, [dbId, fetchCollections])

  const handleCollectionCreated = () => {
    clearCollectionsCache(dbId)
    fetchCollections().then(() => {
      const updated = getCollectionsForDb(dbId)
      if (updated.length > 0) {
        const newest = updated[updated.length - 1]
        router.push(`/${teamSlug}/${projectSlug}/databases/${dbId}/${newest.slug}/documents`)
      }
    })
  }

  return (
    <div
      className="flex flex-col gap-0.5"
      style={{ animation: "slide-in-from-right 0.22s cubic-bezier(0.16,1,0.3,1)" }}
    >
      {/* Back button */}
      <Link
        href={`${basePath}/databases`}
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mb-2"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Databases</span>
      </Link>

      {/* DB header */}
      <div className="flex items-center gap-2.5 px-2 pb-2 mb-1 border-b border-border">
        <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="size-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground truncate">{dbName}</span>
      </div>

      {/* Collections label */}
      <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        Collections
      </p>

      {loadingCollections ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : collections.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground italic">No collections yet</p>
      ) : (
        <div className="flex flex-col gap-px">
          {collections.map((col) => {
            const collectionBasePath = `${basePath}/databases/${dbId}/${col.slug}`
            const isActive = collectionSlug === col.slug

            return (
              <div key={col.slug}>
                {/* Collection row */}
                <Link
                  href={`${collectionBasePath}/documents`}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-all group",
                    isActive
                      ? "text-foreground font-medium bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <div className={cn(
                    "size-5 rounded flex items-center justify-center shrink-0 transition-colors",
                    isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground group-hover:text-foreground"
                  )}>
                    <FileJson className="size-3" />
                  </div>
                  <span className="truncate flex-1 text-xs font-medium">{col.name}</span>
                  <span className={cn(
                    "text-[10px] tabular-nums font-medium shrink-0",
                    isActive ? "text-muted-foreground" : "text-muted-foreground/50"
                  )}>
                    {col.docCount > 0 ? col.docCount.toLocaleString() : "0"}
                  </span>
                </Link>

                {/* Sub-tabs when active */}
                {isActive && (
                  <div
                    className="ml-3.5 mt-0.5 mb-1.5 border-l-2 border-border pl-2.5 flex flex-col gap-px"
                    style={{ animation: "slide-in-from-right 0.18s cubic-bezier(0.16,1,0.3,1)" }}
                  >
                    {COLLECTION_TABS.map((tab) => {
                      const tabPath = `${collectionBasePath}/${tab.slug}`
                      const isTabActive = pathname === tabPath || pathname.startsWith(tabPath + "/")
                      return (
                        <Link
                          key={tab.slug}
                          href={tabPath}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
                            isTabActive
                              ? "text-foreground font-medium bg-secondary"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                          )}
                        >
                          <tab.icon className="size-3 shrink-0" />
                          <span>{tab.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create collection */}
      {!loadingCollections && (
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors mt-2 w-full"
        >
          <Plus className="size-3.5 shrink-0" />
          <span>Create collection</span>
        </button>
      )}

      <CreateCollectionDialog
        dbId={dbId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCollectionCreated}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main nav items                                                     */
/* ------------------------------------------------------------------ */
function MainNavItems({ basePath }: { basePath: string }) {
  const pathname = usePathname()

  const isItemActive = (item: { href: string }) => {
    const fullHref = `${basePath}/${item.href}`
    if (item.href === "overview") return pathname === fullHref
    if (item.href === "project") return pathname.startsWith(`${basePath}/project`)
    return pathname.startsWith(fullHref)
  }

  return (
    <div
      className="flex flex-col"
      style={{ animation: "slide-in-from-left 0.22s cubic-bezier(0.16,1,0.3,1)" }}
    >
      {NAV_SECTIONS.map((section, sectionIdx) => (
        <div
          key={sectionIdx}
          className={cn(
            "flex flex-col gap-0.5",
            sectionIdx > 0 && "mt-1 pt-1 border-t border-border/50"
          )}
        >
          {section.items.map((item) => {
            const Icon = item.icon
            const href = `${basePath}/${item.href}`
            const isActive = isItemActive(item)

            return (
              <Link
                key={item.label}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-foreground font-medium bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {("hasArrow" in item) && item.hasArrow && (
                  <ChevronRight className="size-3.5 text-muted-foreground/60" />
                )}
              </Link>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  User footer with dropdown                                          */
/* ------------------------------------------------------------------ */
function UserFooter() {
  const { user } = useAuthContext()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || "U"

  return (
    <div className="relative px-2 py-2 border-t border-border">
      <button
        onClick={() => setDropdownOpen(v => !v)}
        className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-secondary transition-colors"
      >
        {user?.avatar_url ? (
          <img 
            src={user.avatar_url} 
            alt="" 
            className="size-6 rounded-full shrink-0 bg-secondary"
          />
        ) : (
          <div className="size-6 rounded-full bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
            {initials}
          </div>
        )}
        <span className="text-xs text-foreground truncate flex-1 min-w-0 text-left">
          {user?.name || user?.email || "Account"}
        </span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform shrink-0", dropdownOpen && "rotate-180")} />
      </button>

      {dropdownOpen && <UserDropdown onClose={() => setDropdownOpen(false)} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop sidebar                                                    */
/* ------------------------------------------------------------------ */
function DesktopSidebar() {
  const params = useParams()
  const pathname = usePathname()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string | undefined
  const basePath = `/${teamSlug}/${projectSlug}`
  const inDatabaseDetail = pathname.includes("/databases/") && dbId

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="hidden lg:flex flex-col border-r border-border bg-sidebar h-screen sticky top-0 w-[220px] shrink-0">
        <SidebarHeader />

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {inDatabaseDetail ? (
            <CollectionNav basePath={basePath} dbId={dbId} />
          ) : (
            <MainNavItems basePath={basePath} />
          )}
        </nav>

        <UserFooter />
      </aside>
    </TooltipProvider>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile: Team/Project switcher sheet (full team → project flow)     */
/* ------------------------------------------------------------------ */
function MobileSwitcher() {
  const params = useParams()
  const router = useRouter()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const { team: currentTeam, project: currentProject } = useProjectContext()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"team" | "project">("team")
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")

  const fetchTeams = async () => {
    setLoading(true)
    try {
      const res = await axiosInstance.auth.get("/teams")
      setTeams(res.data?.data?.teams || [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const fetchProjects = async (team: Team) => {
    setLoading(true)
    try {
      const res = await axiosInstance.auth.get(`/projects/team/${team.id}`)
      const fetched = res.data?.data?.projects || []
      setProjects(fetched)
      // If team has no projects, redirect to create-new
      if (fetched.length === 0) {
        localStorage.setItem("mavibase-selected-team-id", team.id)
        setOpen(false)
        router.push("/project/create-new")
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  const handleOpen = () => {
    setOpen(true)
    setStep("team")
    setSelectedTeam(null)
    setQuery("")
    fetchTeams()
  }

  const handleSelectTeam = (team: Team) => {
    setSelectedTeam(team)
    setQuery("")
    setStep("project")
    fetchProjects(team)
    // Persist team selection to localStorage + backend (silently, no context update)
    localStorage.setItem("mavibase-selected-team-id", team.id)
    axiosInstance.auth.post("/users/me/select-team", { teamId: team.id })
      .catch(() => { /* silent */ })
  }

  const handleSelectProject = (project: Project, team: Team) => {
    localStorage.setItem("mavibase-selected-team-id", team.id)
    localStorage.setItem("mavibase-selected-project-id", project.id)
    // Persist to backend (no setUser to avoid re-render before navigation)
    axiosInstance.auth.post("/users/me/select-project", { projectId: project.id })
      .catch(() => { /* silent */ })
    router.push(`/${team.slug}/${project.slug}/overview`)
    setOpen(false)
  }

  const filteredTeams = teams.filter(t =>
    !query || t.name.toLowerCase().includes(query.toLowerCase())
  )
  const filteredProjects = projects.filter(p =>
    !query || p.name.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
      >
        <TeamBubble name={currentTeam?.name || teamSlug} className="size-5" />
        <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
          {currentTeam?.name || teamSlug}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border-t border-border bg-popover shadow-2xl overflow-hidden pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                {step === "project" && (
                  <button
                    onClick={() => { setStep("team"); setSelectedTeam(null); setQuery("") }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <span className="text-sm font-semibold text-foreground">
                  {step === "team" ? "Switch Team" : `${selectedTeam?.name}`}
                </span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
              <Search className="size-3.5 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={step === "team" ? "Search teams..." : "Search projects..."}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="max-h-[50vh] overflow-y-auto py-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : step === "team" ? (
                <>
                  {filteredTeams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => handleSelectTeam(team)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-secondary transition-colors"
                    >
                      <TeamBubble name={team.name} className="size-6" />
                      <span className="truncate text-foreground flex-1">{team.name}</span>
                      {team.tier && (
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                          {team.tier}
                        </span>
                      )}
                      {team.slug === teamSlug && <Check className="size-4 text-foreground shrink-0" />}
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1 px-4 py-3">
                    <Link
                      href="/team/create-new"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="size-4" />
                      <span>Create Team</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {filteredProjects.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No projects found</p>
                  ) : (
                    filteredProjects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => handleSelectProject(project, selectedTeam!)}
                        className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-secondary transition-colors"
                      >
                        <div className="size-6 flex items-center justify-center text-muted-foreground shrink-0">
                          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <span className="truncate text-foreground flex-1">{project.name}</span>
                        {project.slug === projectSlug && selectedTeam?.slug === teamSlug && (
                          <Check className="size-4 text-foreground shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                  <div className="border-t border-border mt-1 pt-1 px-4 py-3">
                    <Link
                      href="/project/create-new"
                      onClick={() => {
                        if (selectedTeam) {
                          localStorage.setItem("mavibase-selected-team-id", selectedTeam.id)
                        }
                        setOpen(false)
                      }}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="size-4" />
                      <span>Create Project</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile sidebar (sheet drawer)                                      */
/* ------------------------------------------------------------------ */
function MobileSheet() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuthContext()
  const teamSlug = params.teamSlug as string
  const projectSlug = params.projectSlug as string
  const dbId = params.dbId as string | undefined
  const basePath = `/${teamSlug}/${projectSlug}`
  const inDatabaseDetail = pathname.includes("/databases/") && dbId
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false)
  const { team: currentTeam, project: currentProject } = useProjectContext()

  const isItemActive = (item: { href: string }) => {
    const fullHref = `${basePath}/${item.href}`
    if (item.href === "overview") return pathname === fullHref
    if (item.href === "project") return pathname.startsWith(`${basePath}/project`)
    return pathname.startsWith(fullHref)
  }

  const handleMobileCollectionCreated = () => {
    if (dbId) {
      clearCollectionsCache(dbId)
      router.push(`/${teamSlug}/${projectSlug}/databases/${dbId}`)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[280px] p-0 bg-sidebar border-r border-border [&>button]:hidden"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <AppLogo type="long" height={20} className="dark:brightness-0 dark:invert" />
            <SheetClose asChild>
              <button
                className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </SheetClose>
          </div>

          {/* Team + project info */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
            <TeamBubble name={currentTeam?.name || teamSlug} className="size-4" />
            <span className="text-xs font-medium text-foreground truncate max-w-[70px]">
              {currentTeam?.name || teamSlug}
            </span>
            <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
            <span className="text-xs font-medium text-foreground truncate max-w-[70px]">
              {currentProject?.name || projectSlug}
            </span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {inDatabaseDetail ? (
              <div className="flex flex-col gap-0.5">
                <SheetClose asChild>
                  <Link
                    href={`${basePath}/databases`}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mb-1"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Back to Databases</span>
                  </Link>
                </SheetClose>

                <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                  <Database className="size-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground truncate">{getDbName(dbId!)}</span>
                </div>

                <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Collections
                </p>

                {getCollectionsForDb(dbId!).map((col) => {
                  const collectionBasePath = `${basePath}/databases/${dbId}/${col.slug}`
                  const isCollActive = pathname.startsWith(collectionBasePath + "/") || pathname === collectionBasePath

                  return (
                    <div key={col.slug} className="flex flex-col">
                      <SheetClose asChild>
                        <Link
                          href={`${collectionBasePath}/documents`}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                            isCollActive
                              ? "text-primary font-medium bg-primary/5"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                          )}
                        >
                          <col.icon className="size-4 shrink-0" />
                          <span className="truncate">{col.name}</span>
                        </Link>
                      </SheetClose>

                      {isCollActive && (
                        <div className="flex flex-col gap-0.5 ml-4 pl-2 border-l border-border mt-0.5 mb-1">
                          {COLLECTION_TABS.map((tab) => {
                            const tabPath = `${collectionBasePath}/${tab.slug}`
                            const isTabActive = pathname === tabPath
                            return (
                              <SheetClose key={tab.slug} asChild>
                                <Link
                                  href={tabPath}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors",
                                    isTabActive
                                      ? "text-primary font-medium bg-primary/5"
                                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                  )}
                                >
                                  <tab.icon className="size-3.5 shrink-0" />
                                  <span>{tab.label}</span>
                                </Link>
                              </SheetClose>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={() => setMobileCreateOpen(true)}
                  className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mt-1"
                >
                  <Plus className="size-3.5" />
                  <span>Create collection</span>
                </button>

                {dbId && (
                  <CreateCollectionDialog
                    dbId={dbId}
                    open={mobileCreateOpen}
                    onOpenChange={setMobileCreateOpen}
                    onCreated={handleMobileCollectionCreated}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {NAV_SECTIONS.map((section, sectionIdx) => (
                  <div key={sectionIdx} className={cn("flex flex-col gap-0.5", sectionIdx > 0 && "mt-1 pt-1 border-t border-border/50")}>
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const href = `${basePath}/${item.href}`
                      const isActive = isItemActive(item)

                      return (
                        <SheetClose key={item.label} asChild>
                          <Link
                            href={href}
                            className={cn(
                              "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors",
                              isActive
                                ? "text-foreground font-medium bg-secondary"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="flex-1">{item.label}</span>
                            {("hasArrow" in item) && item.hasArrow && (
                              <ChevronRight className="size-3.5 text-muted-foreground/60" />
                            )}
                          </Link>
                        </SheetClose>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
          </nav>

          {/* User footer in sheet */}
          <UserFooter />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile header bar                                                  */
/* ------------------------------------------------------------------ */
function MobileHeader() {
  return (
    <header className="lg:hidden flex items-center justify-between px-3 py-2 border-b border-border bg-sidebar sticky top-0 z-30">
      <MobileSwitcher />
      <MobileSheet />
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Export: wraps mobile header + desktop sidebar                      */
/* ------------------------------------------------------------------ */
export function DashboardSidebar() {
  return (
    <>
      <MobileHeader />
      <DesktopSidebar />
    </>
  )
}
