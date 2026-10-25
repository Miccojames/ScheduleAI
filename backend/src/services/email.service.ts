import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Outbound mail. Three rules matter here:
//  1. In dev (SMTP_HOST empty) we just print the code/link so the flow is
//     testable without a real mail server.
//  2. Never throw into the request path — a mail failure must NOT change the
//     API response (that would let callers probe which emails exist). We log
//     the real error server-side and swallow it.
//  3. The transport is shared by every template. With Resend the settings are
//     SMTP_HOST=smtp.resend.com, SMTP_PORT=465, SMTP_USER=resend,
//     SMTP_PASS=<api key>, SMTP_FROM="ScheduleAI <no-reply@yourdomain>" —
//     swapping providers later is an env change, not a code change.

function transport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

/** Dev mode: no SMTP configured — print the value instead of sending. */
function printToConsole(
  label: string,
  to: string,
  detailLabel: string,
  detailValue: string,
  validity: string,
): void {
  console.log(
    [
      "",
      "──────────────────────────────────────────────────────────",
      `  📧  [DEV] ${label} email (SMTP not configured)`,
      "──────────────────────────────────────────────────────────",
      `  To:      ${to}`,
      `  ${detailLabel}:   ${detailValue}`,
      `  Valid:   ${validity}`,
      "──────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  try {
    if (!env.SMTP_HOST) {
      printToConsole("Password reset", to, "Link", resetUrl, "30 minutes");
      return;
    }

    const text = [
      "Hi,",
      "",
      "We received a request to reset your ScheduleAI password.",
      "Open the link below to choose a new one:",
      "",
      resetUrl,
      "",
      "This link is valid for 30 minutes and can only be used once.",
      "If you didn't request this, you can safely ignore this email — your password won't change.",
    ].join("\n");

    await transport().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Reset your ScheduleAI password",
      text,
    });
  } catch (err) {
    // Log loudly for operators, but never bubble up to the request handler.
    console.error(`[email] Failed to send password reset email to ${to}:`, err);
  }
}

/**
 * Verification-code mail, sent the moment an account is created (and on every
 * resend). Plain-text always; a small HTML twin for mail clients that prefer
 * it — email HTML is intentionally self-contained (no app links to follow,
 * dark mode is handled by the client).
 */
export async function sendVerificationEmail(
  to: string,
  firstName: string,
  code: string,
): Promise<void> {
  try {
    if (!env.SMTP_HOST) {
      printToConsole("Email verification", to, "Code", code, "10 minutes");
      return;
    }

    const text = [
      `Hi ${firstName},`,
      "",
      "Here is your ScheduleAI verification code:",
      "",
      `    ${code}`,
      "",
      "Enter it in the app to activate your account.",
      "The code works once and expires in 10 minutes.",
      "Didn't create an account? You can safely ignore this email.",
    ].join("\n");

    const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
        <div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4f46e5;">ScheduleAI</div>
        <h1 style="font-size:21px;line-height:1.3;margin:18px 0 10px;color:#111827;">Verify your email, ${escapeHtml(firstName)}</h1>
        <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 22px;">Enter this code in the app to activate your account:</p>
        <div style="background:#f3f4f6;border:1px dashed #c7d2fe;border-radius:12px;padding:18px 12px;text-align:center;">
          <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:.32em;color:#4338ca;padding-left:.32em;">${code}</span>
        </div>
        <p style="font-size:13px;line-height:1.65;color:#6b7280;margin:20px 0 0;">The code works once and expires in <strong>10 minutes</strong>. If it has expired, request a new one from the sign-in screen.</p>
        <p style="font-size:13px;line-height:1.6;color:#9ca3af;margin:22px 0 0;">Didn&apos;t create a ScheduleAI account? You can safely ignore this email.</p>
      </div>
    </div>
  </body>
</html>`;

    await transport().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: "Your ScheduleAI verification code",
      text,
      html,
    });
  } catch (err) {
    console.error(`[email] Failed to send verification email to ${to}:`, err);
  }
}

/** Minimal escape for interpolating user-supplied names into HTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
