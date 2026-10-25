import { randomBytes, randomInt, createHash } from "node:crypto";

// Raw token handed to the user (via the reset link). 32 bytes = 64 hex chars —
// plenty of entropy, and URL-safe by construction.
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

// 6-digit email-verification code (000000–999999, always six characters —
// leading zeros included). crypto.randomInt is uniformly distributed, so no
// digit combination is more likely than another (unlike Math.random).
export function generateVerificationCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// What we store in the DB. Hashing means a leaked database row can't be used
// to reset anyone's password.
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Verification codes are stored as hashToken("userId:code"): hashed like
// everything else (a DB leak shouldn't hand out live codes), with the userId
// mixed in so each hash is bound to its own account — a row alone can't be
// matched to a code for some other user.
export function hashVerificationCode(userId: string, code: string): string {
  return hashToken(`${userId}:${code}`);
}
