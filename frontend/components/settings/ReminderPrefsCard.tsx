"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, Globe } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNotificationPrefs, useUpdateNotificationPrefs } from "@/hooks/useNotifications";
import { notificationsApi, notificationKeys } from "@/services/notifications.api";
import { apiErrorMessage } from "@/services/api";
import { REMINDER_OPTIONS, useReminderStore } from "@/stores/reminderStore";

export function ReminderPrefsCard() {
  const queryClient = useQueryClient();
  const { data: prefs, isPending } = useNotificationPrefs();
  const updatePrefs = useUpdateNotificationPrefs();

  const reminderLeadMinutes = useReminderStore((state) => state.reminderLeadMinutes);
  const setReminderLeadMinutes = useReminderStore((state) => state.setReminderLeadMinutes);

  const [browserTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const didHydrate = useRef(false);

  // One-time hydration: seed the zustand cache (what the dashboard reads) from
  // the server, then push the browser timezone up if the server has none/other.
  useEffect(() => {
    if (!prefs || didHydrate.current) return;
    didHydrate.current = true;

    setReminderLeadMinutes(prefs.reminderLeadMinutes);

    if (browserTimezone && prefs.timezone !== browserTimezone) {
      notificationsApi
        .updatePrefs({ timezone: browserTimezone })
        .then((updated) => {
          queryClient.setQueryData(notificationKeys.prefs, updated);
        })
        .catch(() => {
          // Timezone is display-only — a failed sync shouldn't bother the user.
        });
    }
  }, [prefs, browserTimezone, setReminderLeadMinutes, queryClient]);

  const handleLeadChange = (value: string) => {
    const next = Number(value);
    const previous = reminderLeadMinutes;
    if (next === previous) return;

    // Optimistic: the dashboard banner flips immediately, the server follows.
    setReminderLeadMinutes(next);
    updatePrefs.mutate(
      { reminderLeadMinutes: next },
      {
        onError: (error) => {
          setReminderLeadMinutes(previous);
          toast.error(apiErrorMessage(error, "We couldn't save your reminder preference."));
        },
      },
    );
  };

  return (
    <Card className="rounded-2xl border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Reminder preferences</CardTitle>
        <CardDescription>How early the dashboard should warn you before a class starts.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          <Label htmlFor="reminder-lead">Remind me</Label>
          <Select
            value={String(reminderLeadMinutes)}
            onValueChange={handleLeadChange}
            disabled={isPending || updatePrefs.isPending}
          >
            <SelectTrigger id="reminder-lead" className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes} minutes before
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <BellRing className="size-3.5" aria-hidden="true" />
            You&apos;ll see a reminder banner when a class is about to begin.
          </p>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <Globe className="size-3.5" aria-hidden="true" />
            Timezone: {prefs ? prefs.timezone ?? browserTimezone : browserTimezone} (from this
            device)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
