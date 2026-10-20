"use client";

import type { UseFormRegisterReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PasswordFieldProps {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  error?: string;
  autoComplete?: string;
  placeholder?: string;
  describedBy?: string;
}

/** Label + password input + inline error, shared by the reset and change-password forms. */
export function PasswordField({
  id,
  label,
  registration,
  error,
  autoComplete = "current-password",
  placeholder = "••••••••",
  describedBy,
}: PasswordFieldProps) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy ?? errorId}
        {...registration}
      />
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
