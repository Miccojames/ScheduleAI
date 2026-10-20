"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordField } from "@/components/account/PasswordField";
import { useChangePassword } from "@/hooks/useAuth";
import { apiErrorMessage } from "@/services/api";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password must be at most 128 characters."),
    confirm: z.string().min(8, "Password must be at least 8 characters."),
  })
  .refine((values) => values.newPassword === values.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordCard() {
  const changePassword = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      reset();
      toast.success("Password changed.");
    } catch (error) {
      // The 401 ("Your current password is incorrect.") lands here inline —
      // auth.api skips the global redirect for this endpoint on purpose.
      setFormError(apiErrorMessage(error, "We couldn't change your password. Try again."));
    }
  });

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Change password</CardTitle>
        <CardDescription>Update the password you sign in with.</CardDescription>
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
            id="currentPassword"
            label="Current password"
            autoComplete="current-password"
            registration={register("currentPassword")}
            error={errors.currentPassword?.message}
          />

          <PasswordField
            id="newPassword"
            label="New password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            registration={register("newPassword")}
            error={errors.newPassword?.message}
          />

          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            registration={register("confirm")}
            error={errors.confirm?.message}
          />

          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              <>
                <Save className="size-4" aria-hidden="true" />
                Update password
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
