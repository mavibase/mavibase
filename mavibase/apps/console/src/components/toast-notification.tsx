"use client"

import { CheckCircle2, X, AlertCircle, Loader2 } from "lucide-react"
import { useToastContext } from "@/contexts/toast-context"
import type { ToastType } from "@/contexts/toast-context"

const toastConfig: Record<ToastType, { icon: typeof CheckCircle2; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "text-emerald-500",
  },
  error: {
    icon: AlertCircle,
    className: "text-red-500",
  },
  loading: {
    icon: Loader2,
    className: "text-muted-foreground animate-spin",
  },
}

export function ToastNotifications() {
  const { toasts, removeToast } = useToastContext()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-md px-4">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type]
        const Icon = config.icon
        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-3 shadow-lg animate-in slide-in-from-bottom-5 fade-in duration-300"
          >
            <Icon className={`w-5 h-5 shrink-0 ${config.className}`} />
            <span className="text-sm text-foreground flex-1">{toast.message}</span>
            {toast.type !== "loading" && (
              <button
                onClick={() => removeToast(toast.id)}
                className="p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
