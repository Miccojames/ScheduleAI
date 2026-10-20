"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  }, []);

  const busy =
    subscribeMutation.isPending || unsubscribeMutation.isPending || updatePrefs.isPending;
  const vapidConfigured = prefs ? prefs.vapidConfigured : false;
  const toggleDisabled = !ready || busy || prefsPending || !vapidConfigured;

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

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notifications</CardTitle>
        <CardDescription>Get a nudge before class starts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Allow browser notifications and ScheduleAI can ping you before a class begins, even when
          this tab is in the background. Reminders follow your lead time above.
        </p>

        {!prefsPending && prefs && !prefs.vapidConfigured ? (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Notifications aren&apos;t configured on this server.</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 px-3 py-3">
          <div className="space-y-0.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
              <Bell className="size-4 text-indigo-600" aria-hidden="true" />
              Browser notifications
            </p>
            <p className="text-xs text-gray-500" role="status">
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
              enabled ? "bg-indigo-600" : "bg-gray-300",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
                enabled ? "translate-x-[22px]" : "translate-x-[2px]",
              )}
            />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          {ready && !isPushSupported()
            ? "This browser doesn't support notifications."
            : "Your browser will ask for permission the first time you turn this on."}
        </p>
      </CardContent>
    </Card>
  );
}
