"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Loader2, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatMessages, useClearChat, useSendChat } from "@/hooks/useAssistant";
import { useMe } from "@/hooks/useAuth";
import type { ChatMessage } from "@/services/assistant.api";
import { cn } from "cn";

/** Tap-to-ask starters shown with the welcome bubble. */
const SUGGESTIONS = [
  "What's on my Thursday?",
  "Add gym every Tuesday 6–7pm",
  "When am I free this week?",
] as const;

function WelcomeBubble({ firstName }: { firstName?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl rounded-bl-md bg-muted px-3.5 py-3 text-sm whitespace-pre-wrap">
      <span>
        Hi{firstName ? ` ${firstName}` : ""}! 👋 I&apos;m your ScheduleAI assistant.
      </span>
      <span className="text-muted-foreground">
        Ask me about your week, or just tell me what to add — like &ldquo;add gym every
        Tuesday 6pm&rdquo;.
      </span>
    </div>
  );
}

function TypingBubble() {
  return (
    <div
      className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3.5"
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "max-w-[85%] px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words",
        isUser
          ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
          : "rounded-2xl rounded-bl-md bg-muted text-foreground",
      )}
    >
      {message.content}
    </div>
  );
}

/**
 * Floating assistant: a corner FAB on every signed-in page that opens a chat
 * panel (full-width sheet on phones, corner card on larger screens).
 * Mounted once by AppShell — hidden on landing/auth screens by construction.
 */
export function AssistantDock() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { data: user } = useMe();
  const { data: messages = [], isPending: historyPending } = useChatMessages({
    enabled: open,
  });
  const send = useSendChat();
  const clear = useClearChat();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view whenever the conversation grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, send.isPending]);

  function handleSend(text?: string) {
    const message = (text ?? input).trim();
    if (!message || send.isPending) return;
    setInput("");
    send.mutate(message);
    textareaRef.current?.focus();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    handleSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  const showWelcome = !historyPending && messages.length === 0 && !send.isPending;

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="ScheduleAI assistant"
          className="fixed inset-x-3 top-16 bottom-24 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:h-[34rem] sm:w-96 sm:max-h-[calc(100dvh-6rem)]"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">ScheduleAI Assistant</p>
              <p className="text-xs text-muted-foreground">
                {send.isPending ? "Thinking…" : "Ask about your week"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear chat history"
              disabled={clear.isPending || messages.length === 0}
              onClick={() => clear.mutate()}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {showWelcome ? (
              <WelcomeBubble firstName={user?.firstName} />
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}

            {showWelcome && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={send.isPending}
                    onClick={() => handleSend(suggestion)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {send.isPending && <TypingBubble />}
          </div>

          {/* Composer */}
          <form
            onSubmit={handleSubmit}
            className="flex shrink-0 items-end gap-2 border-t border-border bg-background/60 px-3 py-3"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              maxLength={2000}
              placeholder="Ask about your schedule…"
              aria-label="Message the assistant"
              className="max-h-28 min-h-9 flex-1 resize-none"
            />
            <Button
              type="submit"
              size="icon-sm"
              aria-label="Send message"
              disabled={!input.trim() || send.isPending}
            >
              {send.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Floating action button — sits above the mobile bottom nav. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open the ScheduleAI assistant"
          className={cn(
            "fixed right-4 bottom-20 z-50 flex size-14 items-center justify-center rounded-full text-primary-foreground shadow-xl transition-transform hover:scale-105 active:scale-95 md:bottom-6",
            "bg-primary hover:bg-primary/90",
          )}
        >
          <Sparkles className="size-6" aria-hidden="true" />
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30 [animation-duration:2.5s]" />
        </button>
      )}
    </>
  );
}
