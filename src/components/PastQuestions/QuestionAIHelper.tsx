// src/components/PastQuestions/QuestionAIHelper.tsx

import React, { useMemo, useState } from "react";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { useAIChat } from "../../hooks/useAIChat";
import type { Question } from "../../Types";
import ValidatedInput from "../ui/ValidatedInput";
import { truncateInput } from "../../lib/validation";
import { ExplanationText } from "../shared/ExplanationText";

interface QuestionAIHelperProps {
  question: Question;
}

const STARTERS = [
  {
    label: "Explain it simpler",
    prompt: "Can you explain the answer to this question in a simpler way?",
  },
  {
    label: "Why is this correct?",
    prompt:
      "Walk me through exactly why this is the correct answer, step by step.",
  },
  {
    label: "Give me a similar question",
    prompt:
      "Give me a similar practice question on the same topic, with a different scenario, so I can test myself.",
  },
];

// Small deterministic string hash (djb2) — just needs to change whenever the
// option order/answer changes, not to be cryptographically anything.
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

const QuestionAIHelper: React.FC<QuestionAIHelperProps> = ({ question }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");

  const systemPrompt = `You are Schooldra AI, helping a student understand ONE specific past JAMB question. Stay focused on this question and its topic — do not give general study advice or change subject.

Question (${question.subject}, ${question.year}, topic: ${question.topic}):
"${question.text}"

Options: ${question.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(" | ")}
Correct answer: ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}
Official explanation: ${question.explanation}

IMPORTANT: The option order above has been randomized specifically for this student's session and will NOT match the order you may have seen this question in during training. Ignore any memorized option lettering for this question — treat the "Correct answer" line above as the single source of truth. Whenever you refer to the correct answer, ALWAYS state both its letter AND its exact value together (e.g. "Option D (2.06 kg)"), never the letter alone, so any mismatch is immediately visible rather than silently wrong.

Be concise, encouraging, and specific to this question. Under 150 words unless asked for more detail.`;

  // FIX: storageKey used to be keyed only by question.id, so a fresh option
  // shuffle for the SAME question (e.g. after a refresh) would silently
  // reload and display the PREVIOUS conversation from localStorage — one
  // that was talking about the old option lettering. Folding a hash of the
  // current options + answer index into the key means a re-shuffled
  // instance of this question gets its own clean conversation instead of
  // inheriting a now-stale one.
  const storageKey = useMemo(() => {
    const signature = `${question.options.join("|")}::${question.answer}`;
    return `schooldra-pq-helper-${question.id}-${hashString(signature)}`;
  }, [question.id, question.options, question.answer]);

  const { messages, isLoading, sendMessage, isAtLimit } = useAIChat({
    systemPrompt,
    storageKey,
  });

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage(text.trim());
    setInput("");
  };

  return (
    <div className="border-borderMuted mt-3 border-t pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-brand-light flex items-center gap-1.5 text-xs font-semibold"
      >
        <Sparkles size={14} />
        Ask AI about this question
        <ChevronDown
          size={14}
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="mt-2.5 space-y-2.5">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSend(s.prompt)}
                  className="bg-bgSurface border-borderMuted text-textDim hover:text-textMain hover:border-brand/40 rounded-full border px-3 py-1.5 text-xs transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-brand/10 text-textMain ml-6"
                  : "bg-bgSurface border-borderMuted text-textMain mr-6 border"
              }`}
            >
              {msg.content ? (
                <ExplanationText text={msg.content} />
              ) : msg.isStreaming ? (
                // FIX: this used to render a static "…" while the AI
                // placeholder had no content yet — the exact moment the
                // user is waiting on a response. isLoading's own spinner
                // block below never actually fires for that window (the
                // placeholder is added in the same synchronous batch as
                // isLoading flips true, so it's always the last message
                // and role === "ai" by the time we render), so this was
                // the only visible feedback during the wait — and it
                // didn't animate. Replaced with a real spinner.
                <span className="text-textDim inline-flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Thinking…
                </span>
              ) : (
                ""
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <ValidatedInput
              value={input}
              onChange={(v) => setInput(truncateInput(v, 500))}
              onKeyDown={(e: any) => e.key === "Enter" && handleSend(input)}
              placeholder={
                isAtLimit ? "Session limit reached" : "Ask a follow-up…"
              }
              readOnly={isLoading || isAtLimit}
              className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/30 flex-1 rounded-lg border px-3 py-1.5 text-xs focus:ring-2 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isLoading || isAtLimit}
              className="bg-brand hover:bg-brand-light rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionAIHelper;