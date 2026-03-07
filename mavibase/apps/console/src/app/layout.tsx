import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { AuthGuard } from '@/components/auth-guard'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-geist",
});
const geistMono = Geist_Mono({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-geist-mono",
});
export const metadata: Metadata = {
  title: 'Mavibase Console',
  description: 'Backend as a Service - Manage your databases, teams, and projects',
}

export const viewport: Viewport = {
  themeColor: '#0e0e0e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
		<html
			className={`${geist.variable} ${geistMono.variable} h-full`}
			lang="en"
			suppressHydrationWarning
		>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="theme"
        >
          <AuthProvider>
            <AuthGuard>
              {children}
            </AuthGuard>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
