// Background jobs. `startJobs()` is called once from server.ts.
import { isTest } from "../config/env.js";
import { configure, isConfigured } from "../services/push.service.js";
import { runReminderSweep } from "../services/notification.service.js";
import { startCleanupJob } from "./cleanup.js";

const REMINDER_TICK_MS = 60_000;
const FIRST_SWEEP_DELAY_MS = 5_000;

export function startJobs(): void {
  // Tests/smoke runs must never keep timers (or the process) alive.
  if (isTest) {
    console.log("[jobs] NODE_ENV=test — background jobs disabled.");
    return;
  }

  // VAPID: configure once at startup when keys are present.
  if (isConfigured() && configure()) {
    console.log("[jobs] Web Push configured (VAPID keys present).");
  } else {
    console.warn(
      "[jobs] Web Push NOT configured — set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. " +
        "Reminder pushes are disabled until then."
    );
  }

  // Reminder sweep — every minute; unref'd so it never blocks shutdown.
  const sweep = setInterval(() => {
    void runReminderSweep(new Date());
  }, REMINDER_TICK_MS);
  sweep.unref();

  // First pass shortly after boot (not immediately: let the HTTP server bind
  // and Prisma warm up first).
  const initialSweep = setTimeout(() => {
    void runReminderSweep(new Date());
  }, FIRST_SWEEP_DELAY_MS);
  initialSweep.unref();

  startCleanupJob();
  console.log(`[jobs] reminder sweep every ${REMINDER_TICK_MS / 1000}s (first in ${FIRST_SWEEP_DELAY_MS / 1000}s).`);
}
