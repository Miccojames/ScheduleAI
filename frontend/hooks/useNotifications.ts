"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  notificationKeys,
  notificationsApi,
  type SubscribeInput,
  type UpdatePrefsInput,
} from "@/services/notifications.api";

export { notificationKeys };

/**
 * Notification preferences for the signed-in user. Only queried by the
 * settings page (the hook isn't mounted anywhere else), so it never runs
 * behind AuthGuard for anonymous visitors.
 */
export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationKeys.prefs,
    queryFn: async () => notificationsApi.prefs(),
    staleTime: 60 * 1000,
  });
}

/** Toasts live at the call sites — the cards own their copy. */
export function useSubscribePush() {
  return useMutation({
    mutationFn: (input: SubscribeInput) => notificationsApi.subscribe(input),
  });
}

export function useUnsubscribePush() {
  return useMutation({
    mutationFn: (endpoint: string) => notificationsApi.unsubscribe(endpoint),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePrefsInput) => notificationsApi.updatePrefs(input),
    // Server response is the source of truth — replaces the cached prefs.
    onSuccess: (prefs) => {
      queryClient.setQueryData(notificationKeys.prefs, prefs);
    },
  });
}
