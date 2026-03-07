"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import axiosInstance from "@/lib/axios-instance";
import { useAuthContext } from "@/contexts/auth-context";

const FormSchema = z
  .object({
    firstname: z.string().min(1, { message: "First name is required" }),
    lastname: z.string().min(1, { message: "Last name is required" }),
    email: z.string().min(1, { message: "Email is required" }).email({ message: "Please enter a valid email address." }),
    password: z.string().min(1, { message: "Password is required" }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function RegisterForm() {
  const router = useRouter();
  const { setUser } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      firstname: "",
      lastname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    setIsLoading(true);
    try {
      // Register the user
      const registerResponse = await axiosInstance.auth.post("/auth/register", {
        email: data.email,
        password: data.password,
        firstname: data.firstname,
        lastname: data.lastname,
      });

      if (registerResponse.data.success) {
        toast.success("Registration successful! Logging you in...");
        
        // Automatically log in the user
        try {
          const loginResponse = await axiosInstance.auth.post("/auth/login", {
            email: data.email,
            password: data.password,
          });

          if (loginResponse.data.success) {
            const user = loginResponse.data.data.user;
            setUser(user);
            toast.success("You're now logged in!");
            router.push("/");
          }
        } catch (loginError: any) {
          // If auto-login fails, redirect to login page
          toast.info("Please log in with your new account");
          router.push("/auth/login");
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || "Registration failed. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="firstname"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input id="firstname" type="text" placeholder="John" autoComplete="given-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastname"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input id="lastname" type="text" placeholder="Doe" autoComplete="family-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
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
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input id="password" type="password" placeholder="••••••••" autoComplete="new-password" {...field} />
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
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Creating account..." : "Register"}
        </Button>
      </form>
    </Form>
  );
}
