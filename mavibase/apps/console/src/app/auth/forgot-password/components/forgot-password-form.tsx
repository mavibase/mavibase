"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axiosInstance from "@/lib/axios-instance";

const FormSchema = z.object({
  email: z.string().min(1, { message: "Email is required" }).email({ message: "Please enter a valid email address." }),
});

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.auth.post("/auth/password-reset/request", {
        email: data.email,
      });

      if (response.data.success) {
        setIsSubmitted(true);
        toast.success("Password reset email sent!");
      }
    } catch (error: any) {
      // Always show success to prevent email enumeration
      setIsSubmitted(true);
      toast.success("If an account exists with this email, you will receive a password reset link.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
          <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-2">
          <h3 className="font-medium text-lg">Check your email</h3>
          <p className="text-muted-foreground text-sm">
            If an account exists with the email you entered, we&apos;ve sent you a link to reset your password.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full mt-4">
          <Button variant="outline" onClick={() => setIsSubmitted(false)} className="w-full">
            Try another email
          </Button>
          <Link href="/auth/login" className="w-full">
            <Button variant="ghost" className="w-full">
              Back to login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input id="email" type="email" placeholder="example@mavibase.com" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send reset link"}
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
