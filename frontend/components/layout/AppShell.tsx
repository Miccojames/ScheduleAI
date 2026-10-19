import type { ReactNode } from "react";
import { ActiveScheduleSync } from "@/components/layout/ActiveScheduleSync";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";

/** Desktop sidebar + mobile header/bottom nav around the page content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <ActiveScheduleSync />
      <Sidebar />
      <div className="md:pl-64">
        <Header />
        <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-24 sm:px-6 md:pb-12">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}