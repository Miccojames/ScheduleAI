"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import type { Schedule } from "@/types";

const NEW_SCHEDULE_VALUE = "__new__";

interface ScheduleSelectorProps {
  schedules: Schedule[];
  value: string | null;
  onChange: (scheduleId: string | null) => void;
  /** Called when a new schedule is named, so the page can create it on save. */
  onCreateNameChange: (name: string) => void;
  isCreating: boolean;
}

/** Pick an existing schedule or name a new one. */
export function ScheduleSelector({
  schedules,
  value,
  onChange,
  onCreateNameChange,
  isCreating,
}: ScheduleSelectorProps) {
  const [newName, setNewName] = useState("");
  const isNew = value === NEW_SCHEDULE_VALUE;

  function updateName(next: string) {
    setNewName(next);
    onCreateNameChange(next);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <Label htmlFor="review-schedule">Save into</Label>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger id="review-schedule" className="mt-1.5 w-full">
          <SelectValue placeholder="Choose a schedule" />
        </SelectTrigger>
        <SelectContent>
          {schedules.map((schedule) => (
            <SelectItem key={schedule.id} value={schedule.id}>
              {schedule.name}
            </SelectItem>
          ))}
          <SelectItem value={NEW_SCHEDULE_VALUE}>＋ New schedule</SelectItem>
        </SelectContent>
      </Select>

      {isNew ? (
        <div className="mt-3">
          <Label htmlFor="new-schedule-name" className="text-xs text-gray-500">
            Schedule name
          </Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id="new-schedule-name"
              value={newName}
              onChange={(event) => updateName(event.target.value)}
              placeholder="BSIT 3A - 1st Semester"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Add schedule"
              disabled={!newName.trim() || isCreating}
              onClick={() => {
                if (newName.trim()) onCreateNameChange(newName.trim());
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { NEW_SCHEDULE_VALUE };