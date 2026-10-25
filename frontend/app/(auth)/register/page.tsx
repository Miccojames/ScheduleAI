"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRegister, useResendVerification } from "@/hooks/useAuth";
import { ApiError, apiErrorMessage } from "@/services/api";

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name."),
  lastName: z.string().trim().min(1, "Enter your last name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useRegister();
  const resend = useResendVerification();
  const [formError, setFormError] = useState<string | null>(null);

  // "Check your email" state — the account exists but isn't usable until the
  // mailed link is clicked.
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  // Registration never signs you in: the account is created, the verification
  // mail goes out, and this screen waits for the link to be clicked.

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const data = await registerUser.mutateAsync(values);
      setSentEmail(values.email);
      // Only a dev backend with no SMTP returns this (see auth.api.ts).
      setVerificationUrl(data.verificationUrl ?? null);
      setResendError(null);
      setResendSent(false);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setFormError("An account with this email already exists.");
        return;
      }
      setFormError(
        error instanceof ApiError ? error.message : "We couldn't create your account. Try again.",
      );
    }
  });

  const goToLogin = () => {
    try {
      window.sessionStorage.setItem("scheduleai:registeredEmail", sentEmail);
    } catch {
      // Storage unavailable (private mode) — the field just stays empty.
    }
    router.push("/login");
  };

  const onResend = async () => {
    setResendError(null);
    try {
      await resend.mutateAsync({ email: sentEmail });
      setResendSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setResendError("Too many attempts. Wait a few minutes, then try again.");
        return;
      }
      setResendError(apiErrorMessage(error, "We couldn't send the email. Try again."));
    }
  };

  const backToForm = () => {
    setSent(false);
    setFormError(null);
    reset();
  };

  if (sent) {
    return (
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="space-y-1.5">
          <CardTitle className="text-xl font-semibold tracking-tight">Check your email</CardTitle>
          <CardDescription>
            We sent a verification link to{" "}
            <span className="font-medium text-foreground">{sentEmail}</span>. Click it to activate
            your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              The link works once and expires in <strong>24 hours</strong>. Check your spam folder
              if it hasn&apos;t arrived in a minute.
            </span>
          </div>

          {verificationUrl ? (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-medium">Running locally — email isn&apos;t connected in dev mode.</p>
              <p className="text-xs">
                The link was also printed to the server console. Open it here:
              </p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={verificationUrl}>Open the verification link</a>
              </Button>
            </div>
          ) : null}

          {resendError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{resendError}</span>
            </div>
          ) : null}

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={onResend}
            disabled={resend.isPending}
          >
            {resend.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : resendSent ? (
              "Email sent again ✓"
            ) : (
              "Resend email"
            )}
          </Button>

          <Button type="button" className="w-full" onClick={goToLogin}>
            I&apos;ve verified — sign in
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <button
              type="button"
              onClick={backToForm}
              className="font-medium text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              Use a different email
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">Create your account</CardTitle>
        <CardDescription>Start planning your whole week in seconds.</CardDescription>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Juan"
                aria-invalid={Boolean(errors.firstName)}
                {...register("firstName")}
              />
              {errors.firstName ? <p className="text-xs text-destructive">{errors.firstName.message}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="Dela Cruz"
                aria-invalid={Boolean(errors.lastName)}
                {...register("lastName")}
              />
              {errors.lastName ? <p className="text-xs text-destructive">{errors.lastName.message}</p> : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@school.edu"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
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

          <Button type="submit" className="w-full" disabled={registerUser.isPending}>
            {registerUser.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
