"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "@/hooks/useAuth";
import { ApiError, apiErrorMessage } from "@/services/api";

const forgotSchema = z.object({
  email: z.email("Enter a valid email address."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await forgotPassword.mutateAsync(values);
      setSentEmail(values.email);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setFormError("Too many attempts. Wait a few minutes, then try again.");
        return;
      }
      setFormError(apiErrorMessage(error, "We couldn't send the reset link. Try again."));
    }
  });

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {sent ? "Check your email" : "Reset your password"}
        </CardTitle>
        <CardDescription>
          {sent
            ? "We sent a reset link if that email has an account."
            : "Enter your account email and we'll send you a reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4">
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300"
            >
              <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                If an account exists for <span className="font-medium">{sentEmail}</span>,
                a reset link is on its way. The link expires in a short time.
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Running locally? Email isn&apos;t connected in dev mode — the reset link is printed
              to the server console instead.
            </p>
          </div>
        ) : (
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
                autoFocus
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

            <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
              {forgotPassword.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sending link…
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
