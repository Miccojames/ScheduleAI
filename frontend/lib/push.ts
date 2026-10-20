/**
 * Browser push plumbing for the notifications settings card.
 * Everything here is browser-only — call it from client components, never
 * during render on the server.
 */

/** Converts a base64url VAPID public key into the bytes pushManager wants. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

/** Registers /sw.js (idempotent) and returns the registration. */
export async function ensureServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser doesn't support notifications.");
  }
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** The subscription for this origin, or null when there isn't one yet. */
export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Registers the service worker (if needed) and subscribes to push. */
export async function subscribePush(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    throw new Error("Notifications aren't allowed for this site.");
  }
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

/** Pulls p256dh/auth out of a subscription for the backend. */
export function pushSubscriptionKeys(subscription: PushSubscription): {
  p256dh: string;
  auth: string;
} {
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) {
    throw new Error("This browser returned an incomplete push subscription.");
  }
  return { p256dh: keys.p256dh, auth: keys.auth };
}

/** Best-effort local unsubscribe — returns true when no subscription remains. */
export async function unsubscribePush(): Promise<boolean> {
  const subscription = await getActiveSubscription();
  if (!subscription) return true;
  try {
    return await subscription.unsubscribe();
  } catch {
    return false;
  }
}
