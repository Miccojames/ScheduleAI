"use client";

import { usePathname } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { ThemeToggle } from "@/components/layout/Sidebar";
import { pageTitleForPath } from "@/lib/navigation";

/** Top bar shown on phones: page title, theme switch and the user's initials. */
export function Header() {
  const pathname = usePathname();

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
        <ProfileMenu variant="compact" />
      </div>
    </header>
  );
}
