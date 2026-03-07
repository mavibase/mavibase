"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import axiosInstance from "@/lib/axios-instance"
import { useAuthContext } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import { Check, ArrowLeft, Database, Lock, Activity, Layers, GitBranch, Monitor, Sun, Moon } from "lucide-react"
import AppLogo from "@/assets/components/app-logo"
import Link from "next/link"
import { useTheme } from "next-themes"

const FormSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Project name must be at least 2 characters" })
    .max(50, { message: "Project name must be less than 50 characters" }),
  description: z
    .string()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
  environment: z.enum(["development", "staging", "production"], {
    required_error: "Please select an environment",
  }),
})

const FEATURES = [
  {
    icon: Database,
    title: "Database & Storage",
    description: "Provision databases, buckets, and edge caches instantly.",
  },
  {
    icon: Lock,
    title: "Authentication",
    description: "Built-in auth with social login, magic links, and JWTs.",
  },
  {
    icon: Activity,
    title: "Realtime & Edge",
    description: "Live subscriptions and globally distributed edge functions.",
  },
  {
    icon: Layers,
    title: "Multiple environments",
    description: "Separate dev, staging, and production configs per project.",
  },
  {
    icon: GitBranch,
    title: "Deployments",
    description: "One-click deploys with automatic rollbacks and previews.",
  },
]

const ENV_LABELS: Record<string, { label: string; hint: string }> = {
  development: { label: "Development", hint: "Local iteration and testing" },
  staging: { label: "Staging", hint: "Pre-production QA environment" },
  production: { label: "Production", hint: "Live environment for end users" },
}

export default function CreateProjectPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthContext()
  const { theme, setTheme } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      description: "",
      environment: "development",
    },
  })

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    // Read team ID at submit time to get the freshest value
    const resolvedTeamId =
      (typeof window !== "undefined" && localStorage.getItem("mavibase-selected-team-id")) ||
      user?.selected_team_id

    if (!resolvedTeamId) {
      toast.error("No team selected. Please create or select a team first.")
      router.push("/team/create-new")
      return
    }

    setIsLoading(true)
    try {
      const response = await axiosInstance.auth.post("/projects", {
        teamId: resolvedTeamId,
        name: data.name,
        description: data.description,
        environment: data.environment,
      })

      if (response.data.success) {
        toast.success("Project created successfully!")
        await refreshUser()
        router.push("/")
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error?.message ||
        "Failed to create project. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] shrink-0 flex-col justify-between bg-card border-r border-border px-10 py-10">
        {/* Logo */}
        <div>
          <AppLogo type="long" height={24} className="dark:brightness-0 dark:invert mb-12" />

          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            New project
          </p>
          <h2 className="text-2xl font-semibold text-foreground text-balance mb-2">
            Everything your app needs, ready to go
          </h2>
          <p className="text-sm text-muted-foreground text-pretty mb-10">
            Each project comes with a full suite of backend infrastructure —
            database, auth, realtime, edge functions, and storage — all in one
            place.
          </p>

          <ul className="flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3.5">
                <div className="mt-0.5 size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Mavibase. All rights reserved.
          </p>
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
            {[
              { value: "light",  Icon: Sun     },
              { value: "system", Icon: Monitor },
              { value: "dark",   Icon: Moon    },
            ].map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "rounded p-1.5 transition-colors",
                  theme === value
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={value}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel (form) ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-4 sm:px-8 py-10">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <AppLogo type="long" height={22} className="dark:brightness-0 dark:invert" />
        </div>

        <div className="w-full max-w-xl mx-auto">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 group"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to dashboard
          </Link>

          {/* Page header — icon + title + subtitle */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
            <div className="size-11 rounded-lg border border-border bg-secondary flex items-center justify-center shrink-0">
              <Layers className="size-5 text-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground leading-tight">
                Create a project
              </h1>
              <p className="text-sm text-primary mt-0.5">
                Set up a new project in your team workspace.
              </p>
            </div>
          </div>

          {/* Form — no card wrapper */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-foreground">
                      Project name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="my-awesome-project"
                        autoComplete="off"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs font-medium text-foreground">
                        Description
                      </FormLabel>
                      <span className="text-[10px] text-muted-foreground">Optional</span>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder="What does this project do?"
                        className="resize-none text-sm"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="environment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-foreground">
                      Environment
                    </FormLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(ENV_LABELS).map(([value, { label, hint }]) => {
                        const isSelected = field.value === value
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => field.onChange(value)}
                            className={cn(
                              "flex items-center gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
                              isSelected
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-border/80 hover:bg-muted/40"
                            )}
                          >
                            <div className={cn(
                              "size-4 rounded flex items-center justify-center shrink-0 border transition-colors",
                              isSelected
                                ? "bg-primary border-primary"
                                : "bg-transparent border-muted-foreground/40"
                            )}>
                              {isSelected && <Check className="size-2.5 text-primary-foreground stroke-[3]" />}
                            </div>
                            <div className="min-w-0">
                              <p className={cn(
                                "text-sm font-medium leading-none",
                                isSelected ? "text-foreground" : "text-muted-foreground"
                              )}>
                                {label}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button className="w-full" type="submit" disabled={isLoading}>
                  {isLoading ? "Creating project..." : "Create project"}
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  You can change these settings later in the project settings.
                </p>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}
