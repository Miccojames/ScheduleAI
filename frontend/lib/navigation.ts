import {
  CalendarDays,
  History,
  ImageUp,
  Layers,
  LayoutDashboard,
  PlusCircle,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Your Week", href: "/schedule", icon: CalendarDays },
  { label: "Scan Timetable", href: "/upload", icon: ImageUp },
  { label: "Uploads", href: "/uploads", icon: History },
  { label: "Schedules", href: "/schedules", icon: Layers },
  { label: "Add Event", href: "/add-class", icon: PlusCircle },
  { label: "Settings", href: "/settings", icon: Settings },
];

export const MOBILE_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Week", href: "/schedule", icon: CalendarDays },
  { label: "Scan", href: "/upload", icon: ImageUp },
  { label: "Schedules", href: "/schedules", icon: Layers },
  { label: "More", href: "/settings", icon: Settings },
];

/** Page title shown in the mobile header bar. */
export function pageTitleForPath(pathname: string): string {
  if (pathname.startsWith("/upload/review")) return "Review Plan";
  if (pathname.startsWith("/add-class")) return "Add Event";
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "ScheduleAI";
}