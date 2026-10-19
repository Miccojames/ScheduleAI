import { Router } from "express";
import * as uploadController from "../controllers/upload.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { uploadImage } from "../middleware/upload.middleware.js";
import { uploadLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

// Everything upload-related requires auth; upload+process are rate-limited
// 20/hour per user/IP.
router.post("/", requireAuth, uploadLimiter, uploadImage.single("image"), uploadController.upload);
router.get("/:id/image", requireAuth, uploadController.serveImage);
router.post("/:id/process", requireAuth, uploadLimiter, uploadController.processUpload);

export default router;
