import { Briefcase, GraduationCap, Heart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Event kinds — the app is not just for classes anymore. An entry's kind is
 * optional on the wire: anything missing (or unrecognized) is a plain class.
 */

export type EntryKind = "class" | "work" | "personal" | "other";

/** Stable display order for pickers / filter chips. */
export const ENTRY_KINDS = ["class", "work", "personal", "other"] as const;

export interface KindMeta {
  /** Singular label, e.g. "Work". */
  label: string;
  /** Plural label for counts, e.g. "Classes". */
  plural: string;
  icon: LucideIcon;
  /** Palette color suggested when the user switches to this kind. */
  defaultColor: string;
  /** Short helper text shown under the kind picker. */
  description: string;
}

export const KIND_META: Record<EntryKind, KindMeta> = {
  class: {
    label: "Class",
    plural: "Classes",
    icon: GraduationCap,
    defaultColor: "#6366F1",
    description: "Lectures, labs, tutorials and other course sessions.",
  },
  work: {
    label: "Work",
    plural: "Work",
    icon: Briefcase,
    defaultColor: "#F59E0B",
    description: "Meetings, shifts, deep-work blocks and deadlines.",
  },
  personal: {
    label: "Personal",
    plural: "Personal",
    icon: Heart,
    defaultColor: "#EC4899",
    description: "Appointments, workouts, errands and time for yourself.",
  },
  other: {
    label: "Other",
    plural: "Other",
    icon: Sparkles,
    defaultColor: "#06B6D4",
    description: "Anything that does not fit the other buckets.",
  },
};

/**
 * Resolve an entry's kind defensively — the field is optional in responses
 * and older data (or a stray server value) must never break rendering.
 */
export function kindOf(entry: { kind?: EntryKind | null } | null | undefined): EntryKind {
  const kind = entry?.kind as string | null | undefined;
  if (kind && Object.prototype.hasOwnProperty.call(KIND_META, kind)) {
    return kind as EntryKind;
  }
  return "class";
}
