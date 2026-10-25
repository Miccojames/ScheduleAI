import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env, isTest } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { globalLimiter } from "./middleware/rateLimit.middleware.js";
import { originCheck } from "./middleware/origin.middleware.js";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware.js";
import { httpLogger } from "./middleware/logger.middleware.js";
import authRoutes from "./routes/auth.route.js";
import scheduleRoutes from "./routes/schedule.route.js";
import uploadRoutes from "./routes/upload.route.js";
import notificationRoutes from "./routes/notification.route.js";
import assistantRoutes from "./routes/assistant.route.js";

export function createApp(): express.Express {
  const app = express();

  // Behind a proxy (Render) — needed for correct IPs in rate limiting.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(httpLogger);

  // CORS: exact frontend origin only, credentials (cookies) allowed. Never "*".
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());

  // CSRF defense layer #2 (after SameSite): state-changing requests must come
  // from the configured frontend origin when an Origin header is present.
  app.use(originCheck);

  // Global rate limit (skipped under NODE_ENV=test so smoke tests don't trip it).
  if (!isTest) {
    app.use(globalLimiter);
  }

  // Health endpoint: liveness + DB connectivity (used by uptime monitors).
  app.get("/api/health", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ success: true, data: { status: "ok", database: "up" } });
    } catch {
      res.status(503).json({ success: false, message: "Database unreachable." });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/schedules", scheduleRoutes);
  app.use("/api/schedule-upload", uploadRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/assistant", assistantRoutes);

  // 404 + central error handler last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
