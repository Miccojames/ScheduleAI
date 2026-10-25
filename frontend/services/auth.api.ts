import { api } from "@/services/api";
import type { User } from "@/types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface VerifyEmailInput {
  token: string;
}

export interface ResendVerificationInput {
  email: string;
}

export const authApi = {
  register(input: RegisterInput) {
    // `verificationUrl` comes back only from a dev backend with no SMTP — it
    // mirrors the link printed to the server console so local flows are
    // clickable. Production never sends it (the link arrives by email).
    return api<{ user: User; verificationUrl?: string }>("/api/auth/register", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  login(input: LoginInput) {
    return api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  logout() {
    return api<Record<string, never>>("/api/auth/logout", { method: "POST" });
  },

  me() {
    // skipAuthRedirect: a 401 here just means "not signed in". The callers
    // (AuthGuard, login/register screens) decide what to do — without this,
    // visiting /register while logged out bounced straight back to /login.
    return api<{ user: User }>("/api/auth/me", { skipAuthRedirect: true });
  },

  updateMe(input: UpdateProfileInput) {
    return api<{ user: User }>("/api/auth/me", { method: "PUT", body: input });
  },

  /**
   * Always resolves with a generic server message when the address is valid —
   * the backend never reveals whether the account exists (no enumeration).
   */
  forgotPassword(input: ForgotPasswordInput) {
    return api<null>("/api/auth/forgot-password", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  resetPassword(input: ResetPasswordInput) {
    // 400 = expired/invalid token; surfaced by the caller, never a redirect.
    return api<{ user: User }>("/api/auth/reset-password", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  changePassword(input: ChangePasswordInput) {
    // skipAuthRedirect: a 401 here means "your current password is wrong",
    // not "session expired" — the settings card shows it inline instead of
    // bouncing the user to /login.
    return api<null>("/api/auth/password", {
      method: "PUT",
      body: input,
      skipAuthRedirect: true,
    });
  },

  /** Consume the token from the mailed link. 400 = expired/invalid/used. */
  verifyEmail(input: VerifyEmailInput) {
    return api<{ user: User }>("/api/auth/verify-email", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },

  /**
   * Always resolves (when the address is valid) — the backend never reveals
   * whether the account exists or is already verified (no enumeration).
   */
  resendVerification(input: ResendVerificationInput) {
    return api<null>("/api/auth/resend-verification", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
  },
};