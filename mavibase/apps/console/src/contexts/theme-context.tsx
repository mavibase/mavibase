"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type Theme = "light" | "dark" | "system"

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = "mavibase-theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system")
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light")

  // Resolve system preference
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window === "undefined") return "light"
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }

  const applyTheme = (t: Theme) => {
    const resolved = t === "system" ? getSystemTheme() : t
    setResolvedTheme(resolved)
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(resolved)
  }

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    const initial = stored ?? "system"
    setThemeState(initial)
    applyTheme(initial)

    // Watch system preference changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (theme === "system") applyTheme("system")
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
