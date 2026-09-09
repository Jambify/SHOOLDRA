import React, { useState } from "react";
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "../../lib/utils/utils";
import { askAI } from "../../lib/ai";
import type { Question } from "../../Types";
import { ExplanationText } from "../shared/ExplanationText";

interface QuestionAIExplanationProps {
  question: Question;
  userAnswer: number | -1;
  compact?: boolean;
  autoExpandOnWrong?: boolean;
  className?: string;
}

const QuestionAIExplanation: React.FC<QuestionAIExplanationProps> = ({
  question,
  userAnswer,
  compact = false,
  autoExpandOnWrong = false,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(
    autoExpandOnWrong && userAnswer !== -1 && userAnswer !== question.answer,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const isCorrect = userAnswer === question.answer;
  const skipped = userAnswer === -1;

  const handleOpenAndFetch = async () => {
    const newOpen = !isOpen;
    setIsOpen(newOpen);

    if (newOpen && !aiExplanation && !isLoading) {
      setIsLoading(true);
      setError(null);

      const userAnswerText =
        userAnswer !== -1 && question.options[userAnswer]
          ? question.options[userAnswer]
          : "(not answered / skipped)";
      const correctAnswerText = question.options[question.answer];

      const prompt = `You are Schooldra AI, an expert JAMB exam preparation tutor. Analyze this JAMB question and give the user a targeted breakdown.

SUBJECT: ${question.subject || "Unknown"}
TOPIC: ${question.topic || "General"}

QUESTION:
"${question.text}"

OPTIONS:
${question.options
  .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
  .join("\n")}

USER'S ANSWER: ${
        skipped
          ? "SKIPPED (no answer selected)"
          : `${String.fromCharCode(65 + userAnswer)}. ${userAnswerText}`
      }
CORRECT ANSWER: ${String.fromCharCode(65 + question.answer)}. ${correctAnswerText}

Format your response in exactly 3 clear sections using this exact structure and section headers (no markdown, no bold, no bullets except the sections listed):

1. WHY YOUR ANSWER WAS WRONG (or "CORRECT ANSWER CONFIRMATION" if they answered correctly):
${
  isCorrect
    ? "Confirm why their choice is correct in under 3 sentences."
    : skipped
      ? "Explain why skipping this question was a missed opportunity, what the answer is, and why it's right."
      : "Explain specifically why the user's chosen answer is incorrect. What mistake or misconception might they have had? Point out the flaw in their option clearly, in 3 sentences max."
}

2. WHY THE CORRECT ANSWER IS RIGHT:
Explain why ${String.fromCharCode(
        65 + question.answer,
      )}. ${correctAnswerText} is the correct choice. Be specific — reference the question, any relevant JAMB patterns, and break down the logic step by step in 3-4 short sentences.

3. WHY THE OTHER OPTIONS ARE INCORRECT:
For each of the remaining wrong options (NOT the user's answer and NOT the correct answer), give a 1-sentence reason why it's wrong. Be concise.

Keep the entire response under 220 words total. Use plain language suitable for a secondary school student. Never use markdown formatting, no asterisks, no backticks, no dashes for bullets.`;

      try {
        const result = await askAI([
          { role: "user", parts: [{ text: prompt }] },
        ]);
        setAiExplanation(result);
      } catch (err) {
        console.error("Failed to get AI explanation:", err);
        setError("Failed to generate explanation. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className={cn(className)}>
      <button
        onClick={handleOpenAndFetch}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold tracking-tight uppercase transition-all active:scale-[0.99]",
          compact ? "px-3 py-2 text-[10px]" : "px-4 py-2.5",
          isCorrect
            ? "bg-success/10 text-success hover:bg-success/15 border-success/20 border"
            : skipped
              ? "bg-brand/10 text-brand hover:bg-brand/15 border-brand/20 border"
              : "bg-danger/10 text-danger hover:bg-danger/15 border-danger/20 border",
        )}
      >
        <span className="flex items-center gap-2">
          <Sparkles
            size={compact ? 12 : 14}
            className={isLoading ? "animate-spin" : ""}
          />
          {isCorrect
            ? "AI: Learn why it's correct"
            : skipped
              ? "AI: Get explanation"
              : "AI: See why you got it wrong"}
        </span>
        {isOpen ? (
          <ChevronUp size={compact ? 12 : 14} />
        ) : (
          <ChevronDown size={compact ? 12 : 14} />
        )}
      </button>

      {isOpen && (
        <div
          className={cn(
            "mt-2 overflow-hidden rounded-xl border p-3 md:p-4",
            isCorrect
              ? "border-success/20 bg-success/5"
              : skipped
                ? "border-brand/20 bg-brand/5"
                : "border-danger/20 bg-danger/5",
          )}
        >
          {isLoading && (
            <div className="flex items-center gap-2 py-2 text-[11px]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-textDim">AI is analyzing your answer…</span>
            </div>
          )}

          {error && (
            <div className="text-danger flex items-start gap-2 py-2 text-[11px]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {aiExplanation && (
            <div
              className="text-textMain text-xs leading-relaxed whitespace-pre-wrap md:text-sm"
              style={{ wordBreak: "break-word" }}
            >
              <ExplanationText text={aiExplanation} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionAIExplanation;
