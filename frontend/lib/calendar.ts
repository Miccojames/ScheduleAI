import { toMinutes } from "@/lib/time";
import type { Entry } from "@/types";

export interface DayLayout {
  entry: Entry;
  topPercent: number;
  heightPercent: number;
  leftPercent: number;
  widthPercent: number;
  /** True when the block is short enough that only the subject fits. */
  compact: boolean;
}

export interface CalendarRange {
  start: number;
  end: number;
  span: number;
}

const MINUTES_IN_HOUR = 60;

/**
 * Vertical range the grid covers. Defaults to 7AM–9PM and tightens to the
 * earliest/latest class (±1 hour) once there is something to show.
 */
export function calendarRange(entries: Entry[]): CalendarRange {
  const fallbackStart = 7 * MINUTES_IN_HOUR;
  const fallbackEnd = 21 * MINUTES_IN_HOUR;

  if (entries.length === 0) {
    return { start: fallbackStart, end: fallbackEnd, span: fallbackEnd - fallbackStart };
  }

  const starts = entries.map((entry) => toMinutes(entry.startTime));
  const ends = entries.map((entry) => toMinutes(entry.endTime));
  const earliest = Math.min(...starts);
  const latest = Math.max(...ends);

  const start = Math.max(0, Math.floor((earliest - MINUTES_IN_HOUR) / 60) * 60);
  const end = Math.min(24 * 60, Math.ceil((latest + MINUTES_IN_HOUR) / 60) * 60);

  return { start, end, span: Math.max(end - start, 60) };
}

/**
 * Places one day's classes inside a single column, splitting the width when
 * classes overlap so nothing is hidden behind another block.
 */
export function layoutDay(entries: Entry[], range: CalendarRange): DayLayout[] {
  const sorted = [...entries].sort((a, b) => {
    const byStart = toMinutes(a.startTime) - toMinutes(b.startTime);
    return byStart !== 0 ? byStart : toMinutes(a.endTime) - toMinutes(b.endTime);
  });

  const positions: DayLayout[] = [];
  let cluster: { entry: Entry; column: number }[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const columns = columnEnds.length;
    for (const { entry, column } of cluster) {
      positions.push(toLayout(entry, range, column, columns));
    }
    cluster = [];
    clusterEnd = -1;
    columnEnds = [];
  };

  for (const entry of sorted) {
    const start = toMinutes(entry.startTime);
    const end = toMinutes(entry.endTime);

    // A class starting after everything so far ends begins a new cluster,
    // so only genuinely overlapping classes share a row.
    if (cluster.length > 0 && start >= clusterEnd) flush();

    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      columnEnds.push(end);
      column = columnEnds.length - 1;
    } else {
      columnEnds[column] = end;
    }

    cluster.push({ entry, column });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();

  return positions;
}

function toLayout(entry: Entry, range: CalendarRange, column: number, columns: number): DayLayout {
  const start = toMinutes(entry.startTime);
  const end = Math.max(toMinutes(entry.endTime), start + 15);
  const duration = end - start;

  return {
    entry,
    topPercent: ((start - range.start) / range.span) * 100,
    heightPercent: (duration / range.span) * 100,
    leftPercent: (column / columns) * 100,
    widthPercent: 100 / columns,
    compact: duration <= 45,
  };
}

/** Hour marks drawn in the time gutter. */
export function hourMarks(range: CalendarRange): number[] {
  const marks: number[] = [];
  for (let minute = range.start; minute <= range.end; minute += MINUTES_IN_HOUR) marks.push(minute);
  return marks;
}