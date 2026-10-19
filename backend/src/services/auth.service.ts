import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { ConflictError, UnauthorizedError } from "../utils/errors.js";
import type { LoginInput, RegisterInput, UpdateMeInput } from "../validators/auth.js";

const BCRYPT_ROUNDS = 10;

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
