/** Initials for the avatar bubble, e.g. "Ang Tamayo" → "AT". */
export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "S";
}
