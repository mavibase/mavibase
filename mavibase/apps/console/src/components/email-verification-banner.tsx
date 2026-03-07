"use client"

import { Mail, ShieldAlert, CheckCircle2, Loader2 } from "lucide-react"
import { useAuthContext } from "@/contexts/auth-context"
import { useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import { Button } from "@/components/ui/button"
import AppLogo from "@/assets/components/app-logo"

export function EmailVerificationBanner() {
  const { user } = useAuthContext()
  const [isResending, setIsResending] = useState(false)
  const [resendStatus, setResendStatus] = useState<"idle" | "success" | "error">("idle")
  const [resendMessage, setResendMessage] = useState("")

  // Check if email service is enabled
  const isEmailServiceEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_SERVICE === 'true'

  // Don't show banner if email service is disabled, user is verified, or not logged in
  if (!isEmailServiceEnabled || !user || user.email_verified) {
    return null
  }

  const handleResendEmail = async () => {
    setIsResending(true)
    setResendStatus("idle")
    setResendMessage("")

    try {
      const response = await axiosInstance.auth.post("/auth/resend-verification", {
        email: user.email
      })

      if (response.data.success) {
        setResendStatus("success")
        setResendMessage("Verification email sent! Check your inbox.")
      }
    } catch (error: any) {
      setResendStatus("error")
      setResendMessage(error.response?.data?.error?.message || "Failed to resend email. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="dotted-bg fixed inset-0 z-[9999999999] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="flex flex-col items-center gap-6 p-8 text-center">
            {/* Logo */}
            <AppLogo type="short" width={36} height={36}/>
            {/* Heading & description */}
            <div className="flex flex-col gap-2">
              <h1 className="text-lg text-foreground">
                Verify your email to continue
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                In order to have access to all Mavibase features including managing databases, teams, and projects — we need to confirm your email address. we sent the email to <span className="font-mono text-xs text-accent-foreground">{user.email}</span>. Please check your inbox and click the verification link to proceed.
              </p>
            </div>
            {/* Feedback message */}
            {resendMessage && (
              <div className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs w-full ${
                resendStatus === "success"
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}>
                {resendStatus === "success" && <CheckCircle2 className="size-3.5 shrink-0" />}
                {resendMessage}
              </div>
            )}

            {/* CTA */}
            <Button
              onClick={handleResendEmail}
              disabled={isResending}
              variant="outline"
            >
              {isResending ? (
                <>
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="size-4" />
                  Resend
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              {"Didn't receive it? Check your spam folder or resend above."}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
