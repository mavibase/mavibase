import type { ReactNode } from "react"
import Image from "next/image"
import AppLogo from "@/assets/components/app-logo"
import bgImage from "@/assets/diambg.webp"

export default function AcceptInviteLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        {/* LEFT SIDE - Background Image */}
        <div className="relative order-2 hidden h-full overflow-hidden rounded-3xl lg:flex">
          <Image
            src={bgImage}
            alt="Background"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-primary/20" />

          <div className="absolute top-10 space-y-1 px-10 text-shadow-primary-foreground">
            <div className="flex items-center gap-2">
              <AppLogo type="long" width={140} height={60} />
            </div>
            <p className="text-sm">Build backends in minutes.</p>
          </div>

          <div className="absolute bottom-10 flex w-full justify-between px-10 text-shadow-primary-foreground">
            <div className="flex-1 space-y-1">
              <h2 className="font-medium">Team Invitation</h2>
              <p className="text-sm">
                You have been invited to join a team. Accept the invitation to start collaborating.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="relative order-1 flex h-full">
          {children}
        </div>
      </div>
    </main>
  )
}
