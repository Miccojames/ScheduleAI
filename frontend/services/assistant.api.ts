import { api } from "@/services/api";

/** One persisted chat row (server returns newest-last lists). */
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

/** Response of one assistant turn. */
export interface ChatOutcome {
  reply: string;
  /** True when the assistant created/updated/deleted something. */
  changedSchedule: boolean;
  provider: "gemini" | "mock";
}

export const assistantKeys = {
  all: ["assistant"] as const,
  messages: () => [...assistantKeys.all, "messages"] as const,
};

export const assistantApi = {
  listMessages() {
    return api<{ messages: ChatMessage[] }>("/api/assistant/messages");
  },

  chat(message: string) {
    return api<ChatOutcome>("/api/assistant/chat", {
      method: "POST",
      body: { message },
    });
  },

  clearMessages() {
    return api<null>("/api/assistant/messages", { method: "DELETE" });
  },
};
