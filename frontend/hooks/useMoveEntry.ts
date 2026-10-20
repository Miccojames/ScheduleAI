"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import type { DayOfWeek, Entry, EntryPayload } from "@/types";

export interface MoveTarget {
  day: DayOfWeek;
  /** 24h "HH:MM" — the snapped new start. */
  startTime: string;
  /** 24h "HH:MM" — new start + original duration. */
  endTime: string;
}

/** Full PATCH payload for an entry, optionally moved to a new day/time. */
function payloadFrom(entry: Entry, target?: MoveTarget): EntryPayload {
  return {
    subject: entry.subject,
    day: target?.day ?? entry.day,
    startTime: target?.startTime ?? entry.startTime,
    endTime: target?.endTime ?? entry.endTime,
    instructor: entry.instructor ?? undefined,
    room: entry.room ?? undefined,
    notes: entry.notes ?? undefined,
    color: entry.color,
    exceptionDates: entry.exceptionDates,
    kind: entry.kind,
  };
}

/**
 * Drag-to-reschedule on the weekly grid: PATCH the entry to its new day/time
 * and offer a one-click Undo that patches back. Overlaps are allowed (the
 * backend computes conflicts, it doesn't block) but get a warning toast —
 * same lenient policy as creating an overlapping class by hand.
 */
export function useMoveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entry, target }: { entry: Entry; target: MoveTarget }) => {
      const result = await scheduleApi.updateEntry(
        entry.scheduleId,
        entry.id,
        payloadFrom(entry, target),
      );
      return { entry, result };
    },
    onSuccess: async ({ entry, result }) => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });

      const inConflict = result.conflicts.some(
        (conflict) => conflict.a.id === result.entry.id || conflict.b.id === result.entry.id,
      );
      if (inConflict) {
        toast.warning("Event moved — but it now overlaps another one.");
        return;
      }

      toast.success("Event moved.", {
        action: {
          label: "Undo",
          onClick: () => {
            // Fire-and-forget revert; the cache refreshes via invalidation.
            void scheduleApi
              .updateEntry(entry.scheduleId, entry.id, payloadFrom(entry))
              .then(() => queryClient.invalidateQueries({ queryKey: scheduleKeys.all }))
              .catch((error) =>
                toast.error(apiErrorMessage(error, "We couldn't undo that move.")),
              );
          },
        },
      });
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't move this event."));
    },
  });
}
