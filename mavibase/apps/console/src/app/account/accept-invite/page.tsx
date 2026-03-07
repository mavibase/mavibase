"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuthContext } from "@/contexts/auth-context"
import axiosInstance from "@/lib/axios-instance"
import AppLogo from "@/assets/components/app-logo"
function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, refreshUser } = useAuthContext()
  const [status, setStatus] = useState<"loading" | "no-invite" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const inviteId = searchParams.get("inviteId") || searchParams.get("token")

  useEffect(() => {
    if (authLoading) return

    if (!inviteId) {
      setStatus("no-invite")
      setMessage("No invitation ID provided. Please check the link you received.")
      return
    }

    if (!user) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/account/accept-invite?inviteId=${inviteId}`)}`)
      return
    }

    acceptInvite()
  }, [authLoading, user, inviteId])

  const acceptInvite = async () => {
    try {
      const response = await axiosInstance.auth.post(`/teams/invites/${inviteId}/accept`)

      if (response.data?.success) {
        setStatus("success")
        setMessage("You've successfully joined the team!")
        await refreshUser()
        setTimeout(() => {
          router.push("/")
        }, 2000)
      } else {
        throw new Error(response.data?.error?.message || "Failed to accept invitation")
      }
    } catch (error: any) {
      setStatus("error")
      const errorMessage = error.response?.data?.error?.message || error.message || "Failed to accept invitation"
      setMessage(errorMessage)
    }
  }

  if (authLoading) {
    return (
      <div className="dotted-bg fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="dotted-bg fixed inset-0 flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex flex-col items-center gap-6 p-8 text-center">
            <AppLogo type="short" width={36} height={36} />

            {status === "loading" && (
              <>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Accepting invitation</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please wait while we process your invitation...
                  </p>
                </div>
                <Loader2 className="size-6 text-muted-foreground animate-spin" />
              </>
            )}

            {status === "no-invite" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10">
                  <AlertTriangle className="size-6 text-amber-500" />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Invalid link</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <Button onClick={() => router.push("/")} className="w-full">
                  Go back home
                </Button>
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="size-6 text-success" />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Success!</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <p className="text-xs text-muted-foreground">Redirecting automatically...</p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="size-6 text-destructive" />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Something went wrong</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <Button onClick={() => router.push("/")} className="w-full">
                  Go back home
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="dotted-bg fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}
