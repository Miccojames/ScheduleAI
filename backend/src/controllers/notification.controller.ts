import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { sendError, sendSuccess } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isConfigured } from "../services/push.service.js";
import * as notificationService from "../services/notification.service.js";
import type { SubscribeInput, UpdatePrefsInput } from "../services/notification.service.js";

// Bodies arrive already parsed by `validate(...)` in the route layer, so each
// handler only narrows the (typed) shape it expects.

/** GET /api/notifications/vapid-public-key — 503 while push is unconfigured. */
export const vapidPublicKey = asyncHandler(async (_req: Request, res: Response) => {
  if (!isConfigured()) {
    sendError(res, { status: 503, message: "Push notifications are not configured." });
    return;
  }
  sendSuccess(res, { data: { publicKey: env.VAPID_PUBLIC_KEY } });
});

/** POST /api/notifications/subscribe — upsert by endpoint (same browser). */
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const subscription = await notificationService.upsertSubscription(
    req.user!.id,
    req.body as SubscribeInput
  );
  sendSuccess(res, { data: { subscription }, message: "Subscribed to push notifications." });
});

/** DELETE /api/notifications/subscribe — remove the endpoint for this user. */
export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  await notificationService.removeSubscription(req.user!.id, endpoint);
  sendSuccess(res, { data: null, message: "Subscription removed." });
});

/** GET /api/notifications/prefs */
export const getPrefs = asyncHandler(async (req: Request, res: Response) => {
  const prefs = await notificationService.getPrefs(req.user!.id);
  sendSuccess(res, { data: prefs });
});

/** PUT /api/notifications/prefs */
export const updatePrefs = asyncHandler(async (req: Request, res: Response) => {
  const prefs = await notificationService.updatePrefs(req.user!.id, req.body as UpdatePrefsInput);
  sendSuccess(res, { data: prefs, message: "Notification preferences updated." });
});

/**
 * POST /api/notifications/test — send a test push to every browser this user
 * subscribed, so they can confirm reminders work without waiting for a class.
 * Creates NO reminder log rows (a test must not consume a reminder slot).
 */
export const sendTestNotification = asyncHandler(async (req: Request, res: Response) => {
  if (!isConfigured()) {
    sendError(res, { status: 503, message: "Push notifications are not configured." });
    return;
  }

  const subscriptions = await notificationService.listSubscriptions(req.user!.id);
  if (subscriptions.length === 0) {
    sendError(res, {
      status: 400,
      message: "Enable notifications for this browser first, then try again.",
    });
    return;
  }

  let delivered = 0;
  for (const subscription of subscriptions) {
    const ok = await notificationService.sendTestPush(subscription);
    if (ok) delivered += 1;
  }

  if (delivered === 0) {
    sendError(res, {
      status: 502,
      message: "We couldn't deliver the test notification. Try re-enabling notifications.",
    });
    return;
  }

  sendSuccess(res, {
    data: { delivered, sent: subscriptions.length },
    message: "Test notification sent — check your device.",
  });
});
