"use client"

import { AccountInformations } from "./components/account-informations"

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <main className="p-4 sm:p-6 lg:p-8 w-full max-w-4xl mx-auto">
        <h1 className="text-2xl text-foreground mb-5 text-balance">Account</h1>
        <AccountInformations />
      </main>
    </div>
  )
}
