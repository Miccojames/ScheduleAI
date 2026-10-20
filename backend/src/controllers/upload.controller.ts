import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { param } from "../utils/params.js";
import { NotFoundError, UnprocessableEntityError } from "../utils/errors.js";
import { prisma } from "../config/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { allowMockFallback } from "../config/env.js";
import { uploadRoot } from "../middleware/upload.middleware.js";
import { getAnalyzer, AiProviderError } from "../services/ai.service.js";
import { MockProvider } from "../services/ocr/mock.provider.js";
import { parseAnalyzeResult } from "../services/scheduleParser.service.js";
import type { ProviderName } from "../services/ocr/types.js";
import { sniffImageType, MAX_FILE_SIZE, isAllowedMime } from "../validators/upload.js";

// POST /api/schedule-upload — multipart upload, field name `image`.
// The multer middleware already limited size/type and wrote the file to disk
// with a UUID name; here we sniff magic bytes, persist the DB row, respond 201.
export const upload = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new UnprocessableEntityError("Please attach a schedule image (field name: image).");
  }
  if (file.size === 0) {
    fs.rmSync(file.path, { force: true });
    throw new UnprocessableEntityError("The uploaded file is empty.");
  }
  if (file.size > MAX_FILE_SIZE) {
    fs.rmSync(file.path, { force: true });
    sendError(res, { status: 413, message: "File is too large. The maximum size is 4MB." });
    return;
  }
  if (!isAllowedMime(file.mimetype)) {
    fs.rmSync(file.path, { force: true });
    sendError(res, {
      status: 415,
      message: "Unsupported file type. Please upload a JPEG, PNG, or WebP image.",
    });
    return;
  }

  // The declared mimetype can lie — verify the actual bytes.
  const fd = fs.openSync(file.path, "r");
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);
  const sniffed = sniffImageType(header);
  if (!sniffed) {
    fs.rmSync(file.path, { force: true });
    sendError(res, {
      status: 415,
      message: "This file doesn't look like a valid image. Please upload a JPEG, PNG, or WebP.",
    });
    return;
  }

  const record = await prisma.uploadedSchedule.create({
    data: {
      userId: req.user!.id,
      imagePath: file.path,
      fileName: file.originalname || "schedule-image",
      fileSize: file.size,
      processingStatus: "PENDING",
    },
  });

  sendSuccess(res, {
    status: 201,
    data: {
      upload: {
        id: record.id,
        status: record.processingStatus,
        imageUrl: `/api/schedule-upload/${record.id}/image`,
        fileName: record.fileName,
        fileSize: record.fileSize,
      },
    },
    message: "Image uploaded. Process it to detect your classes.",
  });
});

// GET /api/schedule-upload — the user's upload history, newest first.
export const list = asyncHandler(async (req: Request, res: Response) => {
  const uploads = await prisma.uploadedSchedule.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      processingStatus: true,
      error: true,
      scheduleId: true,
      createdAt: true,
    },
  });
  sendSuccess(res, { data: { uploads } });
});

// DELETE /api/schedule-upload/:id — 404 for other users' uploads; deletes the
// stored image file first (missing file is fine), then the DB row.
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.uploadedSchedule.findFirst({
    where: { id: param(req, "id"), userId: req.user!.id },
  });
  if (!record) throw new NotFoundError("Upload not found.");

  try {
    fs.rmSync(record.imagePath, { force: true });
  } catch (err) {
    // force:true already swallows ENOENT — anything else is logged, not fatal.
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(`[uploads] could not remove file ${record.imagePath}: ${String(err)}`);
    }
  }

  await prisma.uploadedSchedule.delete({ where: { id: record.id } });
  sendSuccess(res, { data: null, message: "Upload deleted." });
});

// GET /api/schedule-upload/:id/image — owner-checked file stream.
export const serveImage = asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.uploadedSchedule.findFirst({
    where: { id: param(req, "id"), userId: req.user!.id },
  });
  if (!record) throw new NotFoundError("Upload not found.");

  // Defense in depth: resolve inside the upload dir and confirm the file is there.
  const resolved = path.resolve(record.imagePath);
  if (!resolved.startsWith(uploadRoot) || !fs.existsSync(resolved)) {
    throw new NotFoundError("Image file not found on server.");
  }

  // Content-Type from the sniffed extension (stored at upload time).
  const ext = path.extname(resolved).toLowerCase();
  const contentType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  fs.createReadStream(resolved).pipe(res);
});

// Upload ids whose background extraction is currently running IN THIS
// PROCESS. Guards against double-kicks racing on the same row (the DB
// PROCESSING status alone can't see "am I the one running it?").
const inFlight = new Set<string>();

// POST /api/schedule-upload/:id/process — kicks a BACKGROUND extraction and
// returns 202 immediately. The client polls GET /:id until the status is
// COMPLETED/FAILED. This keeps slow AI calls (free-tier Gemini can take
// 1–4 minutes) off the request path: no HTTP timeouts, and the user can even
// close the tab — the scan finishes server-side either way.
export const processUpload = asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.uploadedSchedule.findFirst({
    where: { id: param(req, "id"), userId: req.user!.id },
  });
  if (!record) throw new NotFoundError("Upload not found.");

  // Idempotent-ish: if a run for this upload is already in flight, don't
  // start a second one — acknowledge and let the client keep polling.
  if (record.processingStatus === "PROCESSING" && inFlight.has(record.id)) {
    sendSuccess(res, {
      status: 202,
      data: { upload: serializeUpload(record) },
      message: "Already scanning — this can take a minute or two.",
    });
    return;
  }

  const updated = await prisma.uploadedSchedule.update({
    where: { id: record.id },
    data: {
      processingStatus: "PROCESSING",
      error: null,
      result: Prisma.DbNull,
      provider: null,
    },
  });

  inFlight.add(updated.id);
  void runExtraction(updated).finally(() => inFlight.delete(updated.id));

  sendSuccess(res, {
    status: 202,
    data: { upload: serializeUpload(updated) },
    message: "Scan started. Poll GET /api/schedule-upload/:id for the result.",
  });
});

// GET /api/schedule-upload/:id — status + (when COMPLETED) the persisted
// extraction result. This is what the frontend polls after the 202 kick.
export const getUpload = asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.uploadedSchedule.findFirst({
    where: { id: param(req, "id"), userId: req.user!.id },
  });
  if (!record) throw new NotFoundError("Upload not found.");

  const stored = record.result as { entries?: unknown[]; fallback?: boolean } | null;
  const completed = record.processingStatus === "COMPLETED";
  const entries = completed && Array.isArray(stored?.entries) ? stored!.entries : [];

  sendSuccess(res, {
    data: {
      upload: {
        ...serializeUpload(record),
        // `error` holds the SAFE client-facing message (the internal detail
        // lives in the server logs), so the UI can show it directly.
        error: record.error,
      },
      provider: completed ? ((record.provider as ProviderName) ?? "gemini") : null,
      fallback: completed ? (stored?.fallback ?? false) : false,
      entries,
      ...(entries.length === 0 && completed
        ? { message: "No classes were detected in this image." }
        : {}),
    },
  });
});

/**
 * The actual extraction work, run detached from any HTTP request. Writes
 * COMPLETED (+ result JSON + provider) or FAILED (+ safe error message) to
 * the row; the poller picks it up from there. The mock fallback logic is
 * unchanged (quota/busy/timeout/malformed → per-request demo data, gated by
 * allowMockFallback).
 */
async function runExtraction(record: {
  id: string;
  imagePath: string;
}): Promise<void> {
  const analyzeInput = {
    filePath: record.imagePath,
    mimeType: sniffMimeFromPath(record.imagePath) ?? "image/png",
  };

  try {
    const analyzer = getAnalyzer();
    const result = await analyzer.analyze(analyzeInput);
    const entries = parseAnalyzeResult(result); // pure transformation

    await prisma.uploadedSchedule.update({
      where: { id: record.id },
      data: {
        processingStatus: "COMPLETED",
        error: null,
        provider: analyzer.name,
        // Cast: DetectedEntry is structurally JSON-safe (strings/numbers/
        // nulls) but TS interfaces don't satisfy Prisma's InputJsonValue
        // index-signature requirement without it.
        result: { entries, fallback: false } as unknown as Prisma.InputJsonValue,
      },
    });
    console.log(
      `[extract] upload=${record.id} completed provider=${analyzer.name} entries=${entries.length}`,
    );
    return;
  } catch (err) {
    // Transient upstream failure (quota exhausted, demand-spike 503/504, or
    // malformed/truncated output) → per-request demo fallback, gated by
    // allowMockFallback (dev: on; prod: off unless AI_ALLOW_MOCK_FALLBACK).
    if (
      err instanceof AiProviderError &&
      (err.code === "quota" ||
        err.code === "busy" ||
        err.code === "timeout" ||
        err.code === "malformed") &&
      allowMockFallback
    ) {
      try {
        const fallback = new MockProvider();
        const fallbackResult = await fallback.analyze(analyzeInput);
        const fallbackEntries = parseAnalyzeResult(fallbackResult);

        await prisma.uploadedSchedule.update({
          where: { id: record.id },
          data: {
            processingStatus: "COMPLETED",
            error: null,
            provider: fallback.name,
            result: { entries: fallbackEntries, fallback: true } as unknown as Prisma.InputJsonValue,
          },
        });

        const reason =
          err.code === "quota"
            ? "quota exceeded"
            : err.code === "busy"
              ? "unavailable (503/504)"
              : err.code === "malformed"
                ? "returned malformed output"
                : "timed out";
        console.warn(
          `[fallback] upload=${record.id} AI provider ${reason} — served DEMO fallback result (entries=${fallbackEntries.length})`,
        );
        return;
      } catch (fallbackErr) {
        // Mock also failed → fall through to the FAILED write below, keeping
        // the ORIGINAL provider error.
        console.error(
          `[fallback] upload=${record.id} mock fallback failed: ${String(fallbackErr)}`,
        );
      }
    }

    const internal = err instanceof AiProviderError ? err.message : String(err);
    console.error(`[extract] upload=${record.id} failed: ${internal}`);
    const safeMessage =
      err instanceof AiProviderError && err.userMessage
        ? err.userMessage
        : "We couldn't analyze this schedule. Please try again with a clearer image.";
    await prisma.uploadedSchedule
      .update({
        where: { id: record.id },
        data: {
          processingStatus: "FAILED",
          error: safeMessage.slice(0, 500),
          provider: null,
          result: Prisma.DbNull,
        },
      })
      .catch((writeErr) => {
        console.error(`[extract] upload=${record.id} FAILED write error: ${String(writeErr)}`);
      });
  }
}

function serializeUpload(record: {
  id: string;
  processingStatus: string;
  fileName: string;
  fileSize: number;
}) {
  return {
    id: record.id,
    status: record.processingStatus,
    imageUrl: `/api/schedule-upload/${record.id}/image`,
    fileName: record.fileName,
    fileSize: record.fileSize,
  };
}

function sniffMimeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return null;
}
