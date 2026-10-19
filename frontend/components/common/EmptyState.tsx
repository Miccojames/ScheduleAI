import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  className?: string;
}

/** Friendly, actionable empty state — never a blank screen. */
export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center ${className ?? ""}`}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500 text-pretty">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}