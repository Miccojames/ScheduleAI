// Upload validation is enforced in middleware (multer limits + magic-byte
// sniffing), so this module only holds the shared constants.
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB (Vercel's proxy caps request bodies at 4.5MB)

export type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export function extensionForMime(mime: AllowedMime): string {
  return EXTENSION_BY_MIME[mime];
}

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);
}

/**
 * Magic-byte sniffing — the declared mimetype can lie, so we verify the file
 * actually starts with the right signature:
 *   JPEG: FF D8 FF
 *   PNG:  89 50 4E 47
 *   WEBP: RIFF....WEBP (bytes 0-3 "RIFF", bytes 8-11 "WEBP")
 */
export function sniffImageType(buffer: Buffer): AllowedMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
