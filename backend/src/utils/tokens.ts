import { randomBytes, createHash } from "node:crypto";

// Raw token handed to the user (via the reset link). 32 bytes = 64 hex chars —
// plenty of entropy, and URL-safe by construction.
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

// What we store in the DB. Hashing means a leaked database row can't be used
// to reset anyone's password.
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
