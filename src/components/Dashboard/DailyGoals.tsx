import React, { useMemo, useEffect } from "react";
import { useGoalStore } from "../../Store/useGoal";
import { useUserStore } from "../../Store/useUserStore";
import { useStudyTrackingStore } from "../../Store/useStudyTrackingStore";
import { cn } from "../../lib/utils/utils";
import { Flame, CheckCircle2, Circle, Zap, PartyPopper } from "lucide-react";

const DAYS_SHORT = ["M", "T", "W", "T", "F", "S", "S"];

function getMotivationalMessage(pct: number, streak: number): string {
  if (pct === 0) return "Start today — every expert was once a beginner.";
  if (pct < 40) return "Good start! Keep the momentum going.";
  if (pct < 80)
    return streak > 3
      ? "You're on fire! Almost there!"
      : "More than halfway — finish strong!";
  if (pct < 100) return "So close! One last push to complete your goal.";
  return streak > 7
    ? "Goal crushed! You're unstoppable!"
    : "Daily goal complete! Great work today.";
}

const DailyGoals: React.FC = () => {
  const { isAuthenticated } = useUserStore();
  const { goals, checkAndCompleteGoals, resetForNewDay, syncWithDatabase } =
    useGoalStore();
  const { streak } = useUserStore();
  const {
    questionsCompletedToday,
    topicsCompletedToday,
    getCurrentStudyTime,
    bestAccuracyToday,
    resetForNewDay: resetTrackingForNewDay,
    syncWithDatabase: syncTrackingWithDatabase,
  } = useStudyTrackingStore();

  // Calculate goal completion stats
  const doneCount = goals.filter((g) => g.done).length;
  const totalGoals = goals.length;
  const goalsComplete = doneCount === totalGoals;
  const goalsPct =
    totalGoals > 0 ? Math.round((doneCount / totalGoals) * 100) : 0;
  const totalXp = goals.reduce((sum, g) => sum + (g.done ? g.xp : 0), 0);

  useEffect(() => {
    // ✅ Don't sync until we know who the user is
    if (!isAuthenticated) return;

    resetForNewDay();
    resetTrackingForNewDay();
    syncWithDatabase();
    syncTrackingWithDatabase();
  }, [
    isAuthenticated,
    resetForNewDay,
    resetTrackingForNewDay,
    syncWithDatabase,
    syncTrackingWithDatabase,
  ]);

  // Returns 0-indexed day of week where 0 = Monday
  function getTodayIndex(): number {
    const d = new Date().getDay(); // 0=Sun … 6=Sat
    return d === 0 ? 6 : d - 1;
  }

  // Reset goals for new day on mount and sync with DB
  useEffect(() => {
    resetForNewDay();
    resetTrackingForNewDay();
    syncWithDatabase();
    syncTrackingWithDatabase();
  }, [
    resetForNewDay,
    resetTrackingForNewDay,
    syncWithDatabase,
    syncTrackingWithDatabase,
  ]);

  // Check goals every second
  useEffect(() => {
    const intervalId = setInterval(() => {
      checkAndCompleteGoals(
        questionsCompletedToday,
        topicsCompletedToday,
        getCurrentStudyTime(),
        bestAccuracyToday,
      );
    }, 1000);
    return () => clearInterval(intervalId);
  }, [
    checkAndCompleteGoals,
    getCurrentStudyTime,
    questionsCompletedToday,
    topicsCompletedToday,
    bestAccuracyToday,
  ]);

  // Build 7-day streak bars: today = getTodayIndex(), past days filled based on streak
  const todayIdx = getTodayIndex();
  const streakBars = useMemo(() => {
    return DAYS_SHORT.map((label, i) => {
      const daysAgo = (todayIdx - i + 7) % 7;
      const isToday = i === todayIdx;
      const active = daysAgo < streak || (isToday && goalsComplete);
      return { label, isToday, active };
    });
  }, [todayIdx, streak, goalsComplete]);

  const motivationMsg = getMotivationalMessage(goalsPct, streak);

  return (
    <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          Daily Goals
        </h3>
        <span className="text-textDim text-xs">
          {doneCount}/{totalGoals} done
          {totalXp > 0 && (
            <span className="text-warn ml-1.5 font-semibold">
              +{totalXp} XP
            </span>
          )}
        </span>
      </div>

      {/* Congratulations message when all goals are done */}
      {goalsComplete && (
        <div className="bg-success/10 border-success/20 rounded-brand mb-4 flex items-center gap-2 border p-3">
          <PartyPopper className="text-success h-5 w-5" />
          <div>
            <p className="text-success text-sm font-semibold">
              Congratulations!
            </p>
            <p className="text-textDim text-xs">
              You've completed all your goals for today! Keep it up!
            </p>
          </div>
        </div>
      )}

      {/* Goals progress */}
      <div className="bg-bgSurface border-borderMuted rounded-brand mb-4 border p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-textMain flex items-center gap-1.5 text-xs font-medium">
            <Zap className="text-brand h-3.5 w-3.5" />
            Daily goals progress
          </span>
          <span
            className={cn(
              "font-mono text-xs font-semibold",
              goalsComplete ? "text-success" : "text-textMuted",
            )}
          >
            {doneCount}/{totalGoals}
          </span>
        </div>
        {/* Progress bar */}
        <div className="bg-bgCard h-2 overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              goalsComplete ? "bg-success" : "bg-brand",
            )}
            style={{ width: `${goalsPct}%` }}
          />
        </div>
        <p className="text-textDim mt-1.5 text-[11px] leading-snug">
          {motivationMsg}
        </p>
      </div>

      {/* Goal checklist */}
      <div className="divide-borderMuted divide-y">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="flex items-center gap-3 py-2.5 select-none"
          >
            {/* Checkbox */}
            <div className="shrink-0">
              {goal.done ? (
                <CheckCircle2 className="text-success h-4.5 w-4.5" />
              ) : (
                <Circle className="text-borderMuted h-4.5 w-4.5" />
              )}
            </div>

            {/* Label */}
            <span
              className={cn(
                "flex-1 text-sm leading-snug transition-colors",
                goal.done ? "text-textDim line-through" : "text-textMain",
              )}
            >
              {goal.label}
            </span>

            {/* XP badge */}
            <span
              className={cn(
                "shrink-0 font-mono text-[11px] font-semibold transition-colors",
                goal.done ? "text-success" : "text-warn",
              )}
            >
              +{goal.xp} XP
            </span>
          </div>
        ))}
      </div>

      {/* 7-day streak visualisation */}
      <div className="border-borderMuted mt-4 border-t pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-textDim flex items-center gap-1.5 text-xs">
            <Flame className="text-warn h-3.5 w-3.5" />
            {streak > 0 ? `${streak}-day streak` : "This week's activity"}
          </p>
          {streak >= 7 && (
            <span className="text-warn flex items-center gap-1 text-[10px] font-semibold">
              <Flame size={10} /> On fire!
            </span>
          )}
        </div>

        <div className="flex h-10 items-end gap-1.5">
          {streakBars.map((bar, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  "w-full rounded-sm transition-all duration-500",
                  bar.isToday &&
                    !bar.active &&
                    "border-borderMuted border border-dashed",
                )}
                style={{
                  height: bar.active ? "100%" : bar.isToday ? "30%" : "20%",
                  background: bar.active
                    ? bar.isToday
                      ? "var(--color-brand)"
                      : "var(--color-brand)"
                    : "transparent",
                  minHeight: "4px",
                }}
              />
              <span
                className={cn(
                  "text-[9px]",
                  bar.isToday
                    ? "text-brand-light font-semibold"
                    : "text-textDim",
                )}
              >
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DailyGoals;
