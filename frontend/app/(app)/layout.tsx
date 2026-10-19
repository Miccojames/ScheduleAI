import type { ReactNode } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";

/** Every signed-in page sits behind the auth guard and app shell. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}