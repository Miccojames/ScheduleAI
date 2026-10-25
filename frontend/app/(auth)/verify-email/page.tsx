"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResendVerification, useVerifyEmail } from "@/hooks/useAuth";
import { ApiError, apiErrorMessage } from "@/services/api";

const resendSchema = z.object({
  email: z.email("Enter a valid email address."),
});

type ResendValues = z.infer<typeof resendSchema>;

/**
 * Landing page for the link we mail at registration. Three states:
 *  verifying (spinner) → verified (auto-redirect to sign-in) or
 *  failed (message + a form that mails a fresh link).
 */
function VerifyEmailContent() {
  const token = useSearchParams().get("token");
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const attempted = useRef(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: "" },
  });

  // Fire exactly once — StrictMode double-invokes effects in dev, and a token
  // is single-use (the API is idempotent for already-used links, but there's
  // no reason to ask twice).
  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verify.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onResend = handleSubmit(async (values) => {
    setResendError(null);
    try {
      await resend.mutateAsync({ email: values.email });
      setResendSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setResendError("Too many attempts. Wait a few minutes, then try again.");
        return;
      }
      setResendError(apiErrorMessage(error, "We couldn't send the email. Try again."));
    }
  });

  // Server render has no mutation in flight yet — the page must default to
  // "verifying" and only claim done/failed once react-query settles, so the
  // SSR HTML never flashes a false "Email verified" before hydration.
  const phase: "missing" | "verifying" | "failed" | "done" = !token
    ? "missing"
    : verify.isError
      ? "failed"
      : verify.isSuccess
        ? "done"
        : "verifying";

  const failureMessage = verify.error
    ? apiErrorMessage(verify.error, "This verification link is invalid or has expired.")
    : "This verification link is invalid or has expired.";

  const resendForm = (
    <form onSubmit={onResend} className="space-y-3" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="resend-email">Your email address</Label>
        <Input
          id="resend-email"
          type="email"
          autoComplete="email"
          placeholder="you@school.edu"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={resend.isPending}>
        {resend.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : resendSent ? (
          "New link sent ✓"
        ) : (
          "Email me a new link"
        )}
      </Button>
      {resendSent ? (
        <p className="text-xs text-muted-foreground" role="status">
          If that address needs verification, a fresh link is on its way — it expires 24 hours
          after it arrives.
        </p>
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
    </form>
  );

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {phase === "missing"
            ? "Link incomplete"
            : phase === "verifying"
              ? "Verifying your email"
              : phase === "failed"
                ? "That link didn't work"
                : "Email verified"}
        </CardTitle>
        <CardDescription>
          {phase === "missing"
            ? "This address is missing the verification token."
            : phase === "verifying"
              ? "One moment while we confirm your address."
              : phase === "failed"
                ? "The link may have expired or already been used."
                : "Your account is active — sign in to start planning."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {phase === "verifying" ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-6 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Verifying…
          </div>
        ) : null}

        {phase === "done" ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300"
          >
            <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {verify.data ? "Email verified. Taking you to sign in…" : "Email verified."}
            </span>
          </div>
        ) : null}

        {phase === "missing" || phase === "failed" ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{failureMessage}</span>
          </div>
        ) : null}

        {phase === "done" ? (
          <Button asChild className="w-full">
            <Link href="/login">Continue to sign in</Link>
          </Button>
        ) : null}

        {phase === "missing" || phase === "failed" ? resendForm : null}

        {phase === "missing" || phase === "failed" ? (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:text-primary">
              Back to sign in
            </Link>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  // useSearchParams requires a Suspense boundary for prerendering.
  return (
    <Suspense
      fallback={
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
