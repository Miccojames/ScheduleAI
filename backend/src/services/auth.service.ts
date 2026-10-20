import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { BadRequestError, ConflictError, UnauthorizedError } from "../utils/errors.js";
import { generateRawToken, hashToken } from "../utils/tokens.js";
import { sendPasswordResetEmail } from "./email.service.js";
import type {
  LoginInput,
  RegisterInput,
  UpdateMeInput,
} from "../validators/auth.js";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
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
      },
    });
    return toPublicUser(user);
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
  return toPublicUser(user);
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
