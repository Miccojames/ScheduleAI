// Web Push delivery layer (web-push + VAPID).
//
// Import note: web-push is a CommonJS module whose `module.exports` carries the
// API (setVapidDetails / sendNotification / WebPushError). Under "type":
// "module" a default import resolves to that object, whereas a namespace import
// only surfaces the statically-detected `WebPushError` — so the default form is
// the one that works at runtime here.
import webPush from "web-push";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";

/** What the service worker receives — keep the shape stable for the frontend. */
export interface PushPayload {
  title: string;
  body: string;
  data: { entryId: string; subject: string };
}

/** The columns of a PushSubscription row (structurally a web-push target). */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Set once setVapidDetails() has been applied — never re-register. */
let vapidConfigured = false;

/** True when both VAPID keys are present (feature switch for every endpoint). */
export function isConfigured(): boolean {
  return env.VAPID_PUBLIC_KEY.trim().length > 0 && env.VAPID_PRIVATE_KEY.trim().length > 0;
}

/**
 * Register the VAPID details with web-push. Lazy + idempotent: safe to call on
 * every send. Returns whether push is actually usable.
 */
export function configure(): boolean {
  if (!isConfigured()) return false;
  if (vapidConfigured) return true;
  webPush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * Fire one push. Never throws: a stale or failing subscription must not break
 * the reminder job.
 *
 * 404/410 from the push service means the subscription is gone (browser
 * revoked it / endpoint expired) → delete the row so we stop targeting it.
 */
export async function sendToSubscription(sub: PushTarget, payload: PushPayload): Promise<boolean> {
  if (!isConfigured()) return false;
  configure();

  try {
    // NOTE: web-push validates its options object and *throws* on unknown keys,
    // so an AbortSignal cannot be passed through. The 10s bound the spec wants
    // is enforced with the library's own socket `timeout` option instead.
    await webPush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { timeout: 10_000 }
    );
    return true;
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;

    if (statusCode === 404 || statusCode === 410) {
      try {
        const { count } = await prisma.pushSubscription.deleteMany({
          where: { endpoint: sub.endpoint },
        });
        if (count > 0) {
          console.log(`[push] dropped stale subscription (${statusCode}): ${sub.endpoint}`);
        }
      } catch (cleanupErr) {
        console.warn(`[push] failed to drop stale subscription ${sub.endpoint}:`, cleanupErr);
      }
      return false;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[push] send failed for ${sub.endpoint}: ${message}`);
    return false;
  }
}
