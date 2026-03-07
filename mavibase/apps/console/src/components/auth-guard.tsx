"use client"

import { useAuthContext } from "@/contexts/auth-context"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import { AppLogoLoader } from "@/components/app-logo-loader"

const PUBLIC_ROUTES = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
]

/**
 * Routes that work for BOTH logged-in and logged-out users.
 * Logged-out users are redirected to login with a redirect param.
 * Logged-in users see the page normally (no redirect to "/").
 */
const HYBRID_ROUTES = [
  "/account/accept-invite",
    "/account/verify-email",
]

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext()
  const pathname = usePathname()
  const router = useRouter()

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  const isHybridRoute = HYBRID_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  )

  useEffect(() => {
    if (loading) return

    if (!user && !isPublicRoute && !isHybridRoute) {
      router.replace("/auth/login")
    }

    // Only redirect logged-in users away from pure public routes (login, register, etc.)
    // Hybrid routes (accept-invite) should be accessible to logged-in users
    if (user && isPublicRoute) {
      router.replace("/")
    }
  }, [user, loading, isPublicRoute, isHybridRoute, router])

  if (loading) {
    return <AppLogoLoader />
  }

  if (!user && !isPublicRoute && !isHybridRoute) {
    return <AppLogoLoader />
  }

  if (user && isPublicRoute) {
    return <AppLogoLoader />
  }

  return <>{children}</>
}
