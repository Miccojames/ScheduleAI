import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import * as notificationController from "../controllers/notification.controller.js";

/**
 * Web Push notifications.
 *   GET    /api/notifications/vapid-public-key  -> { publicKey }  (503 if unconfigured)
 *   POST   /api/notifications/subscribe         -> upsert { endpoint, keys: { p256dh, auth } }
 *   DELETE /api/notifications/subscribe         -> remove { endpoint }
 *   GET    /api/notifications/prefs             -> { reminderLeadMinutes, notificationsEnabled, timezone, vapidConfigured }
 *   PUT    /api/notifications/prefs             -> update prefs
 *
 * Schemas live here (small, route-only) and run through the shared `validate`
 * middleware so failures use the project's 400 error envelope.
 */
const subscribeSchema = z.object({
  endpoint: z.url("endpoint must be a valid URL"),
  keys: z.object({
    p256dh: z.string("p256dh is required").min(1, "p256dh is required"),
    auth: z.string("auth is required").min(1, "auth is required"),
  }),
  userAgent: z.string().optional(),
});

const unsubscribeSchema = z.object({
  endpoint: z.url("endpoint must be a valid URL"),
});

const prefsSchema = z.object({
  reminderLeadMinutes: z.number().int().min(1).max(120).optional(),
  timezone: z.string().max(64).optional(),
  notificationsEnabled: z.boolean().optional(),
});

const router = Router();

router.use(requireAuth);

router.get("/vapid-public-key", notificationController.vapidPublicKey);
router.post("/subscribe", validate(subscribeSchema), notificationController.subscribe);
router.delete("/subscribe", validate(unsubscribeSchema), notificationController.unsubscribe);
router.get("/prefs", notificationController.getPrefs);
router.put("/prefs", validate(prefsSchema), notificationController.updatePrefs);

export default router;
