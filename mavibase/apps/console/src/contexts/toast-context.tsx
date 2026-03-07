"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type ToastType = "success" | "error" | "loading"

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => string
  removeToast: (id: string) => void
  updateToast: (id: string, message: string, type: ToastType) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])

    if (type !== "loading") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    }

    return id
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateToast = useCallback((id: string, message: string, type: ToastType) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, message, type } : t))
    )

    if (type !== "loading") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToastContext must be used within a ToastProvider")
  }
  return context
}
