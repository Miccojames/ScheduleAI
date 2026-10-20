"use client";

import Link from "next/link";
import { Bell, ChevronUp, KeyRound, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout, useMe } from "@/hooks/useAuth";
import { initials } from "@/lib/initials";
import { cn } from "cn";

interface ProfileMenuProps {
  /**
   * "full" = avatar + name + email row (desktop sidebar footer),
   * "compact" = avatar only (mobile top bar).
   */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * The account menu: a card with the profile header on top and the account
 * actions below (Your account · Change password · Notifications · Log out).
 * Rendered in both the desktop sidebar footer and the mobile top bar, so
 * signing out is always one tap away.
 */
export function ProfileMenu({ variant = "full", className }: ProfileMenuProps) {
  const { data: user } = useMe();
  const logout = useLogout();

  const name = user ? `${user.firstName} ${user.lastName}` : "Your account";
  const email = user?.email ?? "";
  const isFull = variant === "full";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isFull ? (
          <button
            type="button"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2 rounded-xl px-1 py-2 text-left transition-colors",
              "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              className,
            )}
          >
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground"
            >
              {initials(user?.firstName, user?.lastName)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">
                {name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronUp
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Your account"
            className={cn(
              "flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground",
              "transition-transform duration-150 hover:scale-105 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              className,
            )}
          >
            {initials(user?.firstName, user?.lastName)}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isFull ? "start" : "end"}
        side={isFull ? "top" : "bottom"}
        className="w-64 p-1.5"
      >
        {/* Profile header — avatar, name and email. */}
        <div className="flex items-center gap-2.5 px-2 py-2">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            {initials(user?.firstName, user?.lastName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          </span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="gap-2">
          <Link href="/settings">
            <User className="size-4" aria-hidden="true" />
            Your account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/settings#password">
            <KeyRound className="size-4" aria-hidden="true" />
            Change password
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2">
          <Link href="/settings#notifications">
            <Bell className="size-4" aria-hidden="true" />
            Notifications
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          className="gap-2"
          onSelect={() => logout.mutate()}
          disabled={logout.isPending}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
