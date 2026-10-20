/**
 * The "session hint" — a READABLE companion to the httpOnly auth cookie.
 *
 * The API sets `scheduleai_hint=1` whenever it hands out a session (and
 * clears it on logout). It carries no secret: its only job is to tell the
 * SPA whether a session might exist, so the app can skip the
 * `GET /api/auth/me` probe for anonymous visitors. Without it, every
 * anonymous visit fired a request that 401'd and left a red line in the
 * browser console.
 */

const HINT_COOKIE = "scheduleai_hint";

/** True when the server says a session might exist. */
export function hasSessionHint(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((part) => part.trim().startsWith(`${HINT_COOKIE}=`));
}

/** Drop the hint locally (stale session, or an explicit sign-out). */
export function clearSessionHint(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${HINT_COOKIE}=; Max-Age=0; path=/`;
}
