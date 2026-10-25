import { z } from "zod";

// Assistant chat — one plain-text message per turn. The 2000-char cap keeps a
// single request from flooding the Gemini prompt (history replay multiplies it).
export const chatSchema = z.object({
  message: z
    .string({ error: "Message is required" })
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Messages are limited to 2000 characters"),
});

export type ChatBody = z.infer<typeof chatSchema>;
