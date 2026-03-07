import type { ReactNode } from "react"
import Image from "next/image"

import { Separator } from "@/components/ui/separator"
import AppLogo from "@/assets/components/app-logo"

import bgImage from "@/assets/diambg.webp"

export default function Layout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        
        {/* LEFT SIDE - Background Image */}
        <div className="relative order-2 hidden h-full overflow-hidden rounded-3xl lg:flex">
          
          {/* Background Image */}
          <Image
            src={bgImage}
            alt="Background"
            fill
            priority
            className="object-cover"
          />

          {/* Optional dark overlay for readability */}
          <div className="absolute inset-0 bg-primary/20" />

          {/* Top Content */}
          <div className="absolute top-10 space-y-1 px-10 text-shadow-primary-foreground">
            <div className="flex items-center gap-2">
              <AppLogo type="long" width={140} height={60} />
            </div>
            <p className="text-sm">Build backends in minutes.</p>
          </div>

          {/* Bottom Content */}
          <div className="absolute bottom-10 flex w-full justify-between px-10 text-shadow-primary-foreground">
            <div className="flex-1 space-y-1">
              <h2 className="font-medium">Ready to launch?</h2>
              <p className="text-sm">
                Clone the repo, install dependencies, and your backend is live
                in minutes.
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
