// src/Pages/Dashboard.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router";
import AppLayout from "../components/Layout/AppLayout";
import PageHelmet from "../components/SEO/PageHelmet";
import { useUserStore } from "../Store/useUserStore";
import { useExamCountdown } from "../hooks/useExamCountdown";
import SubjectProgress from "../components/Dashboard/SubjectProgress";
// import LeaderboardCard from "../components/Dashboard/LeaderboardCard";
import RecommendedSessions from "../components/Dashboard/RecommendedSessions";
import DailyGoals from "../components/Dashboard/DailyGoals";
import StreakCelebrationModal from "../components/ui/StreakCelebrationModal";
import { calculateAndUpdateStreak } from "../Services/PerformanceService";
import { supabase } from "../lib/supabase";
import {
  BookOpen,
  TrendingUp,
  Calendar,
  Clock,
  Flame,
  Target,
  CheckCircle2,
  Zap,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { cn } from "../lib/utils/utils";
import ErrorBanner from "../components/ui/ErrorBanner";

// ── Countdown display helpers ─────────────────────────────
function countdownColor(days: number): string {
  if (days < 0) return "var(--text-dim)"; // grey  — no date
  if (days === 0) return "var(--color-warn)"; // orange — exam day
  if (days <= 7) return "var(--color-danger)"; // red   — critical
  if (days <= 30) return "var(--color-warn)"; // amber — soon
  return "var(--color-brand)"; // brand — comfortable
}

function countdownBadge(days: number): { label: string; sublabel: string } {
  if (days < 0) return { label: "—", sublabel: "No date set" };
  if (days === 0) return { label: "Today", sublabel: "Exam day" };
  if (days === 1) return { label: "1", sublabel: "day remaining" };
  return { label: days.toString(), sublabel: "days remaining" };
}

function countdownMotivation(days: number): string {
  if (days < 0) return "";
  if (days === 0) return "Today is the day. You've got this!";
  if (days <= 7) return "Final sprint! Give it everything you have.";
  if (days <= 30) return "Keep pushing — you're on track.";
  if (days <= 100) return "Stay consistent and you'll get there.";
  return "You have plenty of time — stay consistent.";
}

import { usePerformanceStore } from "../Store/usePerformanceStore";
import { SUBJECT_COMBO_MAP } from "../Store/useSubjectStore";
import type { TopicStat } from "../Services/PerformanceService";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const {
    topicStats,
    avgAccuracy,
    loadPerformanceData,
    isLoading,
    error,
    hasFetched,
  } = usePerformanceStore();

  const {
    name,
    streak,
    bestScore,
    questionsCompleted,
    totalQuestions,
    examYear,
    previousAccuracy,
    targetScore,
    university,
    subjectCombo,
    showStreakPopup,
    currentStreakToShow,
    setShowStreakPopup,
    setLastSeenStreakPopup,
    accuracy: userStoreAccuracy,
  } = useUserStore();

  React.useEffect(() => {
    // Force fresh data load on every Dashboard visit - skip cache
    loadPerformanceData(true);

    // Check and update streak on initial load
    const checkStreak = async () => {
      // ✅ Confirm session active before checking
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      try {
        const { streak: updatedStreak, shouldShowPopup } =
          await calculateAndUpdateStreak(false); // app load, not submission

        // Sync full profile to get fresh streak value
        await useUserStore.getState().syncProfile(true);

        if (shouldShowPopup) {
          useUserStore.getState().setShowStreakPopup(true, updatedStreak);
        }
      } catch (err) {
        console.error("Error checking streak:", err);
      }
    };

    checkStreak();
  }, []);

  // Use userStore's accuracy as primary, fall back to avgAccuracy
  const accuracy =
    userStoreAccuracy > 0 ? userStoreAccuracy : Math.round(avgAccuracy);

  // Filter stats based on user subject combo
  const userSubjects = Array.isArray(subjectCombo)
    ? subjectCombo
    : subjectCombo
      ? SUBJECT_COMBO_MAP[subjectCombo] || [subjectCombo]
      : [];
  const filteredTopicStats = topicStats.filter((t: TopicStat) =>
    userSubjects.some((s) => s.toLowerCase() === t.subject.toLowerCase()),
  );

  // Dynamic weak/strong topics from live data
  const weakTopics = filteredTopicStats.filter(
    (t: TopicStat) => t.accuracy < 60,
  );

  // Highest and Lowest topic logic
  const sortedTopics = [...filteredTopicStats].sort(
    (a: TopicStat, b: TopicStat) => b.accuracy - a.accuracy,
  );
  const highestTopic = sortedTopics.length > 0 ? sortedTopics[0] : null;
  const lowestTopic =
    sortedTopics.length > 1 ? sortedTopics[sortedTopics.length - 1] : null;

  const { daysLeft, formattedDate, isUpdating } = useExamCountdown();

  const { label: cdLabel, sublabel: cdSublabel } = countdownBadge(daysLeft);
  const cdColor = countdownColor(daysLeft);
  const cdMotivation = countdownMotivation(daysLeft);

  const isNewUser = questionsCompleted === 0 && bestScore === 0;

  // Progress bar fill for questions
  const questionsPct =
    totalQuestions > 0
      ? Math.min(100, Math.round((questionsCompleted / totalQuestions) * 100))
      : 0;

  return (
    <AppLayout
      currentPage="dashboard"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      {/* Sets the tab title/meta for this route. Dashboard previously had no
          PageHelmet at all, so react-helmet-async had nothing to overwrite
          the last route's title with — landing on /dashboard after /signup
          (or any other page) left the tab reading "Create Free Account". */}
      <PageHelmet
        title="Dashboard | SCHOOLDRA"
        description="Track your JAMB UTME prep progress, streaks, accuracy, and exam countdown on your SCHOOLDRA dashboard."
        canonical="https://www.schooldra.com/dashboard"
      />

      {/* Subtle background sync progress indicator */}
      {isLoading && hasFetched && (
        <div className="bg-bgCard top-0 left-0 h-0.5 w-full overflow-hidden">
          <div className="bg-brand h-full w-1/3 animate-[loading-bar_1.5s_ease-in-out_infinite]" />
        </div>
      )}
      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
      {/* Error Alert */}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => loadPerformanceData(true)}
        />
      )}

      {/* ══════════════════════════════════════════════════
          HERO — two-column grid, no absolute positioning
      ══════════════════════════════════════════════════ */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        {/* ── Left: greeting + CTAs ─────────────────────── */}
        <div className="bg-bgCard border-borderMuted rounded-brand-xl relative overflow-hidden border p-6 md:p-8">
          <div>
            {/* Tag line */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="bg-brand/10 border-brand/20 text-brand-light inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-widest whitespace-nowrap uppercase">
                <Zap className="h-3 w-3" />
                JAMB {examYear} Prep
              </span>
              {university && (
                <span className="bg-bgSurface border-borderMuted text-textDim inline-flex max-w-35 min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] sm:max-w-50">
                  <GraduationCap size={12} className="shrink-0" />
                  <span className="truncate">{university}</span>
                </span>
              )}
            </div>

            {/* Greeting */}
            <h2 className="font-display mb-1 text-2xl leading-snug font-bold tracking-tight break-words whitespace-normal md:text-3xl">
              Ready to ace it,
            </h2>
            <h2 className="font-display mb-4 text-2xl leading-snug font-bold tracking-tight break-words whitespace-normal md:text-3xl">
              <span className="text-brand-light">{name || "Champion"}</span>?
            </h2>

            <p className="text-textMuted mb-6 max-w-md text-sm leading-relaxed">
              {isNewUser
                ? "Welcome! Start your first quiz to track your progress and unlock your personalised dashboard."
                : weakTopics.length > 0
                  ? `Keep pushing — ${weakTopics.length} weak topics need attention today. Focus on ${lowestTopic?.name || "your weakest areas"} to improve.`
                  : `Great job! You've mastered your weak topics. Your strongest area is ${highestTopic?.name || "none yet"}. Keep it up!`}
            </p>

            {/* CTAs */}
            <div className="flex flex-nowrap items-center gap-2 sm:gap-2.5">
              {/* Primary pair — always visible, share width equally on mobile */}
              <div className="flex min-w-0 flex-1 gap-2 sm:gap-2.5">
                <button
                  onClick={() => navigate("/quiz")}
                  className="bg-brand hover:bg-brand-light rounded-brand shadow-brand/30 inline-flex flex-1 items-center justify-center gap-1.5 px-2.5 py-2.5 text-sm font-semibold whitespace-nowrap text-white shadow-lg transition-all active:scale-95 sm:flex-none sm:gap-1.5 sm:px-4"
                >
                  <BookOpen className="h-4 w-4 shrink-0" />
                  <span className="sm:hidden">Daily Quiz</span>
                  <span className="hidden sm:inline">Start Daily Quiz</span>
                </button>
                <button
                  onClick={() => navigate("/mock-exams")}
                  className="bg-bgSurface hover:bg-bgDeep text-textMain border-borderMuted rounded-brand inline-flex flex-1 items-center justify-center gap-1.5 border px-2.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all active:scale-95 sm:flex-none sm:gap-1.5 sm:px-4"
                >
                  <Target className="h-4 w-4 shrink-0" />
                  Mock Exam
                </button>
              </div>

              {/* View Progress — hidden on mobile, visible sm+ */}
              <button
                onClick={() => navigate("/performance")}
                className="text-textDim hover:text-textMain rounded-brand hidden min-w-0 shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all sm:inline-flex"
              >
                <TrendingUp className="h-4 w-4 shrink-0" />
                <span>View Progress</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: countdown card ─────────────────────── */}
        <div
          className="bg-bgCard border-borderMuted rounded-brand-xl relative overflow-hidden border"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${cdColor} 8%, transparent) 0%, transparent 70%)`,
          }}
        >
          {/* ── Mobile: compact horizontal strip ── */}
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:hidden">
            {/* Left: label + date */}
            <div className="flex flex-col gap-0.5">
              <div className="text-textDim flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase">
                <Clock className="h-3 w-3" />
                Exam Countdown
              </div>
              <div className="text-textMuted mt-1 flex items-center gap-1.5 text-[11px]">
                <Calendar className="h-3 w-3 shrink-0" />
                {formattedDate}
              </div>
              {targetScore && (
                <div className="bg-bgSurface border-borderMuted text-textDim mt-1.5 self-start rounded-full border px-2.5 py-0.5 text-[10px] font-medium">
                  Target: {targetScore}
                </div>
              )}
            </div>

            {/* Right: big number */}
            <div className="flex shrink-0 flex-col items-center">
              <div
                className="font-display leading-none font-black tracking-tighter"
                style={{
                  fontSize: "2.75rem",
                  color: isUpdating ? "#6B7280" : cdColor,
                }}
              >
                {isUpdating ? "…" : cdLabel}
              </div>
              <div className="text-textDim mt-0.5 text-[11px] font-medium">
                {isUpdating ? "Updating…" : cdSublabel}
              </div>
            </div>
          </div>

          {/* ── Desktop: original tall centered layout ── */}
          <div className="hidden min-w-40 flex-col items-center justify-center gap-1 px-8 py-6 lg:flex">
            <div className="text-textDim mb-1 flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase">
              <Clock className="h-3 w-3" />
              Exam Countdown
            </div>
            <div
              className="font-display leading-none font-black tracking-tighter"
              style={{
                fontSize:
                  daysLeft > 99 ? "3.5rem" : daysLeft < 0 ? "2rem" : "4.5rem",
                color: isUpdating ? "#6B7280" : cdColor,
              }}
            >
              {isUpdating ? "…" : cdLabel}
            </div>
            <div className="text-textDim mt-0.5 text-xs font-medium">
              {isUpdating ? "Updating…" : cdSublabel}
            </div>
            <div className="bg-borderMuted my-2 h-px w-full" />
            <div className="text-textMuted flex items-center gap-1.5 text-[11px]">
              <Calendar className="h-3 w-3 shrink-0" />
              <span className="text-center leading-tight">{formattedDate}</span>
            </div>
            {targetScore && (
              <div className="bg-bgSurface border-borderMuted text-textDim mt-2 rounded-full border px-3 py-1 text-[10px] font-medium">
                Target: {targetScore}
              </div>
            )}
            {cdMotivation && (
              <p className="text-textDim mt-3 max-w-35 text-center text-[10px] leading-relaxed">
                {cdMotivation}
              </p>
            )}
          </div>

          {/* Urgency ring when ≤7 days */}
          {daysLeft >= 0 && daysLeft <= 7 && (
            <div
              className="rounded-brand-xl pointer-events-none absolute inset-0 animate-pulse"
              style={{ boxShadow: `inset 0 0 0 1.5px ${cdColor}40` }}
            />
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════════════ */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Best Score */}
        <div className="bg-bgSurface rounded-brand-xl flex flex-col gap-1.5 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-textDim text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">
              Best Score
            </span>
            <div className="bg-brand/10 flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8">
              <Target className="text-brand h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          {isLoading ? (
            <>
              <div className="bg-bgTrack skeleton-shimmer h-8 w-24 rounded" />
              <div className="bg-bgTrack skeleton-shimmer h-3 w-16 rounded" />
            </>
          ) : bestScore > 0 ? (
            <>
              <p className="font-display text-textMain text-2xl font-black tracking-tight sm:text-3xl">
                {bestScore}
              </p>
              <p className="text-success flex items-center gap-1 text-[10px] font-medium sm:text-[11px]">
                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                Max JAMB
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-textDim text-xl font-black tracking-tight sm:text-2xl">
                —
              </p>
              <p className="text-textDim text-[10px] leading-snug sm:text-[11px]">
                Take mock exam
              </p>
            </>
          )}
        </div>

        {/* Accuracy */}
        <div className="bg-bgSurface rounded-brand-xl flex flex-col gap-1.5 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-textDim text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">
              Accuracy
            </span>
            <div className="bg-success/10 flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8">
              <CheckCircle2 className="text-success h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          {isLoading ? (
            <>
              <div className="bg-bgTrack skeleton-shimmer h-8 w-20 rounded" />
              <div className="bg-bgTrack skeleton-shimmer h-3 w-20 rounded" />
            </>
          ) : questionsCompleted > 0 ? (
            <>
              <p className="font-display text-textMain text-2xl font-black tracking-tight sm:text-3xl">
                {accuracy}%
              </p>
              <p className="text-textDim text-[10px] font-medium sm:text-[11px]">
                Up from {previousAccuracy}%
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-textDim text-xl font-black tracking-tight sm:text-2xl">
                —
              </p>
              <p className="text-textDim text-[10px] leading-snug sm:text-[11px]">
                Start first quiz
              </p>
            </>
          )}
        </div>

        {/* Total Questions */}
        <div className="bg-bgSurface rounded-brand-xl flex flex-col gap-1.5 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-textDim text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">
              Total Questions
            </span>
            <div className="bg-brand/10 flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8">
              <BookOpen className="text-brand h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
          </div>
          {isLoading ? (
            <>
              <div className="bg-bgTrack skeleton-shimmer h-8 w-28 rounded" />
              <div className="bg-bgTrack skeleton-shimmer mt-1 h-3 w-32 rounded" />
              <div className="bg-bgTrack skeleton-shimmer mt-2 h-1 w-full rounded" />
            </>
          ) : (
            <>
              <p
                className={cn(
                  "font-display font-black tracking-tight",
                  totalQuestions > 0
                    ? "text-textMain text-2xl sm:text-3xl"
                    : "text-textDim text-xl sm:text-2xl",
                )}
              >
                {totalQuestions > 0 ? totalQuestions.toLocaleString() : "0"}
              </p>
              {totalQuestions > 0 ? (
                <div>
                  <div className="text-textDim mb-1 flex justify-between text-[9px] sm:text-[10px]">
                    <span>Correct: {questionsCompleted.toLocaleString()}</span>
                    <span>Accuracy: {accuracy}%</span>
                  </div>
                  <div className="bg-bgTrack h-1 overflow-hidden rounded-full">
                    <div
                      className="bg-brand h-full rounded-full transition-all duration-500"
                      style={{ width: `${questionsPct}%` }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-textDim text-[10px] leading-snug sm:text-[11px]">
                  Start practising
                </p>
              )}
            </>
          )}
        </div>

        {/* Streak */}
        <div className="bg-bgSurface rounded-brand-xl flex flex-col gap-1.5 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <span className="text-textDim text-[9px] font-bold tracking-widest uppercase sm:text-[10px]">
              Streak
            </span>
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg sm:h-8 sm:w-8",
                streak > 0 ? "bg-brand/10" : "bg-bgCard",
              )}
            >
              <Flame
                className={cn(
                  "h-3.5 w-3.5 sm:h-4 sm:w-4",
                  streak > 0 ? "text-brand" : "text-textDim",
                )}
              />
            </div>
          </div>
          {isLoading ? (
            <>
              <div className="bg-bgTrack skeleton-shimmer h-8 w-20 rounded" />
              <div className="bg-bgTrack skeleton-shimmer h-3 w-16 rounded" />
            </>
          ) : streak > 0 ? (
            <>
              <p className="font-display text-textMain text-2xl font-black tracking-tight sm:text-3xl">
                {streak}
                <span className="text-textDim ml-1 text-xs font-semibold sm:text-base">
                  days
                </span>
              </p>
              <p className="text-brand flex items-center gap-1 text-[10px] font-medium sm:text-[11px]">
                Keep it up!
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-textDim text-xl font-black tracking-tight sm:text-2xl">
                0
              </p>
              <p className="text-textDim text-[10px] leading-snug sm:text-[11px]">
                Start today
              </p>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MIDDLE ROW
      ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SubjectProgress />
        <div className="space-y-4">
          <RecommendedSessions />
          <DailyGoals />
        </div>
        {/* <LeaderboardCard /> */}
      </div>

      {/* Streak Celebration Modal */}
      <StreakCelebrationModal
        isOpen={showStreakPopup}
        onClose={() => {
          setShowStreakPopup(false);
          setLastSeenStreakPopup(currentStreakToShow);
        }}
        streak={currentStreakToShow}
      />
    </AppLayout>
  );
};

export default Dashboard;
