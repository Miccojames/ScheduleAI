// Fixed 8-color palette. Deterministic per subject so the same class always
// gets the same color across schedules.
export const PALETTE = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#EF4444",
] as const;

/** Simple stable string hash (djb2-ish). */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorForSubject(subject: string): string {
  return PALETTE[hashString(subject.trim().toLowerCase()) % PALETTE.length];
}
