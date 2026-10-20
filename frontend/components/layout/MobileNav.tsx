"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS } from "@/lib/navigation";
import { cn } from "cn";

/** Fixed bottom navigation for phones, with a raised center upload action. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const isAccent = item.label === "Upload";

          return (
            <li key={item.href} className="flex justify-center">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isAccent || isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-xl transition-[color,background-color,transform] duration-150",
                    isAccent
                      ? "-mt-6 size-12 bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
                      : "size-7",
                    isActive && !isAccent ? "bg-accent text-accent-foreground" : "",
                    isAccent ? "active:scale-95" : "active:scale-90",
                  )}
                >
                  <item.icon className={isAccent ? "size-5" : "size-5"} aria-hidden="true" />
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
