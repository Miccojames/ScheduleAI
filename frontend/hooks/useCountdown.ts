"use client";

import { useEffect, useState } from "react";

/**
 * Ticks every `intervalMs` and returns a fresh Date, so countdowns stay live
 * without every component holding its own timer.
 */
export function useCountdown(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}