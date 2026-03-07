"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { useAuthContext } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import AppLogo from "@/assets/components/app-logo"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuthContext()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const hasVerified = useRef(false)

  useEffect(() => {
    if (hasVerified.current) return

    const token = searchParams.get("token")

    if (!token) {
      setStatus("error")
      setMessage("Invalid verification link. Please check your email and try again.")
      return
    }

    const verifyEmail = async () => {
      hasVerified.current = true

      try {
        const response = await axiosInstance.auth.get(`/auth/verify-email?token=${token}`)

        if (response.data.success) {
          setStatus("success")
          setMessage("Your email has been successfully verified!")

          try {
            await refreshUser()
          } catch {}

          setTimeout(() => {
            router.replace("/")
          }, 3000)
        }
      } catch (error: any) {
        const errorMessage = error.response?.data?.error?.message || ""
        const errorCode = error.response?.data?.error?.code || ""

        if (
          errorMessage.toLowerCase().includes("already verified") ||
          errorMessage.toLowerCase().includes("already been verified") ||
          errorCode === "ALREADY_VERIFIED"
        ) {
          setStatus("success")
          setMessage("Your email is already verified!")

          try {
            await refreshUser()
          } catch {}

          setTimeout(() => {
            router.replace("/")
          }, 2000)
        } else {
          setStatus("error")
          setMessage(
            error.response?.data?.error?.message || "Failed to verify email. The link may have expired or is invalid.",
          )
        }
      }
    }

    const timeoutId = setTimeout(() => {
      verifyEmail()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div className="dotted-bg fixed inset-0 flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex flex-col items-center gap-6 p-8 text-center">
            <AppLogo type="short" width={36} height={36} />

            {status === "loading" && (
              <>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Verifying your email</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Please wait while we verify your email address...
                  </p>
                </div>
                <Loader2 className="size-6 text-muted-foreground animate-spin" />
              </>
            )}

            {status === "success" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
                  <CheckCircle2 className="size-6 text-success" />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Email verified!</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <Button onClick={() => router.replace("/")} className="w-full">
                  Continue
                </Button>
                <p className="text-xs text-muted-foreground">Redirecting automatically...</p>
              </>
            )}

            {status === "error" && (
              <>
                <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                  <XCircle className="size-6 text-destructive" />
                </div>
                <div className="flex flex-col gap-2">
                  <h1 className="text-lg text-foreground">Verification failed</h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Button onClick={() => router.replace("/login")} className="w-full">
                    Back to login
                  </Button>
                  <Button onClick={() => router.replace("/register")} variant="outline" className="w-full">
                    Create new account
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="dotted-bg fixed inset-0 flex items-center justify-center bg-background">
          <Loader2 className="size-6 text-muted-foreground animate-spin" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
