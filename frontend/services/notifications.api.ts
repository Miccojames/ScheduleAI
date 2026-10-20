import { api } from "@/services/api";

/** GET/PUT /api/notifications/prefs payload, mirrors the backend contract. */
export interface NotificationPrefs {
  reminderLeadMinutes: number;
  notificationsEnabled: boolean;
  timezone: string | null;
  vapidConfigured: boolean;
}

export interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export interface UpdatePrefsInput {
  reminderLeadMinutes?: number;
  timezone?: string;
  notificationsEnabled?: boolean;
}

export const notificationKeys = {
  prefs: ["notifications", "prefs"] as const,
  vapidPublicKey: ["notifications", "vapid-public-key"] as const,
};

export const notificationsApi = {
  /** 503 (surfaced as an ApiError) while the server has no VAPID keys. */
  vapidPublicKey() {
    return api<{ publicKey: string }>("/api/notifications/vapid-public-key");
  },

  subscribe(input: SubscribeInput) {
    return api<{ subscription: { id: string; endpoint: string } }>(
      "/api/notifications/subscribe",
      { method: "POST", body: input },
    );
  },

  /** `endpoint` goes in the body — the backend validates it as a URL. */
  unsubscribe(endpoint: string) {
    return api<null>("/api/notifications/subscribe", {
      method: "DELETE",
      body: { endpoint },
    });
  },

  prefs() {
    return api<NotificationPrefs>("/api/notifications/prefs");
  },

  updatePrefs(input: UpdatePrefsInput) {
    return api<NotificationPrefs>("/api/notifications/prefs", {
      method: "PUT",
      body: input,
    });
  },

  /** POST /api/notifications/test — immediate push to this user's browsers. */
  test() {
    return api<{ delivered: number; sent: number }>("/api/notifications/test", {
      method: "POST",
    });
  },
};
