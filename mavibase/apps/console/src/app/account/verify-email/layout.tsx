import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Verify your email address - Backendly",
  description: "Create your Backendly account to start building with our platform",
}

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
