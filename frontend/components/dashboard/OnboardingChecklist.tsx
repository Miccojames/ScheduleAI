"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, ImageUp, ListChecks, PlusCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "scheduleai:onboarding-dismissed";
const DISMISS_EVENT = "scheduleai:onboarding-dismiss-changed";

function subscribeToDismissChanges(onStoreChange: () => void): () => void {
  window.addEventListener(DISMISS_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(DISMISS_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

const STEPS = [
  {
    title: "Upload a schedule photo",
    body: "Our AI reads any timetable and turns it into calendar blocks.",
    href: "/upload",
    icon: ImageUp,
    cta: "Upload photo",
  },
  {
    title: "Or add an event manually",
    body: "Prefer to type it in? Add an event in seconds.",
    href: "/add-class",
    icon: PlusCircle,
    cta: "Add event",
  },
  {
    title: "Explore your calendar",
    body: "See your week at a glance, filter by day, and export it.",
    href: "/schedule",
    icon: CalendarDays,
    cta: "Open calendar",
  },
] as const;

/**
 * Dismissible 3-step getting-started card for empty schedules.
 * The dismissed flag lives in localStorage and is read through
 * useSyncExternalStore so server and client markup stay in sync.
 */
export function OnboardingChecklist() {
  const dismissed = useSyncExternalStore(
    subscribeToDismissChanges,
    readDismissed,
    () => false, // Server render: assume not dismissed; the client re-checks after hydration.
  );

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable (private mode) — the card simply returns next visit.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }, []);

  if (dismissed) return null;

  return (
    <section
      aria-label="Getting started"
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ListChecks className="size-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Get set up</h2>
            <p className="text-xs text-muted-foreground">Three quick steps to make the most of ScheduleAI.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss getting started checklist"
          onClick={dismiss}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 space-y-3">
        {STEPS.map((step, index) => (
          <li
            key={step.href}
            className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 p-3"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-card text-primary shadow-sm">
              <step.icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {step.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.body}</p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={step.href}>{step.cta}</Link>
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
