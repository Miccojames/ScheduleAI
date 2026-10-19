"use client";

import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  /** Tailwind classes for the icon chip. */
  tone?: string;
}

interface StatsCardsProps {
  stats: StatItem[];
  isLoading?: boolean;
}

const DEFAULT_TONE = "bg-indigo-50 text-indigo-600";

/** Three small summary cards at the top of the dashboard. */
export function StatsCards({ stats, isLoading = false }: StatsCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="rounded-2xl border-gray-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{stat.label}</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-7 w-20" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
                    {stat.value}
                  </p>
                )}
                {stat.hint && !isLoading ? (
                  <p className="mt-0.5 truncate text-xs text-gray-500">{stat.hint}</p>
                ) : null}
              </div>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${stat.tone ?? DEFAULT_TONE}`}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}