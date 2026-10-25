"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResendVerification, useVerifyEmail } from "@/hooks/useAuth";
import { ApiError, apiErrorMessage } from "@/services/api";
import { CodeInput } from "@/components/auth/code-input";

interface VerifyCodeFormProps {
  /** The address the code was mailed to — also what gets verified. */
  email: string;
  /** Called exactly once, after the API accepts the code. */
  onVerified: () => void;
  autoFocus?: boolean;
  /** Non-production backends echo the code back — shown as a dev shortcut. */
  devCode?: string | null;
}

const RESEND_COOLDOWN_S = 30;

/**
 * The shared "enter the 6-digit code" UI: boxes that auto-submit on the sixth
 * digit, inline errors, and a resend button with a 30-second cooldown.
 * Toasts/redirects belong to the caller — this component only knows how to
 * verify and how to send a fresh code.
 */
export function VerifyCodeForm({ email, onVerified, autoFocus, devCode: initialDevCode }: VerifyCodeFormProps) {
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(initialDevCode ?? null);
  const [resendSent, setResendSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (value?: string) => {
    const digits = (value ?? code).trim();
    if (digits.length !== 6 || verify.isPending) return;
    setError(null);
    try {
      await verify.mutateAsync({ email, code: digits });
      onVerified();
    } catch (err) {
      setError(apiErrorMessage(err, "That code didn't work. Check it and try again."));
      setCode("");
      // Send focus back to the first box so retyping is one keystroke away.
      requestAnimationFrame(() => document.getElementById("verify-code-0")?.focus());
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      const res = await resend.mutateAsync({ email });
      setDevCode(res?.verificationCode ?? null);
      setResendSent(true);
      setCooldown(RESEND_COOLDOWN_S);
      setCode("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError("Too many attempts. Wait a few minutes, then try again.");
        return;
      }
      setError(apiErrorMessage(err, "We couldn't send the email. Try again."));
    }
  };

  return (
    <div className="space-y-3">
      <CodeInput
        value={code}
        onChange={setCode}
        onComplete={(v) => void submit(v)}
        disabled={verify.isPending}
        autoFocus={autoFocus}
        invalid={Boolean(error)}
        idPrefix="verify-code"
      />

      {error ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {devCode ? (
        <div className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-center text-sm text-amber-700 dark:text-amber-300">
          <p className="font-medium">Running locally — dev shortcut</p>
          <p className="font-mono text-base font-bold tracking-[0.3em]">{devCode}</p>
        </div>
      ) : null}

      <Button
        type="button"
        className="w-full"
        onClick={() => void submit()}
        disabled={verify.isPending || code.length !== 6}
      >
        {verify.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Verifying…
          </>
        ) : (
          "Verify code"
        )}
      </Button>

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onResend}
        disabled={resend.isPending || cooldown > 0}
      >
        {resend.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending…
          </>
        ) : cooldown > 0 ? (
          `Resend code in 0:${String(cooldown).padStart(2, "0")}`
        ) : resendSent ? (
          "Send a new code ✓"
        ) : (
          "Resend code"
        )}
      </Button>

      {resendSent && cooldown > 0 ? (
        <p className="text-center text-xs text-muted-foreground" role="status">
          A fresh code is on its way — it can take a minute to arrive.
        </p>
      ) : null}
    </div>
  );
}
