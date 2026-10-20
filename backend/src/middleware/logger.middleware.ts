// Named import: pino-http ships a CJS package whose .d.ts uses `export default`,
// which NodeNext resolves to the module namespace (uncallable) for a default
// import. The named export is the callable function and works at runtime too.
import { pinoHttp } from "pino-http";
import { env, isTest } from "../config/env.js";

/**
 * One-line JSON request logging (method, url, status, response time, req id).
 * Disabled under NODE_ENV=test so the smoke suite output stays readable.
 */
export const httpLogger = pinoHttp({
  level: isTest ? "silent" : "info",
  autoLogging: isTest ? false : { ignore: (req) => req.url === "/api/health" },
  genReqId: () => Math.random().toString(36).slice(2, 10),
  customProps: () => ({ app: "scheduleai", env: env.NODE_ENV }),
});
