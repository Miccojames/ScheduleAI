"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useNotificationPrefs,
  useSubscribePush,
  useUnsubscribePush,
  useUpdateNotificationPrefs,
} from "@/hooks/useNotifications";
import { notificationsApi } from "@/services/notifications.api";
import { apiErrorMessage } from "@/services/api";
import {
  ensureServiceWorker,
  getActiveSubscription,
  isPushSupported,
  pushSubscriptionKeys,
  subscribePush,
  unsubscribePush,
} from "@/lib/push";

const DENIED_MESSAGE =
  "Notifications are blocked. Allow them for this site in your browser settings, then try again.";

export function NotificationsCard() {
  const { data: prefs, isPending: prefsPending } = useNotificationPrefs();
  const subscribeMutation = useSubscribePush();
  const unsubscribeMutation = useUnsubscribePush();
  const updatePrefs = useUpdateNotificationPrefs();

  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [testing, setTesting] = useState(false);
  /** Bumped by "I added it — check again" to re-run the support detection. */
  const [checkNonce, setCheckNonce] = useState(0);

  // iOS only exposes the Push API to INSTALLED home-screen web apps
  // (iOS 16.4+) — never to a plain Safari tab. Detect that case so the card
  // can explain the fix instead of showing a dead end.
  const isIos =
    typeof navigator !== "undefined" &&
    (/iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
  const needsIosInstall = isIos && !isStandalone;

  // Already-subscribed browsers show as enabled on load (permission granted +
  // an active push subscription for this origin).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let active = false;
      try {
        if (
          isPushSupported() &&
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          active = Boolean(await getActiveSubscription());
        }
      } catch {
        active = false;
      }
      if (!cancelled) {
        setEnabled(active);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkNonce]);

  const busy =
    subscribeMutation.isPending || unsubscribeMutation.isPending || updatePrefs.isPending;
  const vapidConfigured = prefs ? prefs.vapidConfigured : false;
  // No push support in this browser (e.g. iPhone Safari, or iOS before the
  // app is installed) → the toggle stays off and the card explains why.
  const toggleDisabled =
    !ready || busy || prefsPending || !vapidConfigured || !isPushSupported();

  async function turnOn() {
    if (!isPushSupported()) {
      toast.error("This browser doesn't support notifications.");
      return;
    }
    if (Notification.permission === "denied") {
      toast.error(DENIED_MESSAGE);
      return;
    }
    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      if (result !== "granted") {
        toast.error(DENIED_MESSAGE);
        return;
      }
    }

    try {
      const { publicKey } = await notificationsApi.vapidPublicKey();
      const registration = await ensureServiceWorker();
      const subscription = await subscribePush(registration, publicKey);

      await subscribeMutation.mutateAsync({
        endpoint: subscription.endpoint,
        keys: pushSubscriptionKeys(subscription),
        userAgent: navigator.userAgent,
      });
      await updatePrefs.mutateAsync({ notificationsEnabled: true });

      setEnabled(true);
      toast.success("Notifications on.");
    } catch (error) {
      setEnabled(false);
      toast.error(apiErrorMessage(error, "We couldn't turn on notifications."));
    }
  }

  async function turnOff() {
    try {
      // Capture the endpoint first — the server needs it to forget us.
      const subscription = await getActiveSubscription();
      const endpoint = subscription?.endpoint;

      await unsubscribePush(); // best-effort local unsubscribe

      if (endpoint) {
        await unsubscribeMutation.mutateAsync(endpoint);
      }
      await updatePrefs.mutateAsync({ notificationsEnabled: false });

      setEnabled(false);
      toast.success("Notifications off.");
    } catch (error) {
      // Reflect whatever the browser actually has left.
      const stillSubscribed = await getActiveSubscription().catch(() => null);
      setEnabled(Boolean(stillSubscribed));
      toast.error(apiErrorMessage(error, "We couldn't turn off notifications."));
    }
  }

  async function handleToggle(next: boolean) {
    if (toggleDisabled) return;
    if (next) {
      await turnOn();
    } else {
      await turnOff();
    }
  }

  /** Fire a test push right now so the user can confirm reminders work. */
  async function sendTest() {
    if (testing) return;
    setTesting(true);
    try {
      const result = await notificationsApi.test();
      toast.success(
        result.delivered > 0
          ? "Test notification sent — check your device."
          : "Test notification sent, but no browser picked it up.",
      );
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't send the test notification."));
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card id="notifications" className="rounded-2xl border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notifications</CardTitle>
        <CardDescription>Get a nudge before class starts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Allow browser notifications and ScheduleAI can ping you before a class begins, even when
          this tab is in the background. Reminders follow your lead time above.
        </p>

        {!prefsPending && prefs && !prefs.vapidConfigured ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Notifications aren&apos;t configured on this server.</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <Bell className="size-4 text-primary" aria-hidden="true" />
              Browser notifications
            </p>
            <p className="text-xs text-muted-foreground" role="status">
              {busy ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Saving…
                </span>
              ) : enabled ? (
                "On for this browser."
              ) : (
                "Off for this browser."
              )}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Browser notifications"
            disabled={toggleDisabled}
            onClick={() => void handleToggle(!enabled)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              enabled ? "bg-indigo-600" : "bg-input",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-5 rounded-full bg-card shadow-sm transition-transform",
                enabled ? "translate-x-[22px]" : "translate-x-[2px]",
              )}
            />
          </button>
        </div>

        {ready && needsIosInstall ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-800 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-semibold">
              <Smartphone className="size-4" aria-hidden="true" />
              On iPhone, add ScheduleAI to your Home Screen
            </p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs">
              <li>Open this site in Safari and tap the Share button.</li>
              <li>Choose &quot;Add to Home Screen&quot; → Add.</li>
              <li>Open ScheduleAI from your Home Screen (not the browser tab).</li>
            </ol>
            <p className="mt-1.5 text-xs">
              iOS only allows notifications for installed apps — once ScheduleAI is on your
              Home Screen, the toggle below works.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setCheckNonce((value) => value + 1)}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              I added it — check again
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {ready && !isPushSupported()
              ? "This browser doesn't support notifications."
              : "Your browser will ask for permission the first time you turn this on."}
          </p>
        )}

        {enabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void sendTest()}
            disabled={testing}
            className="w-full"
          >
            {testing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Bell className="size-3.5" aria-hidden="true" />
            )}
            Send a test notification
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
