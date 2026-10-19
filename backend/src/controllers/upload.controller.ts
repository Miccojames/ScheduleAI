import type { Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { param } from "../utils/params.js";
import { NotFoundError, UnprocessableEntityError } from "../utils/errors.js";
import { prisma } from "../config/prisma.js";
import { uploadRoot } from "../middleware/upload.middleware.js";
import { getAnalyzer, AiProviderError } from "../services/ai.service.js";
import { parseAnalyzeResult } from "../services/scheduleParser.service.js";
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
    sendError(res, { status: 413, message: "File is too large. The maximum size is 8MB." });
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

// POST /api/schedule-upload/:id/process — run OCR on a previously uploaded image.
export const processUpload = asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.uploadedSchedule.findFirst({
    where: { id: param(req, "id"), userId: req.user!.id },
  });
  if (!record) throw new NotFoundError("Upload not found.");

  await prisma.uploadedSchedule.update({
    where: { id: record.id },
    data: { processingStatus: "PROCESSING", error: null },
  });

  try {
    const analyzer = getAnalyzer();
    const result = await analyzer.analyze({
      filePath: record.imagePath,
      mimeType: sniffMimeFromPath(record.imagePath) ?? "image/png",
    });
    // Pure transformation — no DB writes in the AI path.
    const entries = parseAnalyzeResult(result);

    await prisma.uploadedSchedule.update({
      where: { id: record.id },
      data: { processingStatus: "COMPLETED", error: null },
    });

    sendSuccess(res, {
      data: {
        upload: {
          id: record.id,
          status: "COMPLETED",
          imageUrl: `/api/schedule-upload/${record.id}/image`,
          fileName: record.fileName,
          fileSize: record.fileSize,
        },
        provider: analyzer.name,
        entries,
        ...(entries.length === 0
          ? { message: "No classes were detected in this image." }
          : {}),
      },
      message:
        entries.length === 0
          ? "No classes were detected in this image."
          : `Found ${entries.length} ${entries.length === 1 ? "class" : "classes"}. Review them before saving.`,
    });
  } catch (err) {
    const reason = err instanceof AiProviderError ? err.message : String(err);
    await prisma.uploadedSchedule.update({
      where: { id: record.id },
      data: { processingStatus: "FAILED", error: reason.slice(0, 500) },
    });
    sendError(res, {
      status: 502,
      message: "We couldn't analyze this schedule. Please try again with a clearer image.",
    });
  }
});

function sniffMimeFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return null;
}
