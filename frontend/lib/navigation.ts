import { CalendarDays, ImageUp, Layers, LayoutDashboard, PlusCircle, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Upload Schedule", href: "/upload", icon: ImageUp },
  { label: "Schedules", href: "/schedules", icon: Layers },
  { label: "Add Class", href: "/add-class", icon: PlusCircle },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Schedule", href: "/schedule", icon: CalendarDays },
  { label: "Upload", href: "/upload", icon: ImageUp },
  { label: "Schedules", href: "/schedules", icon: Layers },
  { label: "More", href: "/settings", icon: Settings },
];

/** Page title shown in the mobile header bar. */
export function pageTitleForPath(pathname: string): string {
  if (pathname.startsWith("/upload/review")) return "Review Schedule";
  if (pathname.startsWith("/add-class")) return "Add Class";
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "ScheduleAI";
}