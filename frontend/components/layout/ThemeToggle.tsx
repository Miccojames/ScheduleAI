"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "cn";

/** Hydration flag: false while server-rendering, true on the client. */
const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

/**
 * Light/dark switch, shared by the mobile header, the desktop sidebar and the
 * public landing page so every bar behaves identically. Resolves against the
 * *current* theme, so the first click on a fresh "system" install flips away
 * from whatever the OS is showing. The icon swap waits for hydration to keep
 * markup deterministic.
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
