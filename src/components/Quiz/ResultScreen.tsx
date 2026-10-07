import React, { useEffect, useRef, useState } from "react";
import { useQuizStore } from "../../Store/useQuizStore";
import { useQuizSession } from "../../hooks/useQuizSession";
import Button from "../ui/Button";
import { cn } from "../../lib/utils/utils";
import { useStudyTrackingStore } from "../../Store/useStudyTrackingStore";

import { ExplanationText } from "../../components/shared/ExplanationText";
import {
  Trophy,
  Target,
  BookOpen,
  Dumbbell,
  ArrowLeft,
  BarChart3,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import QuestionAIExplanation from "./QuestionAIExplanation";
import { renderQuestionText } from "../../lib/utils/renderQuestionText";

interface ResultsScreenProps {
  onRetry: () => void;
  onHome: () => void;
  onPerformance: () => void;
}

interface ReviewItemProps {
  question: import("../../Types").Question;
  index: number;
  userAnswer: number | -1;
}

const ReviewItem: React.FC<ReviewItemProps> = ({
  question: q,
  userAnswer: userAns,
}) => {
  const wasCorrect = userAns === q.answer;
  const skipped = userAns === -1;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-borderMuted border-b last:border-b-0">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="hover:bg-bgSurface/30 active:bg-bgSurface/50 flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
      >
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            wasCorrect
              ? "bg-success/15 text-success"
              : skipped
                ? "bg-bgSurface text-textDim"
                : "bg-danger/15 text-danger",
          )}
        >
          {wasCorrect ? "✓" : skipped ? "–" : "✕"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-textMain line-clamp-2 text-xs font-medium md:text-sm">
            {renderQuestionText(q.text, q.subject)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {!wasCorrect && !skipped && (
              <span className="text-success text-[11px] font-medium">
                ✓ Correct: {q.options[q.answer]}
              </span>
            )}
            {skipped && (
              <span className="text-textDim text-[11px] italic">Skipped</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-textDim text-[10px]">{q.subject}</span>
          {expanded ? (
            <ChevronUp size={14} className="text-textDim" />
          ) : (
            <ChevronDown size={14} className="text-textDim" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-borderMuted bg-bgSurface/20 space-y-3 border-t px-4 py-4 md:px-6">
          <div className="space-y-2">
            {q.options.map((opt, optIdx) => {
              const isCorrectOpt = optIdx === q.answer;
              const isUserOpt = !skipped && optIdx === userAns;
              return (
                <div
                  key={optIdx}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-[11px] md:text-xs",
                    isCorrectOpt
                      ? "border-success/30 bg-success/5 text-success font-bold"
                      : isUserOpt
                        ? "border-danger/30 bg-danger/5 text-danger font-bold"
                        : "border-borderMuted bg-bgCard text-textDim opacity-80",
                  )}
                >
                  <span className="font-mono opacity-60">
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <span className="flex-1 wrap-break-word">
                    {renderQuestionText(opt, q.subject)}
                  </span>
                  {isCorrectOpt && <span>✓</span>}
                  {isUserOpt && !isCorrectOpt && <span>← Your pick</span>}
                </div>
              );
            })}
          </div>

          {q.explanation && (
            <div className="border-brand/20 bg-brand/5 border-l-brand rounded-r-lg border border-l-[3px] px-3 py-2 md:px-4 md:py-3">
              <p className="text-brand mb-1 text-[10px] font-black tracking-widest uppercase">
                Built-in Explanation
              </p>
              <p className="text-textMuted text-[11px] leading-relaxed md:text-xs">
                <ExplanationText text={q.explanation} />
              </p>
            </div>
          )}

          <QuestionAIExplanation
            question={q}
            userAnswer={userAns}
            autoExpandOnWrong
          />
        </div>
      )}
    </div>
  );
};

const ResultsScreen: React.FC<ResultsScreenProps> = ({
  onRetry,
  onHome,
  onPerformance,
}) => {
  const { questions, answers, selectedTopic } = useQuizStore();
  const { commitSession, submissionBlocked } = useQuizSession();

  // ✅ Fire once on mount — commit results to all stores
  const committed = useRef(false);
  useEffect(() => {
    if (!committed.current) {
      commitSession();

      // If user selected a specific topic (not All) and completed all questions, mark it as complete
      if (selectedTopic !== "All" && questions.length > 0) {
        // Check if all questions in the quiz are from the same topic
        const allSameTopic = questions.every((q) => q.topic === selectedTopic);
        if (allSameTopic) {
          useStudyTrackingStore.getState().addCompletedTopic(selectedTopic);
        }
      }

      committed.current = true;
    }
  }, []);

  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  const total = questions.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  // How many the user actually reached/answered before time ran out.
  // Relevant mainly for marathon mode, where `total` can be up to 100
  // but the timer often cuts the session short. This does NOT affect
  // `pct`, which stays correct/total as before.
  const attempted = questions.filter(
    (_, i) => answers[i] !== undefined && answers[i] !== -1,
  ).length;
  const unattempted = total - attempted;

  const { icon, label, color } =
    pct >= 80
      ? {
          icon: <Trophy size={48} />,
          label: "Excellent!",
          color: "text-success",
        }
      : pct >= 60
        ? {
            icon: <Target size={48} />,
            label: "Good work!",
            color: "text-warn",
          }
        : pct >= 40
          ? {
              icon: <BookOpen size={48} />,
              label: "Keep practising",
              color: "text-brand-light",
            }
          : {
              icon: <Dumbbell size={48} />,
              label: "Don't give up!",
              color: "text-danger",
            };

  return (
    <div className="animate-fadeIn mx-auto max-w-xl">
      {submissionBlocked && (
        <div className="bg-warning/10 border-warning/30 text-textMain mb-5 rounded-xl border p-4 text-sm">
          <p className="font-semibold">You're offline</p>
          <p className="text-textDim mt-1">
            Your results are saved on this device but haven't been submitted
            yet. Connect to the internet and retry.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => commitSession()}
            className="mt-3"
          >
            Retry submission
          </Button>
        </div>
      )}
      {/* <Score hero */}
      <div className="bg-bgCard border-borderMuted rounded-brand-xl relative mb-5 overflow-hidden border p-8 text-center">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, var(--color-brand-dim) 0%, transparent 70%)",
          }}
        />
        <div className="mb-3 flex items-center justify-center">{icon}</div>
        <div className="font-display text-brand-light mb-1 text-7xl leading-none font-black tracking-tighter">
          {correct}
          <span className="text-textDim text-3xl font-normal">/{total}</span>
        </div>
        <div className={cn("font-display mt-2 text-xl font-semibold", color)}>
          {label}
        </div>
        <div className="text-textDim mt-1 text-sm">{pct}% accuracy</div>
        {unattempted > 0 && (
          <div className="text-textDim mt-1 text-xs">
            Answered: {attempted}/{total}
          </div>
        )}
      </div>

      {/* <Stats row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: "Correct", value: correct, color: "text-success" },
          { label: "Incorrect", value: total - correct, color: "text-danger" },
          { label: "Accuracy", value: `${pct}%`, color: "text-brand-light" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-bgCard border-borderMuted rounded-brand-lg border p-4 text-center"
          >
            <div
              className={cn(
                "font-display text-2xl font-bold tracking-tight",
                color,
              )}
            >
              {value}
            </div>
            <div className="text-textDim mt-0.5 text-[11px] tracking-wider uppercase">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* <Per-question review */}
      <div className="bg-bgCard border-borderMuted rounded-brand-lg mb-5 overflow-hidden border">
        <div className="border-borderMuted flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Question review</p>
          <span className="text-textDim text-[10px] tracking-widest uppercase">
            Tap a question to expand
          </span>
        </div>
        {questions.map((q, i) => {
          const skipped = answers[i] === -1 || answers[i] === undefined;
          const userAns = skipped ? -1 : (answers[i] as number);
          return (
            <ReviewItem
              key={q.id}
              question={q}
              index={i}
              userAnswer={userAns}
            />
          );
        })}
      </div>

      {/* <CTAs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button variant="primary" fullWidth onClick={onRetry}>
          <div className="flex items-center justify-center gap-2">
            <RefreshCw size={16} /> Try again
          </div>
        </Button>
        <Button variant="secondary" fullWidth onClick={onHome}>
          <div className="flex items-center justify-center gap-2">
            <ArrowLeft size={16} /> Dashboard
          </div>
        </Button>
        <Button variant="secondary" fullWidth onClick={onPerformance}>
          <div className="flex items-center justify-center gap-2">
            <BarChart3 size={16} /> Performance
          </div>
        </Button>
      </div>
    </div>
  );
};

export default ResultsScreen;
