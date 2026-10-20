"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { CalendarPlus, ImageDown, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { apiErrorMessage } from "@/services/api";
import { scheduleApi } from "@/services/schedule.api";
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
  /** The schedule being viewed — enables the export actions. */
  schedule?: { id: string; name: string } | null;
  /** Node captured by html-to-image for "Save image" (the weekly grid). */
  exportTargetRef?: React.RefObject<HTMLElement | null>;
}

/** Filesystem-safe base name for downloaded exports. */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, " ").trim();
  return cleaned || "schedule";
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
  schedule = null,
  exportTargetRef,
}: ScheduleToolbarProps) {
  const [exportingIcs, setExportingIcs] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  async function handleDownloadIcs() {
    if (!schedule) return;
    setExportingIcs(true);
    try {
      const icsText = await scheduleApi.fetchIcs(schedule.id);
      const blob = new Blob([icsText], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileName(schedule.name)}.ics`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Calendar file downloaded. Open it to add these classes to your calendar app.");
    } catch (error) {
      toast.error(apiErrorMessage(error, "We couldn't export this schedule."));
    } finally {
      setExportingIcs(false);
    }
  }

  async function handleSaveImage() {
    const node = exportTargetRef?.current;
    if (!node) {
      toast.error("The calendar isn't ready to export yet. Try again in a moment.");
      return;
    }
    setSavingImage(true);
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${safeFileName(schedule?.name ?? "schedule")}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success("Schedule image saved.");
    } catch {
      toast.error("We couldn't save the image. Please try again.");
    } finally {
      setSavingImage(false);
    }
  }

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

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500" aria-live="polite">
          Showing {resultCount} {resultCount === 1 ? "class" : "classes"}
        </p>

        {schedule ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveImage}
              disabled={savingImage}
            >
              {savingImage ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ImageDown className="size-4" aria-hidden="true" />
              )}
              Save image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadIcs}
              disabled={exportingIcs}
            >
              {exportingIcs ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <CalendarPlus className="size-4" aria-hidden="true" />
              )}
              Add to Calendar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
