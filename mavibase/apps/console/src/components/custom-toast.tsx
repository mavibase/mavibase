"use client"

import { useState, useEffect, useCallback, createContext, useContext } from "react"
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react"
import { cn } from "@/lib/utils"

type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  description?: string
  type: ToastType
}

interface ToastContextValue {
  toast: (opts: { message: string; description?: string; type?: ToastType }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback(
    ({
      message,
      description,
      type = "info",
    }: {
      message: string
      description?: string
      type?: ToastType
    }) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev, { id, message, description, type }])
    },
    []
  )

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const icons: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors: Record<ToastType, string> = {
  success: "text-primary",
  error: "text-destructive",
  info: "text-blue-400",
  warning: "text-amber-400",
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: () => void
}) {
  const [exiting, setExiting] = useState(false)
  const Icon = icons[toast.type]
  const color = colors[toast.type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (exiting) {
      const timer = setTimeout(onDismiss, 300)
      return () => clearTimeout(timer)
    }
  }, [exiting, onDismiss])

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-popover p-4 shadow-lg transition-all duration-300",
        exiting
          ? "translate-y-full opacity-0"
          : "translate-y-0 opacity-100 animate-in slide-in-from-bottom-full"
      )}
    >
      <Icon className={cn("size-5 mt-0.5 shrink-0", color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.message}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={() => setExiting(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
