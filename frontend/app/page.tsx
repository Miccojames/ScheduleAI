import { redirect } from "next/navigation";

/** The root path always lands on the dashboard. */
export default function RootPage() {
  redirect("/dashboard");
}