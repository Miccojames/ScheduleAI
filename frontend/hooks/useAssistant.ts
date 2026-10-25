"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import {
  assistantApi,
  assistantKeys,
  type ChatMessage,
} from "@/services/assistant.api";
import { scheduleKeys } from "@/services/schedule.api";

/** Stable-enough unique id for optimistic bubbles (real ids arrive on refetch). */
function tempId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Conversation history — fetched only while the panel is open. */
export function useChatMessages(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: assistantKeys.messages(),
    queryFn: async () => (await assistantApi.listMessages()).messages,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Send one turn. The user's bubble appears optimistically; the reply is
 * appended on success. If the AI fails, history is re-synced with the server
 * (the question WAS persisted) and a toast explains what went wrong.
 * When the turn changed the schedule, schedule queries invalidate so the
 * calendar behind the chat updates live.
 */
export function useSendChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (message: string) => assistantApi.chat(message),

    onMutate: async (message) => {
      await queryClient.cancelQueries({ queryKey: assistantKeys.messages() });
      const optimistic: ChatMessage = {
        id: tempId("temp"),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(assistantKeys.messages(), (old = []) => [
        ...old,
        optimistic,
      ]);
    },

    onSuccess: (outcome) => {
      const reply: ChatMessage = {
        id: tempId("temp-reply"),
        role: "assistant",
        content: outcome.reply,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(assistantKeys.messages(), (old = []) => [
        ...old,
        reply,
      ]);
      // Background sync: swaps temp bubbles for the persisted ids and heals
      // the edge where onMutate cancelled the very first history fetch.
      void queryClient.invalidateQueries({ queryKey: assistantKeys.messages() });
      if (outcome.changedSchedule) {
        void queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      }
    },

    onError: (error) => {
      // Server kept the question — pull the authoritative history back in.
      void queryClient.invalidateQueries({ queryKey: assistantKeys.messages() });
      toast.error(apiErrorMessage(error, "The assistant couldn't reply."));
    },
  });
}

export function useClearChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => assistantApi.clearMessages(),
    onSuccess: () => {
      queryClient.setQueryData<ChatMessage[]>(assistantKeys.messages(), []);
      toast.success("Chat cleared.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't clear the chat."));
    },
  });
}
