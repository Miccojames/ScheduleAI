"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, Loader2, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { ClassForm, classFormToPayload, type ClassFormValues } from "@/components/schedule/ClassForm";
import { ConflictWarning } from "@/components/schedule/ConflictWarning";
import { useCreateEntry } from "@/hooks/useCreateEntry";
import { useActiveSchedule } from "@/hooks/useSchedules";
import { apiErrorMessage } from "@/services/api";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Conflict } from "@/types";

export default function AddClassPage() {
  const router = useRouter();
  const { schedules, active, isLoading, isError, refetch } = useActiveSchedule();
  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const createEntry = useCreateEntry();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  if (isLoading) return <LoadingState rows={3} />;
  if (isError) return <ErrorState message={apiErrorMessage(isError)} onRetry={() => refetch()} />;

  if (schedules.length === 0 || !active) {
    return (
      <>
        <PageHeader title="Add Event" />
        <EmptyState
          icon={CalendarX2}
          title="No schedule yet."
          body="Scan a timetable photo and we'll organize it for you."
          action={
            <Button onClick={() => router.push("/upload")}>
              <PlusCircle className="size-4" aria-hidden="true" />
              Scan a timetable
            </Button>
          }
        />
      </>
    );
  }

  async function handleSubmit(values: ClassFormValues) {
    const payload = classFormToPayload(values);

    try {
      const result = await createEntry.mutateAsync({ scheduleId: values.scheduleId, payload });
      if (result.conflicts.length > 0) {
        setConflicts(result.conflicts);
        setSavedCount((count) => count + 1);
      } else {
        router.push("/schedule");
      }
    } catch {
      // Toast already shown by the mutation hook; keep the form open.
    }
  }

  return (
    <>
      <PageHeader
        title="Add Event"
        description="Add a single event to one of your schedules."
      />

      <div className="mx-auto max-w-2xl space-y-4">
        <ConflictWarning conflicts={conflicts} actionHref="/schedule" actionLabel="View schedule" />

        {conflicts.length > 0 ? (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Add another event</CardTitle>
            </CardHeader>
            <CardContent>
              <ClassForm
                schedules={schedules}
                defaultValues={{ scheduleId: activeScheduleId ?? active.id }}
                submitLabel="Add Event"
                isPending={createEntry.isPending}
                onSubmit={handleSubmit}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="pt-6">
              <ClassForm
                key={savedCount}
                schedules={schedules}
                defaultValues={{ scheduleId: activeScheduleId ?? active.id }}
                submitLabel="Add Event"
                isPending={createEntry.isPending}
                onSubmit={handleSubmit}
                onCancel={() => router.back()}
              />
            </CardContent>
          </Card>
        )}

        {createEntry.isPending ? (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Saving your event…
          </p>
        ) : null}
      </div>
    </>
  );
}