"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axiosInstance from "@/lib/axios-instance";

const FormSchema = z.object({
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axiosInstance.auth.post("/auth/password-reset/confirm", {
        token,
        password: data.password,
      });

      if (response.data.success) {
        setIsSuccess(true);
        toast.success("Password reset successful!");
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error?.message || "Failed to reset password. The link may have expired.";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (error && !token) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <AlertCircle className="size-6 text-red-600 dark:text-red-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium text-lg">Invalid reset link</h3>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
        <Link href="/auth/forgot-password" className="w-full mt-4">
          <Button className="w-full">Request new reset link</Button>
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium text-lg">Password reset successful</h3>
          <p className="text-muted-foreground text-sm">
            Your password has been reset. You can now log in with your new password.
          </p>
        </div>
        <Link href="/auth/login" className="w-full mt-4">
          <Button className="w-full">Go to login</Button>
        </Link>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                    {...field}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="text-xs text-muted-foreground">
          Password must be at least 8 characters and contain uppercase, lowercase, and a number.
        </div>
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Resetting..." : "Reset password"}
        </Button>
        <div className="text-center">
          <Link href="/auth/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to login
          </Link>
        </div>
      </form>
    </Form>
  );
}
