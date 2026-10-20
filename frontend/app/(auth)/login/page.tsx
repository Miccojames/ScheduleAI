"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useMe } from "@/hooks/useAuth";
import { ApiError } from "@/services/api";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const { data: user, isCheckingSession: checkingSession } = useMe();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Just registered? The email is handed over so the field is pre-filled.
  useEffect(() => {
    try {
      const email = window.sessionStorage.getItem("scheduleai:registeredEmail");
      if (email) {
        setValue("email", email);
        window.sessionStorage.removeItem("scheduleai:registeredEmail");
      }
    } catch {
      // Storage unavailable (private mode) — the field just stays empty.
    }
  }, [setValue]);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "We couldn't sign you in. Please try again.",
      );
    }
  });

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">Welcome back</CardTitle>
        <CardDescription>Sign in to see your weekly schedule.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email ? (
              <p id="email-error" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password ? (
              <p id="password-error" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>

          <div className="-mt-1 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:text-primary"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={login.isPending || checkingSession}>
            {login.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:text-primary">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}