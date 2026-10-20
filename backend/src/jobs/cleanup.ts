// Upload housekeeping: prunes dead rows (and their images) plus orphaned image
// files on disk. Started from jobs/index.ts — never runs in tests.
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const uploadRoot = path.resolve(env.UPLOAD_DIR);

/** Unlink, treating "already gone" as success. Returns true if removed. */
async function unlinkQuiet(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(`[cleanup] could not delete ${filePath}:`, err);
    }
    return false;
  }
}

/** Never unlink outside the upload directory, whatever the row claims. */
function insideUploadRoot(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  const rel = path.relative(uploadRoot, resolved);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** Rows stuck PENDING/FAILED for >7 days: remove the image, then the row. */
async function purgeStaleUploads(): Promise<void> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const stale = await prisma.uploadedSchedule.findMany({
    where: {
      createdAt: { lt: cutoff },
      processingStatus: { in: ["FAILED", "PENDING"] },
    },
    select: { id: true, imagePath: true },
  });
  if (stale.length === 0) return;

  for (const row of stale) {
    if (insideUploadRoot(row.imagePath)) await unlinkQuiet(path.resolve(row.imagePath));
  }
  await prisma.uploadedSchedule.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
  console.log(`[cleanup] pruned ${stale.length} stale upload row(s) (PENDING/FAILED > 7 days).`);
}

/** Image files in UPLOAD_DIR older than 30 days that no row references. */
async function purgeOrphanImages(): Promise<void> {
  const referenced = new Set(
    (
      await prisma.uploadedSchedule.findMany({ select: { imagePath: true } })
    ).map((row) => path.resolve(row.imagePath))
  );

  const dirents = await fs.readdir(uploadRoot, { withFileTypes: true }).catch((err) => {
    console.warn(`[cleanup] could not read ${uploadRoot}:`, err);
    return [] as import("node:fs").Dirent[];
  });

  const cutoff = Date.now() - THIRTY_DAYS_MS;
  let removed = 0;
  for (const dirent of dirents) {
    if (!dirent.isFile()) continue;
    const fullPath = path.join(uploadRoot, dirent.name);
    if (referenced.has(fullPath)) continue;
    const stat = await fs.stat(fullPath).catch(() => null);
    if (!stat || stat.mtimeMs >= cutoff) continue;
    if (await unlinkQuiet(fullPath)) removed += 1;
  }
  if (removed > 0) console.log(`[cleanup] removed ${removed} orphaned image file(s).`);
}

/** One cleanup pass — every step is guarded so the timer can never throw. */
export async function cleanupTick(): Promise<void> {
  try {
    await purgeStaleUploads();
  } catch (err) {
    console.warn("[cleanup] stale-upload pass failed:", err);
  }
  try {
    await purgeOrphanImages();
  } catch (err) {
    console.warn("[cleanup] orphan-image pass failed:", err);
  }
}

/** Registers the 6h interval (unref'd so it never holds the process open). */
export function startCleanupJob(): void {
  const timer = setInterval(() => {
    void cleanupTick();
  }, SIX_HOURS_MS);
  timer.unref();
  console.log("[jobs] upload cleanup scheduled every 6h.");
}
