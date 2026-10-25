import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { isProduction } from "../config/env.js";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { generateRawToken, generateVerificationCode, hashToken, hashVerificationCode } from "../utils/tokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import type {
  LoginInput,
  RegisterInput,
  UpdateMeInput,
} from "../validators/auth.js";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VERIFY_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes — codes are time-sensitive
// Wrong guesses allowed per live code before it deletes itself. 6 digits is a
// small keyspace, so this cap (plus the per-IP limiter on the endpoint) is the
// actual brute-force guard.
const MAX_VERIFY_ATTEMPTS = 5;

// Every failed verify (wrong code, expired code, unknown address) returns the
// same message — a caller can't probe which accounts exist or how close they are.
const VERIFY_FAILED_MESSAGE = "That code is incorrect or has expired.";

// Public user shape returned by the API (never includes passwordHash).
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}

function toPublicUser(user: {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export interface RegisterResult {
  user: PublicUser;
  /**
   * Dev-only escape hatch: the 6-digit code, returned whenever the API runs
   * outside production so local flows (and the smoke suite, which now has
   * working SMTP locally and can't read the mailbox) can complete. Production
   * NEVER returns it: it would let anyone "verify" an address they don't own.
   */
  verificationCode?: string;
}

/** Mint the single live verification code for the account and mail it. */
async function issueVerificationCode(userId: string): Promise<string> {
  // One live code at a time: a resend invalidates anything outstanding.
  await prisma.emailVerificationToken.deleteMany({
    where: { userId, usedAt: null },
  });
  const code = generateVerificationCode();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashVerificationCode(userId, code),
      expiresAt: new Date(Date.now() + VERIFY_CODE_TTL_MS),
    },
  });
  return code;
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Friendly 409 — no stack traces, no "unique constraint" wording.
    throw new ConflictError("An account with this email already exists. Try logging in instead.");
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const user = await prisma.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        passwordHash,
        // NULL until the emailed code is entered — authenticateUser gates on it.
        emailVerifiedAt: null,
      },
    });

    // Verification plumbing must not break registration itself: if minting
    // the code fails, the account still exists and the user can hit "resend"
    // from the login screen.
    let verificationCode: string | undefined;
    try {
      const code = await issueVerificationCode(user.id);
      await sendVerificationEmail(user.email, user.firstName, code);
      verificationCode = !isProduction ? code : undefined;
    } catch (err) {
      console.error(`[auth] Could not issue verification code for ${email}:`, err);
    }

    return { user: toPublicUser(user), verificationCode };
  } catch (err: unknown) {
    // Race on the unique email — map to the same friendly 409.
    if ((err as { code?: string })?.code === "P2002") {
      throw new ConflictError("An account with this email already exists. Try logging in instead.");
    }
    throw err;
  }
}

export async function authenticateUser(input: LoginInput): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  // Same error for unknown email and wrong password — no account enumeration.
  if (!user) throw new UnauthorizedError("Invalid email or password.");
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid email or password.");
  // Password checked FIRST: the verification state is only revealed to
  // someone who already proved they own the account.
  if (!user.emailVerifiedAt) {
    throw new ForbiddenError(
      "Please verify your email address before signing in.",
      "email_not_verified",
    );
  }
  return toPublicUser(user);
}

/**
 * Consume the 6-digit code the user typed and stamp the account as verified.
 * Wrong guesses increment the code's attempt counter; the fifth one deletes
 * the code outright. Re-submitting the code that was already used reports
 * success instead of a confusing error (idempotent double-entry).
 */
export async function verifyEmail(
  email: string,
  rawCode: string
): Promise<{ user: PublicUser; alreadyVerified: boolean }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  // Unknown address fails exactly like a wrong code — no enumeration.
  if (!user) throw new BadRequestError(VERIFY_FAILED_MESSAGE);

  const codeHash = hashVerificationCode(user.id, rawCode.trim());
  const live = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (live) {
    if (live.expiresAt > new Date() && live.tokenHash === codeHash) {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.emailVerificationToken.update({
          where: { id: live.id },
          data: { usedAt: new Date() },
        });
        const u = await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
        });
        // Invalidate any other still-pending codes for this user.
        await tx.emailVerificationToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });
        return u;
      });
      return { user: toPublicUser(updated), alreadyVerified: false };
    }

    if (live.expiresAt <= new Date()) {
      // Expired — same generic failure; the resend button takes it from here.
      throw new BadRequestError(VERIFY_FAILED_MESSAGE);
    }

    // Wrong code: count the guess. `increment` is atomic, so parallel
    // guesses can't slip past the cap.
    const after = await prisma.emailVerificationToken.update({
      where: { id: live.id },
      data: { attempts: { increment: 1 } },
    });
    if (after.attempts >= MAX_VERIFY_ATTEMPTS) {
      await prisma.emailVerificationToken.deleteMany({ where: { id: live.id } });
      throw new BadRequestError(
        "Too many incorrect attempts — this code has been cancelled. Request a new one."
      );
    }
    throw new BadRequestError(VERIFY_FAILED_MESSAGE);
  }

  // No live code: either this one was already consumed (idempotent re-entry
  // with the same code) or it never existed for this address.
  const spent = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, tokenHash: codeHash },
    orderBy: { createdAt: "desc" },
  });
  if (spent && spent.usedAt !== null && user.emailVerifiedAt) {
    return { user: toPublicUser(user), alreadyVerified: true };
  }
  throw new BadRequestError(VERIFY_FAILED_MESSAGE);
}

/**
 * Re-send the verification code (a fresh one invalidates the old). ALWAYS
 * resolves with the same generic behavior: unknown emails, already-verified
 * accounts and real resends are indistinguishable to the caller (no account
 * enumeration), and mail failures never change the response.
 * Returns the code itself only outside production (dev/smoke escape hatch).
 */
export async function resendVerification(email: string): Promise<string | undefined> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (!user || user.emailVerifiedAt) return undefined; // silent no-op

  const code = await issueVerificationCode(user.id);
  await sendVerificationEmail(user.email, user.firstName, code);
  return !isProduction ? code : undefined;
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<PublicUser> {
  const data: { firstName?: string; lastName?: string } = {};
  if (input.firstName !== undefined) data.firstName = input.firstName.trim();
  if (input.lastName !== undefined) data.lastName = input.lastName.trim();
  const user = await prisma.user.update({ where: { id: userId }, data });
  return toPublicUser(user);
}

/**
 * Start a password reset. ALWAYS resolves without revealing whether the
 * account exists (no account enumeration) — the same generic response is
 * returned either way, and email failures are logged but never thrown.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (!user) return; // silently do nothing — same observable behavior as success

  // One live token at a time: drop any prior unused tokens before minting.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const rawToken = generateRawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  // Fire-and-forget style: sendPasswordResetEmail never throws, but we still
  // await so the dev-mode console output lands before the response.
  await sendPasswordResetEmail(user.email, rawToken);
}

/**
 * Consume a raw reset token and set the new password. Single-use: the token
 * is marked used and every other outstanding token for the user is revoked
 * inside one transaction.
 */
export async function resetPassword(
  rawToken: string,
  newPassword: string
): Promise<PublicUser> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
    throw new BadRequestError("This reset link is invalid or has expired.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const user = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    const updated = await tx.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });
    // Invalidate any other still-pending tokens for this user.
    await tx.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
    return updated;
  });

  return toPublicUser(user);
}

/**
 * Change password for a signed-in user. Requires the current password
 * (same single generic-ish error pattern as authenticateUser).
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedError("Authentication required");

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Your current password is incorrect.");

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}
