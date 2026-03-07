export type Team = {
  slug: string
  name: string
  projects: Project[]
}

export type Project = {
  slug: string
  name: string
  domain: string
  status: "live" | "draft"
  lastUpdated: string
  lastUpdatedBy: string
  previewImage: string
}

export const teams: Team[] = [
  {
    slug: "misgadev",
    name: "misgadev",
    projects: [
      {
        slug: "mint-starter-kit",
        name: "Mint Starter Kit",
        domain: "misgadev.mintlify.app",
        status: "live",
        lastUpdated: "1 minute ago",
        lastUpdatedBy: "Manual Update",
        previewImage: "/project-preview.jpg",
      },
    ],
  },
  {
    slug: "acme-corp",
    name: "acme-corp",
    projects: [
      {
        slug: "api-docs",
        name: "API Docs",
        domain: "docs.acme.dev",
        status: "live",
        lastUpdated: "3 hours ago",
        lastUpdatedBy: "Git Push",
        previewImage: "/project-preview.jpg",
      },
      {
        slug: "developer-guide",
        name: "Developer Guide",
        domain: "guide.acme.dev",
        status: "draft",
        lastUpdated: "1 day ago",
        lastUpdatedBy: "Manual Update",
        previewImage: "/project-preview.jpg",
      },
    ],
  },
]

export const activities = [
  {
    id: "1",
    name: "mintlify-bot",
    date: "Feb 26, 2:34 AM",
    status: "Successful" as const,
    changes: "Initial commit",
    filesChanged: "31 files added",
    type: "bot" as const,
  },
  {
    id: "2",
    name: "Manual Update",
    date: "Feb 26, 2:34 AM",
    status: "Successful" as const,
    changes: "",
    filesChanged: "",
    type: "manual" as const,
  },
]

export type NavItem = {
  label: string
  href: string
  icon: string
  badge?: string
}

export type NavSection = {
  title?: string
  items: NavItem[]
}

export const mainNavSections: NavSection[] = [
  {
    items: [
      { label: "Overview", href: "overview", icon: "home" },
      { label: "Editor", href: "overview", icon: "file-edit", badge: "New" },
      { label: "Analytics", href: "overview", icon: "bar-chart-2" },
      { label: "Databases", href: "databases", icon: "database" },
      { label: "Team", href: "team", icon: "users" },
      { label: "Project", href: "project", icon: "settings" },
    ],
  },
  {
    title: "Products",
    items: [
      { label: "Agent", href: "overview", icon: "circle-plus" },
      { label: "Assistant", href: "overview", icon: "message-circle" },
      { label: "Authentication", href: "overview", icon: "lock" },
      { label: "MCP server", href: "overview", icon: "diamond" },
    ],
  },
]

export const bottomNavItems: NavItem[] = [
  { label: "Documentation", href: "#", icon: "book-open" },
  { label: "Invite members", href: "#", icon: "users" },
  { label: "Support", href: "#", icon: "message-square" },
]
