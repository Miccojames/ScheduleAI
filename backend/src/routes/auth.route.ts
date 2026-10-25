import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { authLimiter, verifyLimiter } from "../middleware/rateLimit.middleware.js";
import { registerSchema, loginSchema, updateMeSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, verifyEmailSchema, resendVerificationSchema } from "../validators/auth.js";

const router = Router();

// All auth endpoints are rate-limited harder than the rest of the API.
router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.put("/me", requireAuth, validate(updateMeSchema), authController.updateMe);

// Password reset (anonymous, token-based) + change (authenticated).
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), authController.resetPassword);
router.put("/password", requireAuth, authLimiter, validate(changePasswordSchema), authController.changePassword);

// Email verification (anonymous, code-based). The code is only 6 digits, so
// verify-email sits behind its own per-IP budget: the 5-guess-per-code wipe
// is the real guard, this is the backstop. Kept separate from authLimiter so
// verification never starves sign-in attempts (and repeated smoke runs don't
// share one 30-request pool).
router.post("/verify-email", verifyLimiter, validate(verifyEmailSchema), authController.verifyEmail);
router.post("/resend-verification", authLimiter, validate(resendVerificationSchema), authController.resendVerification);

export default router;
