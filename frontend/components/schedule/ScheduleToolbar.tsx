"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_ORDER, shortLabel } from "@/lib/time";
import type { DayOfWeek } from "@/types";

export type DayFilter = DayOfWeek | "ALL";
export type SortMode = "time" | "subject";

interface ScheduleToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  dayFilter: DayFilter;
  onDayFilterChange: (value: DayFilter) => void;
  sort: SortMode;
  onSortChange: (value: SortMode) => void;
  resultCount: number;
}

/** Search, day filter and sort controls for the schedule page. */
export function ScheduleToolbar({
  search,
  onSearchChange,
  dayFilter,
  onDayFilterChange,
  sort,
  onSortChange,
  resultCount,
}: ScheduleToolbarProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Label htmlFor="schedule-search" className="sr-only">
            Search classes
          </Label>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            id="schedule-search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search subject, instructor, or room"
            className="pl-9"
            type="search"
          />
        </div>

        <div>
          <Label htmlFor="day-filter" className="sr-only">
            Filter by day
          </Label>
          <Select value={dayFilter} onValueChange={(value: DayFilter) => onDayFilterChange(value)}>
            <SelectTrigger id="day-filter" className="w-full sm:w-36">
              <SelectValue placeholder="All days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All days</SelectItem>
              {DAY_ORDER.map((day) => (
                <SelectItem key={day} value={day}>
                  {shortLabel(day)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="sort-order" className="sr-only">
            Sort classes
          </Label>
          <Select value={sort} onValueChange={(value: SortMode) => onSortChange(value)}>
            <SelectTrigger id="sort-order" className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">By time</SelectItem>
              <SelectItem value="subject">By subject</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500" aria-live="polite">
        Showing {resultCount} {resultCount === 1 ? "class" : "classes"}
      </p>
    </div>
  );
}