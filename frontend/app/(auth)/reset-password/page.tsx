"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField } from "@/components/account/PasswordField";
import { useResetPassword } from "@/hooks/useAuth";
import { ApiError, apiErrorMessage } from "@/services/api";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be at most 128 characters."),
    confirm: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

type ResetValues = z.infer<typeof resetSchema>;

/** The backend rejects tokens shorter than this (validators/auth.ts). */
const MIN_TOKEN_LENGTH = 10;

function ExpiredCard() {
  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">
          This reset link is invalid or has expired
        </CardTitle>
        <CardDescription>
          Reset links can only be used once and expire after a short time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>Ask for a fresh link and open it right away.</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-700"
          >
            <KeyRound className="size-4" aria-hidden="true" />
            Request a new link
          </Link>
          <Link href="/login" className="font-medium text-gray-500 hover:text-gray-700">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ResetForm({ token }: { token: string }) {
  const resetPassword = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkHelp, setLinkHelp] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setLinkHelp(false);
    try {
      // Success toast + redirect happen in useResetPassword.
      await resetPassword.mutateAsync({ token, password: values.password });
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        // Prefer the field-level message ("Reset token is invalid") over the
        // generic validation envelope text.
        const fieldMessage = Object.values(error.errors ?? {})
          .flat()
          .find(Boolean);
        setFormError(
          fieldMessage || error.message || "This reset link is invalid or has expired.",
        );
        setLinkHelp(true);
        return;
      }
      if (error instanceof ApiError && error.status === 429) {
        setFormError("Too many attempts. Wait a few minutes, then try again.");
        return;
      }
      setFormError(apiErrorMessage(error, "We couldn't update your password. Try again."));
    }
  });

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">Choose a new password</CardTitle>
        <CardDescription>It must be at least 8 characters long.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          ) : null}

          <PasswordField
            id="password"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            registration={register("password")}
            error={errors.password?.message}
          />

          <PasswordField
            id="confirm"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            registration={register("confirm")}
            error={errors.confirm?.message}
          />

          {linkHelp ? (
            <p className="text-sm text-gray-500">
              Need a new one?{" "}
              <Link
                href="/forgot-password"
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Request a new reset link
              </Link>
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
            {resetPassword.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Updating password…
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  if (token.length < MIN_TOKEN_LENGTH) return <ExpiredCard />;
  return <ResetForm token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10" role="status" aria-live="polite">
          <Loader2 className="size-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
