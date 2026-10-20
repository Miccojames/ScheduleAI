import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startJobs } from "./jobs/index.js";

const app = createApp();
startJobs();

const server = app.listen(env.PORT, () => {
  console.log(`✅ ScheduleAI API listening on http://localhost:${env.PORT}`);
  console.log(`   Frontend origin: ${env.FRONTEND_URL}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
});

// Graceful shutdown — close the HTTP server and the Prisma pool.
function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down...`);
  server.close(() => {
    process.exit(0);
  });
  // Hard-exit if something hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
