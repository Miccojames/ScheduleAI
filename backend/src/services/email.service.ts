import nodemailer from "nodemailer";
import { env } from "../config/env.js";

// Password-reset mail. Two rules matter here:
//  1. In dev (SMTP_HOST empty) we just print the link so the flow is testable
//     without a real mail server.
//  2. Never throw into the request path — a mail failure must NOT change the
//     API response (that would let callers probe which emails exist). We log
//     the real error server-side and swallow it.
export async function sendPasswordResetEmail(to: string, rawToken: string): Promise<void> {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

  try {
    if (!env.SMTP_HOST) {
      // ── Dev mode: no SMTP configured — print the link instead of sending. ──
      console.log(
        [
          "",
          "──────────────────────────────────────────────────────────",
          "  📧  [DEV] Password reset email (SMTP not configured)",
          "──────────────────────────────────────────────────────────",
          `  To:      ${to}`,
          `  Link:    ${resetUrl}`,
          "  Valid:   30 minutes",
          "──────────────────────────────────────────────────────────",
          "",
        ].join("\n")
      );
      return;
    }

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });

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

    await transport.sendMail({
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
