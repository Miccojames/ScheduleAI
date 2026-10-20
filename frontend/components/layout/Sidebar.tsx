"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "cn";

/** Fixed desktop sidebar: logo, primary navigation, user card. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2.5 px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/25">
          <CalendarCheck className="size-5" aria-hidden="true" />
        </span>
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          ScheduleAI
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-[color,background-color] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                isActive
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "size-4.5 transition-transform duration-150",
                  isActive ? "text-sidebar-primary" : "group-hover:scale-105",
                )}
                aria-hidden="true"
              />
              {/* Label copy lives in lib/navigation.ts (not owned here) — the
                  nav item reads "Add Event" while the route stays /add-class. */}
              {item.href === "/add-class" ? "Add Event" : item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-1 px-1 py-1">
          <ProfileMenu variant="full" />
          <ThemeToggle className="hover:bg-muted" />
        </div>
      </div>
    </aside>
  );
}
