import { Router } from "express";
import * as assistantController from "../controllers/assistant.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { assistantLimiter } from "../middleware/rateLimit.middleware.js";
import { chatSchema } from "../validators/assistant.js";

const router = Router();

// Signed-in only — history and chat are strictly per-user.
router.use(requireAuth);

router.get("/messages", assistantController.messages);
router.delete("/messages", assistantController.clear);

// Chat gets its OWN budget (see rateLimit.middleware.ts): one message can
// cost several upstream Gemini calls, and the free tier is tight. Kept off
// authLimiter/verifyLimiter so an chatty assistant can never starve sign-in
// or email verification.
router.post("/chat", assistantLimiter, validate(chatSchema), assistantController.chat);

export default router;
