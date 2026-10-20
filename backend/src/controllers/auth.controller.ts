import type { Request, Response } from "express";
import { sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth, AUTH_COOKIE, signToken } from "../middleware/auth.middleware.js";
import { isProduction } from "../config/env.js";
import * as authService from "../services/auth.service.js";
import type { LoginInput, RegisterInput, UpdateMeInput, ForgotPasswordInput, ResetPasswordInput, ChangePasswordInput } from "../validators/auth.js";

// Cookie options shared by set/clear. SameSite=None+Secure in production so
// the frontend (different origin on Render) can send it cross-site; Lax in
// dev for plain http://localhost. httpOnly so JS can never read the token.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterInput;
  const user = await authService.registerUser(body);
  // Log the user in immediately after registration (set the session cookie).
  const token = signToken(user.id);
  res.cookie(AUTH_COOKIE, token, cookieOptions());
  sendSuccess(res, { data: { user }, message: "Account created successfully.", status: 201 });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as LoginInput;
  const user = await authService.authenticateUser(body);
  const token = signToken(user.id);
  res.cookie(AUTH_COOKIE, token, cookieOptions());
  sendSuccess(res, { data: { user }, message: "Logged in successfully." });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  // clearCookie must mirror the set-cookie attributes (path, sameSite, secure)
  // so the browser actually removes it.
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  sendSuccess(res, { data: null, message: "Logged out successfully." });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  // requireAuth already verified the token and attached req.user.
  const user = await authService.getUserById(req.user!.id);
  if (!user) {
    res.status(401).json({ success: false, message: "Your session has expired. Please log in again." });
    return;
  }
  sendSuccess(res, { data: { user } });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateMeInput;
  const user = await authService.updateMe(req.user!.id, body);
  sendSuccess(res, { data: { user }, message: "Profile updated." });
});

// ── Password reset / change ────────────────────────────────────────────────

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ForgotPasswordInput;
  // Always returns the same generic 200 — never reveals whether the email
  // is registered (the service deliberately returns void either way).
  await authService.requestPasswordReset(body.email);
  sendSuccess(res, {
    data: null,
    message: "If an account exists for that email, we've sent a reset link.",
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ResetPasswordInput;
  const user = await authService.resetPassword(body.token, body.password);
  sendSuccess(res, { data: { user }, message: "Password updated. You can sign in now." });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangePasswordInput;
  await authService.changePassword(req.user!.id, body.currentPassword, body.newPassword);
  sendSuccess(res, { data: null, message: "Password changed." });
});

// Exported so routes can mount requireAuth cleanly.
export { requireAuth };
