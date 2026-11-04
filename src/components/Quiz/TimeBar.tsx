import React from "react";
import { useQuizStore } from "../../Store/useQuizStore";
import { useTimer } from "../../hooks/useTimer";
import { cn } from "../../lib/utils/utils";

const TimerBar: React.FC = () => {
  const isFinished = useQuizStore((s) => s.isFinished);
  const finishQuiz = useQuizStore((s) => s.finishQuiz);
  const updateTime = useQuizStore((s) => s.updateTime);
  const quizDuration = useQuizStore((s) => s.quizDuration);
  const isStarted = useQuizStore((s) => s.isStarted);

  const { timeLeft, formatted } = useTimer({
    initialSeconds: quizDuration,
    autoStart: isStarted && !isFinished,
    onExpire: () => {
      finishQuiz();
    },
    persistenceKey: "schooldra-quiz-session-timer",
  });

  // Sync timer with store for submission logic
  React.useEffect(() => {
    updateTime(timeLeft);
  }, [timeLeft, updateTime]);

  const pct = quizDuration > 0 ? Math.max(0, (timeLeft / quizDuration) * 100) : 0;

  // Adjusted warnings for a longer duration
  // Warn at 5 minutes, Danger at 1 minute
  const isWarn = timeLeft <= 5 * 60 && timeLeft > 60;
  const isDanger = timeLeft <= 60 && timeLeft > 0;

  const barColor = isDanger ? "bg-danger" : isWarn ? "bg-warn" : "bg-brand";

  // If the quiz is already finished (user submitted manually), don't show the timer
  if (isFinished) return null;

  return (
    <div className="relative mb-4">
      {/* ── Warning Reminder ── */}
      {isWarn && (
        <div aria-hidden="true" className="bg-warn/10 border-warn/30 text-warn absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-bold tracking-tighter whitespace-nowrap uppercase">
          Time running low · {formatted} remaining
        </div>
      )}

      {isDanger && (
        <div aria-hidden="true" className="bg-danger/10 border-danger/30 text-danger absolute -top-8 left-1/2 z-10 -translate-x-1/2 rounded-full border px-3 py-1 text-[10px] font-bold tracking-tighter whitespace-nowrap uppercase">
          Final minute · {formatted} left
        </div>
      )}

      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-textDim text-[11px] font-medium tracking-wider uppercase">
          Total Exam Time
        </span>
        <span
          role="timer"
          aria-label={`Time remaining ${formatted}`}
          className={cn(
            "font-mono text-sm font-semibold tabular-nums transition-colors",
            isDanger ? "text-danger" : isWarn ? "text-warn" : "text-textMain",
          )}
        >
          {formatted}
        </span>
      </div>

      <div
        className="bg-bgSurface h-1.5 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Time remaining"
        aria-valuemin={0}
        aria-valuemax={quizDuration}
        aria-valuenow={Math.max(0, timeLeft)}
        aria-valuetext={`${formatted} remaining`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            barColor,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default TimerBar;
