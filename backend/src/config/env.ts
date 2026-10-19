import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Fail fast at boot: every required variable must be present and sane.
// This runs once, before the app is assembled, so misconfiguration never
// reaches a request handler.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required (postgresql://user:pass@host:port/db)")
      .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
        message: "DATABASE_URL must be a postgresql:// connection string",
      }),
    JWT_SECRET: z
      .string()
      .min(1, "JWT_SECRET is required")
      .refine((v) => v !== "change-me-in-production" || process.env.NODE_ENV !== "production", {
        message: "JWT_SECRET must be changed in production",
      }),
    FRONTEND_URL: z
      .string()
      .min(1)
      .url("FRONTEND_URL must be a valid URL")
      .default("http://localhost:3000"),
    // Optional: free Gemini key from https://aistudio.google.com/apikey.
    // When empty the MOCK OCR provider is used (dev/demo mode).
    GEMINI_API_KEY: z.string().optional().default(""),
    // Optional: Gemini vision model override; blank/missing → gemini-3.8-flash.
    GEMINI_MODEL: z
      .string()
      .optional()
      .default("")
      .transform((v) => (v.trim().length > 0 ? v.trim() : "gemini-3.8-flash")),
    UPLOAD_DIR: z.string().min(1).default("./uploads"),
  })
  .superRefine((env, ctx) => {
    // GEMINI_MODEL must be a plain model id (e.g. "gemini-3.8-flash").
    // Catches copy-paste typos like "GEMINI_MODEL=gemini-3.8-flash" at boot
    // with a clear message, instead of a confusing 502 on every upload.
    if (!/^gemini-[a-z0-9.-]+$/i.test(env.GEMINI_MODEL)) {
      ctx.addIssue({
        code: "custom",
        path: ["GEMINI_MODEL"],
        message: `GEMINI_MODEL must look like "gemini-3.8-flash" (got "${env.GEMINI_MODEL}") — remove any duplicated "GEMINI_MODEL=" prefix or trailing spaces.`,
      });
    }
    // In production, JWT_SECRET must not be the example value.
    if (env.NODE_ENV === "production" && env.JWT_SECRET === "change-me-in-production") {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message: "JWT_SECRET must be changed in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("\n❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  console.error("\n   Copy .env.example to .env and fill in the values.\n");
  process.exit(1);
}

export const env: Env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
