import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";

/** Centered card layout shared by the login and register screens. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link href="/dashboard" className="mb-6 flex items-center gap-2.5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <CalendarCheck className="size-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold tracking-tight text-foreground">ScheduleAI</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Your week, sorted.
      </p>
    </div>
  );
}