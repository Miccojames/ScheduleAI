import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request } from "express";
import { env } from "../config/env.js";
import { extensionForMime, isAllowedMime } from "../validators/upload.js";

// Resolve and create the upload directory at boot so diskStorage never fails
// on the first request.
export const uploadRoot = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    // crypto.randomUUID() filename + an extension derived from the (already
    // validated) mimetype — never trust the client's filename.
    const ext = extensionForMime(file.mimetype as Parameters<typeof extensionForMime>[0]);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  if (!isAllowedMime(file.mimetype)) {
    // 415 Unsupported Media Type
    cb(Object.assign(new Error("Unsupported file type"), { code: "UNSUPPORTED_MEDIA_TYPE" }));
    return;
  }
  cb(null, true);
}

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB — multer throws LIMIT_FILE_SIZE → mapped to 413
    files: 1,
    fields: 5,
  },
});
