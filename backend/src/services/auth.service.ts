import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { env, isProduction } from "../config/env.js";
import { BadRequestError, ConflictError, ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { generateRawToken, hashToken } from "../utils/tokens.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email.service.js";
import type {
  LoginInput,
  RegisterInput,
  UpdateMeInput,
} from "../validators/auth.js";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
   * Dev-only escape hatch: the verification link, present exactly when no
   * mail is sent (SMTP unconfigured outside production) — it also prints to
   * the server console. Never returned in production: handing the token back
   * to the caller would let anyone "verify" an address they don't own.
   */
  verificationUrl?: string;
}

/** Mint a single live verification token for the account and mail the link. */
async function issueVerificationToken(userId: string): Promise<string> {
  // One live token at a time: a resend invalidates anything outstanding.
  await prisma.emailVerificationToken.deleteMany({
    where: { userId, usedAt: null },
  });
  const rawToken = generateRawToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });
  return rawToken;
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
        // NULL until the mailed link is clicked — authenticateUser gates on it.
        emailVerifiedAt: null,
      },
    });

    // Verification plumbing must not break registration itself: if minting
    // the token fails, the account still exists and the user can hit
    // "resend" from the login screen.
    let verificationUrl: string | undefined;
    try {
      const rawToken = await issueVerificationToken(user.id);
      await sendVerificationEmail(user.email, user.firstName, rawToken);
      verificationUrl =
        !isProduction && !env.SMTP_HOST
          ? `${env.FRONTEND_URL}/verify-email?token=${rawToken}`
          : undefined;
    } catch (err) {
      console.error(`[auth] Could not issue verification token for ${email}:`, err);
    }

    return { user: toPublicUser(user), verificationUrl };
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
 * Consume the raw token from the mailed link and stamp the account as
 * verified. Idempotent on the happy path: clicking a link twice (or landing
 * on it after it was used) reports success instead of a confusing error.
 */
export async function verifyEmail(
  rawToken: string
): Promise<{ user: PublicUser; alreadyVerified: boolean }> {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record) throw new BadRequestError("This verification link is invalid or has expired.");

  if (record.usedAt !== null) {
    // Already consumed — fine if the account ended up verified, otherwise the
    // link is stale (e.g. the user was un-verified somehow).
    if (record.user.emailVerifiedAt) {
      return { user: toPublicUser(record.user), alreadyVerified: true };
    }
    throw new BadRequestError("This verification link is invalid or has expired.");
  }

  if (record.expiresAt <= new Date()) {
    throw new BadRequestError("This verification link is invalid or has expired.");
  }

  const user = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    const updated = await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    });
    // Invalidate any other still-pending tokens for this user.
    await tx.emailVerificationToken.deleteMany({
      where: { userId: record.userId, usedAt: null },
    });
    return updated;
  });

  return { user: toPublicUser(user), alreadyVerified: false };
}

/**
 * Re-send the verification link. ALWAYS resolves with the same generic
 * behavior: unknown emails, already-verified accounts and real resends are
 * indistinguishable to the caller (no account enumeration), and mail failures
 * never change the response.
 */
export async function resendVerification(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (!user || user.emailVerifiedAt) return; // silent no-op — same observable behavior

  const rawToken = await issueVerificationToken(user.id);
  await sendVerificationEmail(user.email, user.firstName, rawToken);
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
