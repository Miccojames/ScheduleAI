import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, CalendarDays, ScanLine, TriangleAlert } from "lucide-react";
import { cn } from "cn";

export const metadata: Metadata = {
  title: "ScheduleAI — Your class schedule, scanned in seconds",
  description:
    "Photograph your class timetable and get a clean, editable weekly plan with clash detection built in.",
};

const FEATURES = [
  {
    icon: ScanLine,
    title: "Snap the sheet, skip the typing",
    body: "Photograph the timetable from your portal or a printed page. Subjects, days, times, rooms and instructors come out structured — and anything the scan isn't sure about is flagged so you can check it.",
    accent: "from-indigo-500/15 to-transparent",
  },
  {
    icon: TriangleAlert,
    title: "Clashes caught before they bite",
    body: "Two lectures booked over each other are marked on the grid and on every card, so you can move one before it costs you a morning.",
    accent: "from-amber-500/15 to-transparent",
  },
  {
    icon: CalendarDays,
    title: "A real week, not a list",
    body: "A weekly grid with a live now-line on today, class colours you can tell apart at a glance, and one-tap edits for anything that moved.",
    accent: "from-emerald-500/15 to-transparent",
  },
] as const;

/** Decorative preview of the week grid, built entirely from divs. */
const PREVIEW_BLOCKS = [
  { day: 0, top: 6, height: 22, color: "#6366F1", label: "CS 201" },
  { day: 0, top: 46, height: 16, color: "#8B5CF6", label: "MATH 110" },
  { day: 1, top: 18, height: 20, color: "#10B981", label: "PHYS 150" },
  { day: 1, top: 52, height: 14, color: "#F59E0B", label: "ECON 101" },
  { day: 2, top: 10, height: 26, color: "#EC4899", label: "HIST 202" },
  { day: 3, top: 30, height: 18, color: "#06B6D4", label: "BIO 120" },
  { day: 3, top: 60, height: 14, color: "#3B82F6", label: "CS 101" },
  { day: 4, top: 22, height: 22, color: "#EF4444", label: "SEM 300" },
] as const;

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Indigo wash + blueprint grid, kept faint so text stays the focus. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 hero-grid" />
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_65%)] opacity-[0.14] blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6 animate-in fade-in slide-in-from-top-2 duration-500 fill-mode-both">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
              <CalendarCheck className="size-5" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold tracking-tight text-foreground">
              ScheduleAI
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Sign in
          </Link>
        </header>

        <main className="flex flex-1 flex-col justify-center py-10 sm:py-16">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <p className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                <ScanLine className="size-3.5" aria-hidden="true" />
                Built for students
              </p>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance text-foreground animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both delay-100 sm:text-5xl lg:text-6xl">
                Your class schedule,{" "}
                <span className="bg-gradient-to-br from-primary to-violet-500 bg-clip-text text-transparent">
                  scanned in seconds
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both delay-200 sm:text-lg">
                Hand us the photo of your timetable. We&apos;ll pull out every subject, day,
                time and room, flag anything that clashes, and drop the lot into a weekly
                calendar you can edit like a normal person.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both delay-300">
                <Link
                  href="/dashboard"
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-xl hover:shadow-primary/30 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Open the app
                  <ArrowRight
                    className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
                <span className="text-sm text-muted-foreground">
                  Free while you&apos;re enrolled.
                </span>
              </div>
            </div>

            <div className="lg:col-span-5 animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both delay-400">
              <WeekPreview />
            </div>
          </div>

          <ul className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <li
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:shadow-lg hover:shadow-foreground/5 animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both"
                style={{ animationDelay: `${500 + index * 120}ms` }}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 -top-16 h-32 bg-gradient-to-b opacity-0 transition-opacity duration-150 group-hover:opacity-100",
                    feature.accent,
                  )}
                />
                <span className="relative flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <feature.icon className="size-5" aria-hidden="true" />
                </span>
                <h2 className="relative mt-4 text-sm font-semibold text-foreground">
                  {feature.title}
                </h2>
                <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {feature.body}
                </p>
              </li>
            ))}
          </ul>
        </main>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-border py-6 text-xs text-muted-foreground sm:flex-row">
          <p>ScheduleAI — your timetable, typed for you.</p>
          <p>Made for students who would rather not re-enter their timetable.</p>
        </footer>
      </div>
    </div>
  );
}

function WeekPreview() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(ellipse_at_top,var(--primary)_0%,transparent_70%)] opacity-[0.12] blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-foreground/5">
        <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-3">
          <span className="text-xs font-semibold text-foreground">This week</span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            8 classes tracked
          </span>
        </div>

        <div className="grid grid-cols-5 gap-px bg-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => (
            <div key={day} className="bg-card px-1 py-2 text-center text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {day}
            </div>
          ))}
        </div>

        <div className="relative grid h-56 grid-cols-5 gap-px overflow-hidden bg-border sm:h-64">
          {[0, 1, 2, 3, 4].map((day) => (
            <div key={day} className="relative bg-card">
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="h-1/4 border-b border-dashed border-cal-line-soft last:border-b-0"
                />
              ))}
              {PREVIEW_BLOCKS.filter((block) => block.day === day).map((block) => (
                <div
                  key={block.label}
                  className="absolute inset-x-1 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 shadow-xs"
                  style={{
                    top: `${block.top}%`,
                    height: `${block.height}%`,
                    backgroundColor: `color-mix(in srgb, ${block.color} 16%, var(--card))`,
                    borderLeftColor: block.color,
                  }}
                >
                  <p className="truncate text-[10px] leading-tight font-semibold text-foreground">
                    {block.label}
                  </p>
                </div>
              ))}
            </div>
          ))}

          {/* Now-line, parked mid-afternoon for the mock. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-[52%] h-px bg-primary/70"
          >
            <span className="absolute -left-1 -top-[3px] size-1.5 rounded-full bg-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}
