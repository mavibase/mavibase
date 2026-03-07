"use client"

import { useState, useEffect } from "react"
import { Mail, AlertTriangle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import axiosInstance from "@/lib/axios-instance"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

const isEmailServiceEnabled = process.env.NEXT_PUBLIC_ENABLE_EMAIL_SERVICE === "true"

interface InviteMemberDialogProps {
  teamId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

const roles = [
  { value: "member", label: "Member", desc: "Can view and contribute to team projects." },
  { value: "viewer", label: "Viewer", desc: "Read-only access to team projects." },
  { value: "admin", label: "Admin", desc: "Can manage members and project settings." },
]

export function InviteMemberDialog({ teamId, open, onOpenChange, onSuccess }: InviteMemberDialogProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail("")
      setRole("member")
      setShowRoleDropdown(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!email) return

    setIsSubmitting(true)
    try {
      const response = await axiosInstance.auth.post(`/teams/${teamId}/invite`, {
        email,
        role,
      })

      if (response.data.success) {
        toast.success("Invitation sent successfully")
        setEmail("")
        setRole("member")
        onOpenChange(false)
        onSuccess()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || "Failed to send invitation")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedRole = roles.find(r => r.value === role)!

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Invite Team Member</SheetTitle>
          <SheetDescription>
            Send an invitation to a new team member.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-5">
          {/* Email service disabled warning */}
          {!isEmailServiceEnabled && (
            <div className="flex flex-col gap-3 p-4 border border-amber-500/30 bg-amber-500/5 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium text-foreground">Email Service Disabled</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Invitations require the email service. Set both variables to <strong>true</strong> in your <code>.env</code> file:
              </p>
              <div className="flex flex-col gap-1.5">
                <code className="text-xs bg-background rounded px-2 py-1 text-muted-foreground border border-border">
                  ENABLE_EMAIL_SERVICE=true
                </code>
                <code className="text-xs bg-background rounded px-2 py-1 text-muted-foreground border border-border">
                  NEXT_PUBLIC_ENABLE_EMAIL_SERVICE=true
                </code>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="w-full h-10 px-3 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground outline-none"
              disabled={!isEmailServiceEnabled}
              autoFocus={isEmailServiceEnabled}
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Role</label>
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                disabled={!isEmailServiceEnabled}
                className="w-full h-10 px-3 text-sm border border-border rounded-md bg-background text-foreground flex items-center justify-between hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                <span>{selectedRole.label}</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {showRoleDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
                  {roles.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => { setRole(r.value); setShowRoleDropdown(false) }}
                      className={cn(
                        "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                        role === r.value ? "bg-primary/10 text-primary" : "text-foreground"
                      )}
                    >
                      <span className="font-medium">{r.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{selectedRole.desc}</p>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!email.trim() || isSubmitting || !isEmailServiceEnabled}
            className="flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {isSubmitting ? "Sending..." : "Send Invitation"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
