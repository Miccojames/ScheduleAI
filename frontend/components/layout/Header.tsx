"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { pageTitleForPath } from "@/lib/navigation";
import { ThemeToggle, initials } from "@/components/layout/Sidebar";
import { cn } from "cn";

/** Top bar shown on phones: page title, theme switch and the user's initials. */
export function Header() {
  const pathname = usePathname();
  const { data: user } = useMe();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:hidden">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
          <CalendarCheck className="size-4.5" aria-hidden="true" />
        </span>
        <span className="truncate text-base font-semibold tracking-tight text-foreground">
          {pageTitleForPath(pathname)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Account settings"
          className={cn(
            "flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
            "transition-transform duration-150 hover:scale-105 active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {initials(user?.firstName, user?.lastName)}
        </Link>
      </div>
    </header>
  );
}
