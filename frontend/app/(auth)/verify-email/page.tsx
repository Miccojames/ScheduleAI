"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Info, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VerifyCodeForm } from "@/components/auth/verify-code-form";

const emailSchema = z.object({
  email: z.email("Enter a valid email address."),
});

type EmailValues = z.infer<typeof emailSchema>;

// sessionStorage is a browser-only external store: subscribe is a no-op
// (nothing else writes it mid-session), the server snapshot is null so SSR
// stays deterministic, and the client snapshot swaps in the address right
// after hydration — the sanctioned way to read storage without an effect.
const subscribeNoop = () => () => {};
const getStoredEmail = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem("scheduleai:registeredEmail");
  } catch {
    return null; // Storage unavailable (private mode).
  }
};

/**
 * Standalone code-entry screen: where old verification LINKS now land (they
 * carry a ?token= we no longer honour — the notice explains the switch), and
 * a way back into the flow if someone closes the register screen and later
 * needs to enter their code without going through login first.
 */
function VerifyEmailContent() {
  const router = useRouter();
  const hasLegacyToken = Boolean(useSearchParams().get("token"));

  const storedEmail = useSyncExternalStore(subscribeNoop, getStoredEmail, () => null);
  // Address chosen on this screen wins over the one handed over by register.
  const [chosenEmail, setChosenEmail] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const email = editing ? null : (chosenEmail ?? storedEmail);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const onVerified = () => {
    if (email) {
      try {
        window.sessionStorage.setItem("scheduleai:registeredEmail", email);
      } catch {
        // Storage unavailable — the login field just starts empty.
      }
    }
    toast.success("Email verified — sign in to continue.");
    router.push("/login");
  };

  const onEmailSubmit = handleSubmit((values) => {
    setChosenEmail(values.email);
    setEditing(false);
    try {
      window.sessionStorage.setItem("scheduleai:registeredEmail", values.email);
    } catch {
      // Storage unavailable — harmless, the form keeps the value in state.
    }
  });

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {email ? "Enter your verification code" : "Verify your email"}
        </CardTitle>
        <CardDescription>
          {email ? (
            <>
              Type the 6-digit code we sent to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "Enter your email and we&apos;ll walk you through verification."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasLegacyToken ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300"
          >
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Verification links have been replaced by 6-digit codes — this link no longer works.
              Enter the code from your most recent email instead (or request a new one below).
            </span>
          </div>
        ) : null}

        {email ? (
          <>
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300"
            >
              <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                The code expires in <strong>10 minutes</strong>. Check spam if it hasn&apos;t
                arrived in a minute.
              </span>
            </div>

            <VerifyCodeForm email={email} autoFocus onVerified={onVerified} />

            <p className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="font-medium text-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Verify a different email
              </button>
            </p>
          </>
        ) : (
          <form onSubmit={onEmailSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="verify-email-input">Email</Label>
              <Input
                id="verify-email-input"
                type="email"
                autoComplete="email"
                placeholder="you@school.edu"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:text-primary">
            Back to sign in
          </Link>
        </p>
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
