/**
 * src/hooks/useAIChat.ts
 * ──────────────────────
 * Reusable chat hook for MentorChat and ReviewExam AI drawer.
 *
 * Thresholds & limits:
 * - MAX_MESSAGES: 40 total messages per session before showing a reset nudge
 * - CONTEXT_WINDOW: only the last 12 messages are sent to the API on each
 *   request (keeps token usage low and responses focused)
 * - localStorage: persists last 40 messages, trimmed on save
 */

import { useCallback, useRef, useState } from "react";
import { streamAI, type GeminiMessage } from "../lib/ai";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  isStreaming?: boolean;
}

interface UseAIChatOptions {
  systemPrompt?: string;
  storageKey?: string;
}

// ── Thresholds ────────────────────────────────────────────────────────────────
/** Hard cap: show a "start new conversation" nudge at this many messages */
const MAX_MESSAGES = 40;

/**
 * Sliding context window: only send the last N messages to the API.
 * Keeps each request under ~2k tokens regardless of conversation length.
 * The system prompt always provides the student's profile context.
 */
const CONTEXT_WINDOW = 12;

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadHistory(key?: string): ChatMessage[] {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(key: string, messages: ChatMessage[]) {
  try {
    localStorage.setItem(key, JSON.stringify(messages.slice(-MAX_MESSAGES)));
  } catch {
    /* storage full — ignore */
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAIChat(options: UseAIChatOptions = {}) {
  const { systemPrompt, storageKey } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    loadHistory(storageKey),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);

  const streamingIdRef = useRef<string | null>(null);
  const abortRef = useRef(false);

  /** True when the conversation has hit the soft cap */
  const isNearLimit =
    messages.filter((m) => !m.isStreaming).length >= MAX_MESSAGES - 4;
  const isAtLimit =
    messages.filter((m) => !m.isStreaming).length >= MAX_MESSAGES;

  /**
   * Convert ChatMessage[] → Gemini format.
   * Only takes the last CONTEXT_WINDOW messages so we don't blow the token budget.
   * Streaming placeholders (empty AI messages) are excluded.
   */
  const toGeminiHistory = useCallback(
    (msgs: ChatMessage[]): GeminiMessage[] => {
      const completed = msgs.filter((m) => !m.isStreaming && m.content.trim());
      // Slide: take only the last CONTEXT_WINDOW messages
      const windowed = completed.slice(-CONTEXT_WINDOW);
      return windowed.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string, prependContext?: string) => {
      if (!text.trim() || isLoading || isAtLimit) return;

      setError(null);
      setLastFailedMessage(null);
      abortRef.current = false;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => {
        const next = [...prev, userMsg];
        if (storageKey) saveHistory(storageKey, next);
        return next;
      });

      const aiId = `a-${Date.now()}`;
      streamingIdRef.current = aiId;

      const aiPlaceholder: ChatMessage = {
        id: aiId,
        role: "ai",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, aiPlaceholder]);
      setIsLoading(true);

      // Build windowed history for the API call
      const historyForApi = toGeminiHistory([...messages, userMsg]);

      // Inject question context into the last user message if provided
      if (prependContext && historyForApi.length > 0) {
        const last = historyForApi[historyForApi.length - 1];
        last.parts[0].text = `${prependContext}\n\nUser question: ${last.parts[0].text}`;
      }

      let accumulated = "";

      await streamAI(
        historyForApi,
        // onChunk
        (delta) => {
          if (abortRef.current) return;
          accumulated += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiId
                ? { ...m, content: accumulated, isStreaming: true }
                : m,
            ),
          );
        },
        // onDone
        () => {
          streamingIdRef.current = null;
          setIsLoading(false);
          setMessages((prev) => {
            const next = prev.map((m) =>
              m.id === aiId
                ? {
                    ...m,
                    content: accumulated || "No response received.",
                    isStreaming: false,
                  }
                : m,
            );
            if (storageKey) saveHistory(storageKey, next);
            return next;
          });
        },
        // onError
        (err) => {
          console.error("AI chat send error:", err);
          streamingIdRef.current = null;
          setIsLoading(false);
          setError("Something went wrong with the AI response. Please try again.");
          setLastFailedMessage(text.trim());
          // Remove the failed AI placeholder message
          setMessages((prev) => prev.filter((m) => m.id !== aiId));
        },
        systemPrompt,
      );
    },
    [isLoading, isAtLimit, messages, systemPrompt, storageKey, toGeminiHistory],
  );

  const retryLastMessage = useCallback(() => {
    if (lastFailedMessage) {
      sendMessage(lastFailedMessage);
      setLastFailedMessage(null);
      setError(null);
    }
  }, [lastFailedMessage, sendMessage]);

  const clearHistory = useCallback(() => {
    abortRef.current = true;
    setMessages([]);
    setError(null);
    setLastFailedMessage(null);
    setIsLoading(false);
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    setMessages,
    retryLastMessage,
    /** Show a soft warning when approaching the limit */
    isNearLimit,
    /** Input should be disabled when at the hard limit */
    isAtLimit,
    /** How many messages remain before the hard cap */
    messagesRemaining: Math.max(
      0,
      MAX_MESSAGES - messages.filter((m) => !m.isStreaming).length,
    ),
  };
}
