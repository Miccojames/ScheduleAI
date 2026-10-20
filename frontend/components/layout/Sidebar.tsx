"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { CalendarCheck, Bell, ChevronUp, LogOut, Moon, Sun, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe } from "@/hooks/useAuth";
import { NAV_ITEMS } from "@/lib/navigation";
import { cn } from "cn";

export function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "S";
}

/** Hydration flag: false while server-rendering, true on the client. */
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Light/dark switch, shared by the mobile header and the desktop sidebar so
 * both bars behave identically. Resolves against the *current* theme, so the
 * first click on a fresh "system" install flips away from whatever the OS is
 * showing. The icon swap waits for hydration to keep markup deterministic.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useSyncExternalStore(noopSubscribe, onClient, onServer);

  const isDark = hydrated && resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground",
        "transition-colors duration-150 hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <span className="relative block size-4.5">
        <Sun
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-4.5 transition-[opacity,transform,rotate] duration-150 ease-out",
            isDark ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <Moon
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-4.5 transition-[opacity,transform,rotate] duration-150 ease-out",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0",
          )}
        />
      </span>
    </button>
  );
}

/** Fixed desktop sidebar: logo, primary navigation, user card. */
export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useMe();
  const logout = useLogout();

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground"
                >
                  {initials(user?.firstName, user?.lastName)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-sidebar-foreground">
                    {user ? `${user.firstName} ${user.lastName}` : "Your account"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user?.email ?? ""}
                  </span>
                </span>
                <ChevronUp
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {user?.email ?? "Your account"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <User className="size-4" aria-hidden="true" />
                  Your account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings#notifications">
                  <Bell className="size-4" aria-hidden="true" />
                  Notifications
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => logout.mutate()}
                disabled={logout.isPending}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeToggle className="hover:bg-muted" />
        </div>
      </div>
    </aside>
  );
}
