import { BookOpen, ExternalLink } from "lucide-react"

export function ContentFooter() {
  return (
    <footer className="border-t border-border">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>All systems operational</span>
          </div>
          <a
            href="#"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <BookOpen className="size-3" />
            <span>Docs</span>
            <ExternalLink className="size-2.5" />
          </a>
        </div>
        <p className="text-xs">&copy; {new Date().getFullYear()} Mavibase™. Mavibase is a trademark of Eightve Limited. All rights reserved.
</p>
      </div>
    </footer>
  )
}