"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { useMe } from "@/hooks/useAuth";
import { pageTitleForPath } from "@/lib/navigation";
import { initials } from "@/components/layout/Sidebar";
import { cn } from "cn";

/** Top bar shown on phones: page title plus the user's initials. */
export function Header() {
  const pathname = usePathname();
  const { data: user } = useMe();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-4 backdrop-blur md:hidden">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <CalendarCheck className="size-4.5" aria-hidden="true" />
        </span>
        <span className="text-base font-semibold tracking-tight text-zinc-900">
          {pageTitleForPath(pathname)}
        </span>
      </div>
      <Link
        href="/settings"
        aria-label="Account settings"
        className={cn(
          "flex size-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700",
          "transition-opacity hover:opacity-80",
        )}
      >
        {initials(user?.firstName, user?.lastName)}
      </Link>
    </header>
  );
}