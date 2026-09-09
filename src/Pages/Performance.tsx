// src/Pages/Performance.tsx (FIXED - No emojis, all Lucide icons)

import React, { useState, useEffect } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import { useNavigate } from "react-router";
import AppLayout from "../components/Layout/AppLayout";
import { usePerformanceStore } from "../Store/usePerformanceStore";
import { useUserStore } from "../Store/useUserStore";
import { useSubjectStore, SUBJECT_COMBO_MAP } from "../Store/useSubjectStore";
import { computeBestWorstSubjects } from "../lib/subjectInsights";
import WeeklyChart from "../components/Performance/WeeklyChart";
import {
  getSubjectIcon as getMetaSubjectIcon,
  getSubjectColor,
} from "../lib/subjectMeta";
import {
  ArrowRight,
  Clock,
  Sparkles,
  Target,
  Trophy,
  Zap,
  BookOpen,
  Medal,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import SectionError from "../components/ui/SectionError";
import ErrorBanner from "../components/ui/ErrorBanner";

const getSubjectIcon = (subject: string) => {
  const normalizedSubject =
    subject === "Literature in English" ? "Literature" : subject;
  const Icon = getMetaSubjectIcon(normalizedSubject);
  const color = getSubjectColor(normalizedSubject);

  return <Icon className="h-5 w-5" style={{ color }} />;
};

const Performance: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const {
    topicStats,
    mockHistory,
    totalQuestions,
    avgAccuracy,
    isLoading,
    loadPerformanceData,
    error: performanceError,
    hasFetched: performanceHasFetched,
  } = usePerformanceStore();
  const {
    subjects,
    loadSubjects,
    isInitialized: subjectsInitialized,
  } = useSubjectStore();
  const {
    name,
    questionsCompleted,
    subjectCombo,
    bestScore,
    accuracy,
    targetScore,
  } = useUserStore();

  const error = performanceError;
  const hasData =
    totalQuestions > 0 || topicStats.length > 0 || mockHistory.length > 0;

  const getNumericTarget = (range: string): number => {
    if (range === "320+") return 320;
    if (range === "280–319") return 280;
    if (range === "250–279") return 250;
    if (range === "200–249") return 200;
    const num = parseInt(range);
    if (!isNaN(num)) return num;
    return 320;
  };

  const userTargetScore = getNumericTarget(targetScore);

  useEffect(() => {
    console.log("🔵 Loading performance data...");
    loadPerformanceData(false);
    if (!subjectsInitialized) {
      loadSubjects();
    }
  }, [loadSubjects, subjectsInitialized]);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await loadPerformanceData(true);
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setTimeout(() => {
        setIsManualRefreshing(false);
      }, 600);
    }
  };

  const displayAccuracy = avgAccuracy > 0 ? avgAccuracy : accuracy;
  const displayTotalQuestions =
    totalQuestions > 0 ? totalQuestions : questionsCompleted;

  const userSubjects = Array.isArray(subjectCombo)
    ? subjectCombo
    : subjectCombo
      ? SUBJECT_COMBO_MAP[subjectCombo] || []
      : [];

  const { best: bestSubject, worst: worstSubject } = computeBestWorstSubjects(
    subjects,
    userSubjects,
  );

  const userSubjectsWithIcons = userSubjects.map((name) => ({
    name,
    icon: getSubjectIcon(name),
  }));

  const showDataSkeleton = isLoading && !performanceHasFetched;
  const showFullError = !!error && !hasData;
  const showRefreshBanner = !!error && hasData;

  return (
    <AppLayout
      currentPage="performance"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Performance | SCHOOLDRA"
        description="Detailed breakdown of your academic progress with charts, mock history, and topic-level insights to guide JAMB UTME study."
        canonical="https://www.schooldra.com/performance"
      />
      {isLoading && (
        <div className="bg-bgCard fixed top-0 left-0 z-50 h-0.5 w-full overflow-hidden">
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

      <div className="animate-fadeIn mx-auto max-w-350 space-y-6">
        {showRefreshBanner && (
          <ErrorBanner
            message={performanceError || ""}
            onRetry={handleManualRefresh}
            isRetrying={isManualRefreshing}
          />
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-textMain text-3xl font-bold tracking-tight lg:text-4xl">
              {name ? `${name.split(" ")[0]}'s` : "Your"} Performance
            </h1>
            <p className="text-textDim mt-1 lg:text-lg">
              Detailed breakdown of your academic progress
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleManualRefresh}
                disabled={isManualRefreshing}
                className="text-textDim hover:text-brand bg-bgCard border-borderMuted hover:border-brand/30 group flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-75"
              >
                <RefreshCw
                  size={16}
                  className={`transition-transform ${isManualRefreshing ? "animate-spin" : "group-hover:rotate-45"}`}
                />
                {isManualRefreshing ? "Refreshing..." : "Refresh Data"}
              </button>
              <div className="text-textDim bg-bgCard border-borderMuted flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm">
                <span
                  className={`h-2 w-2 rounded-full ${error ? "bg-warning" : "bg-success animate-pulse"}`}
                />
                {error
                  ? "Showing cached data"
                  : isLoading
                    ? "SYNCING..."
                    : "LIVE DATA SYNCED"}
              </div>
            </div>
          </div>
        </div>

        {/* Performance Cards - NO EMOJIS */}
        {showDataSkeleton ? (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-bgCard border-borderMuted relative flex h-full flex-col overflow-hidden rounded-4xl border p-6 shadow-sm lg:p-7"
              >
                <div className="bg-bgSurface mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm" />
                <div className="bg-bgSurface mb-1.5 h-5 w-40 rounded" />
                <div className="mb-auto min-h-14">
                  <div className="bg-bgSurface mt-1 h-10 w-24 rounded lg:h-11" />
                </div>
                <div className="bg-bgSurface skeleton-shimmer mt-2 h-3 w-28 rounded" />
              </div>
            ))}
          </div>
        ) : showFullError ? (
          <SectionError
            message={performanceError || ""}
            onRetry={handleManualRefresh}
            isRetrying={isManualRefreshing}
          />
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <StatCard
              label="Average Accuracy"
              value={`${Math.round(displayAccuracy)}%`}
              sub={displayAccuracy > 0 ? "Overall average" : "No data yet"}
              color="text-brand"
              icon={<Target className="h-6 w-6" />}
              iconBg="bg-brand/10"
              valueSize="text-3xl lg:text-4xl"
              truncate={false}
            />
            <StatCard
              label="Best Subject"
              value={
                bestSubject.type === "subject"
                  ? bestSubject.subject
                  : bestSubject.type === "no_data"
                    ? "Start Practice"
                    : "Select Subjects"
              }
              sub={
                bestSubject.type === "subject"
                  ? `Best: ${Math.round(bestSubject.best_score)}% score`
                  : bestSubject.type === "no_data"
                    ? "Take a quiz to see"
                    : "Choose your combo"
              }
              color="text-success"
              icon={<Trophy className="h-6 w-6" />}
              iconBg="bg-success/10"
              valueSize="text-2xl"
            />
            <StatCard
              label="Worst Subject"
              value={
                worstSubject.type === "weak_topic" ||
                worstSubject.type === "low_accuracy"
                  ? worstSubject.subject
                  : worstSubject.type === "all_good"
                    ? "You're killing it!"
                    : worstSubject.type === "need_more_data"
                      ? "Keep practicing"
                      : worstSubject.type === "no_data"
                        ? "Start Practice"
                        : "Select Subjects"
              }
              sub={
                worstSubject.type === "weak_topic"
                  ? "Weak topic needs attention"
                  : worstSubject.type === "low_accuracy"
                    ? `Lowest: ${Math.round(worstSubject.worst_score)}% score`
                    : worstSubject.type === "all_good"
                      ? "All subjects are strong!"
                      : worstSubject.type === "need_more_data"
                        ? "Try another subject to compare"
                        : worstSubject.type === "no_data"
                          ? "Take a quiz to see"
                          : "Choose your combo"
              }
              color="text-danger"
              icon={<AlertTriangle className="h-6 w-6" />}
              iconBg="bg-danger/10"
              valueSize="text-2xl"
            />
            <StatCard
              label="Questions Done"
              value={displayTotalQuestions.toLocaleString()}
              sub="Total attempted"
              color="text-warn"
              icon={<BookOpen className="h-6 w-6" />}
              iconBg="bg-warn/10"
              valueSize="text-3xl lg:text-4xl"
              truncate={false}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7 xl:col-span-8">
            {showDataSkeleton ? (
              <>
                <div className="bg-bgCard border-borderMuted rounded-brand-2xl border p-6 shadow-sm lg:p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex flex-col gap-2">
                      <div className="bg-bgSurface skeleton-shimmer h-6 w-40 rounded" />
                      <div className="bg-bgSurface skeleton-shimmer h-3 w-48 rounded" />
                    </div>
                    <div className="bg-bgSurface skeleton-shimmer h-7 w-16 rounded-full" />
                  </div>
                  <div className="h-64 lg:h-80">
                    <div className="flex h-full items-end justify-between gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                        <div
                          key={d}
                          className="flex flex-1 flex-col items-center gap-2"
                        >
                          <div
                            className="bg-bgSurface skeleton-shimmer w-full rounded-t-lg"
                            style={{ height: `${20 + d * 10}%` }}
                          />
                          <div className="bg-bgSurface skeleton-shimmer h-2 w-6 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[1, 2, 3, 4].map((s) => (
                    <div
                      key={s}
                      className="bg-bgCard border-borderMuted rounded-brand-2xl flex flex-col items-center gap-4 border p-5 shadow-sm"
                    >
                      <div className="bg-bgSurface skeleton-shimmer flex h-12 w-12 items-center justify-center rounded-xl" />
                      <div className="bg-bgSurface skeleton-shimmer h-3 w-24 rounded" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="bg-bgCard border-borderMuted rounded-brand-2xl border p-6 shadow-sm lg:p-8">
                  <div className="mb-8 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-display text-textMain text-xl font-bold">
                        Weekly activity
                      </h3>
                      <p className="text-textDim text-xs font-medium">
                        Questions answered in last 7 days
                      </p>
                    </div>
                    <div className="text-brand bg-brand/5 border-brand/10 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold">
                      <div className="bg-brand h-1.5 w-1.5 animate-pulse rounded-full" />
                      Live
                    </div>
                  </div>
                  <div className="h-75 lg:h-100">
                    <WeeklyChart />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {userSubjectsWithIcons.map((s) => (
                    <button
                      key={s.name}
                      onClick={() =>
                        navigate(`/quiz?subject=${encodeURIComponent(s.name)}`)
                      }
                      className="rounded-brand-2xl bg-bgCard border-borderMuted hover:border-brand/40 group flex flex-col items-center gap-4 border p-5 shadow-sm transition-all hover:shadow-md active:scale-95"
                    >
                      <div className="bg-bgSurface group-hover:bg-brand/5 flex h-12 w-12 items-center justify-center rounded-xl text-2xl transition-transform group-hover:scale-110">
                        {s.icon}
                      </div>
                      <span className="text-textDim group-hover:text-textMain text-[11px] font-black tracking-wider uppercase">
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="space-y-6 lg:col-span-5 xl:col-span-4">
            {showDataSkeleton ? (
              <div className="bg-bgCard border-borderMuted rounded-brand-2xl group relative flex h-full flex-col overflow-hidden border p-6 shadow-sm lg:p-8">
                <div className="bg-bgSurface absolute top-0 right-0 -mt-32 -mr-32 h-64 w-64 rounded-full blur-3xl" />
                <div className="relative z-10 mb-8 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <div className="bg-bgSurface skeleton-shimmer h-6 w-52 rounded" />
                    <div className="bg-bgSurface skeleton-shimmer h-3 w-56 rounded" />
                  </div>
                  <div className="bg-bgSurface skeleton-shimmer h-9 w-9 rounded-full" />
                </div>

                <div className="relative z-10 grid flex-1 grid-cols-1 gap-6">
                  <div className="bg-bgSurface/40 border-borderMuted/60 rounded-brand-2xl flex flex-col justify-between border p-6">
                    <div>
                      <div className="mb-6 flex items-center gap-3">
                        <div className="bg-bgCard skeleton-shimmer flex h-10 w-10 items-center justify-center rounded-xl" />
                        <div className="bg-bgCard skeleton-shimmer h-3 w-32 rounded" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="bg-bgCard skeleton-shimmer h-16 w-28 rounded" />
                        <div className="bg-bgCard skeleton-shimmer h-5 w-12 rounded" />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between pt-4">
                      <div className="bg-bgCard skeleton-shimmer h-3 w-36 rounded" />
                      <div className="bg-bgCard skeleton-shimmer h-5 w-16 rounded" />
                    </div>
                  </div>

                  <div className="bg-bgSurface/40 border-borderMuted/60 rounded-brand-2xl flex flex-col justify-between border p-6">
                    <div>
                      <div className="mb-6 flex items-center gap-3">
                        <div className="bg-bgCard skeleton-shimmer flex h-10 w-10 items-center justify-center rounded-xl" />
                        <div className="bg-bgCard skeleton-shimmer h-3 w-32 rounded" />
                      </div>
                      <div className="flex items-baseline gap-2">
                        <div className="bg-bgCard skeleton-shimmer h-16 w-28 rounded" />
                        <div className="bg-bgCard skeleton-shimmer h-5 w-12 rounded" />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between pt-4">
                      <div className="bg-bgCard skeleton-shimmer h-3 w-28 rounded" />
                    </div>
                  </div>
                </div>

                <div className="bg-bgSurface/40 border-borderMuted/40 rounded-brand-2xl relative z-10 mt-8 border p-6 lg:p-7">
                  <div className="mb-6 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-bgCard skeleton-shimmer flex h-10 w-10 items-center justify-center rounded-2xl" />
                      <div className="space-y-1">
                        <div className="bg-bgCard skeleton-shimmer h-3 w-40 rounded" />
                        <div className="bg-bgCard skeleton-shimmer h-3 w-44 rounded" />
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="bg-bgCard skeleton-shimmer h-7 w-14 rounded" />
                      <div className="bg-bgCard skeleton-shimmer ml-auto h-2 w-20 rounded" />
                    </div>
                  </div>

                  <div className="bg-bgDeep border-borderMuted/20 h-5 overflow-hidden rounded-full border p-1.5">
                    <div className="bg-bgSurface skeleton-shimmer h-full w-2/3 rounded-full" />
                  </div>

                  <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="bg-bgSurface skeleton-shimmer h-3 w-48 rounded" />
                    <div className="bg-bgSurface skeleton-shimmer h-6 w-28 rounded-full" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-bgCard border-borderMuted rounded-brand-2xl group relative flex h-full flex-col overflow-hidden border p-6 shadow-sm lg:p-8">
                <div className="bg-brand/5 group-hover:bg-brand/10 absolute top-0 right-0 -mt-32 -mr-32 h-64 w-64 rounded-full blur-3xl transition-colors"></div>
                <div className="relative z-10 mb-8 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="font-display text-textMain text-xl font-bold">
                      Mock Exam Performance
                    </h3>
                    <p className="text-textDim text-xs font-medium">
                      Analysis of your full-length CBT attempts
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/mock-exams")}
                    className="bg-bgSurface hover:bg-brand/10 text-brand group/btn rounded-full p-2 transition-colors"
                  >
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover/btn:translate-x-0.5"
                    />
                  </button>
                </div>

                <div className="relative z-10 grid flex-1 grid-cols-1 gap-6">
                  <div className="bg-bgSurface/40 border-borderMuted/60 rounded-brand-2xl hover:border-brand/40 hover:bg-bgSurface/60 group/card flex flex-col justify-between border p-6 transition-all">
                    <div>
                      <div className="mb-6 flex items-center gap-3">
                        <div className="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover/card:scale-110">
                          <Target size={20} className="text-brand" />
                        </div>
                        <span className="text-textDim text-xs font-black tracking-widest uppercase">
                          Personal Best
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-brand text-6xl font-black tracking-tighter xl:text-7xl">
                          {bestScore || "0"}
                        </span>
                        <span className="text-textDim text-lg font-bold uppercase">
                          / 400
                        </span>
                      </div>
                    </div>
                    <div className="border-borderMuted/30 mt-6 flex items-center justify-between border-t pt-4">
                      <span className="text-textDim text-[11px] font-bold tracking-wider uppercase">
                        Highest Unified Score
                      </span>
                      <div className="text-success bg-success/10 flex items-center gap-1.5 rounded-md px-2 py-1">
                        <Zap size={12} fill="currentColor" />
                        <span className="text-[10px] font-black tracking-tight uppercase">
                          Elite
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-bgSurface/40 border-borderMuted/60 rounded-brand-2xl hover:border-success/40 hover:bg-bgSurface/60 group/card flex flex-col justify-between border p-6 transition-all">
                    <div>
                      <div className="mb-6 flex items-center gap-3">
                        <div className="bg-success/10 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover/card:scale-110">
                          <Clock size={20} className="text-success" />
                        </div>
                        <span className="text-textDim text-xs font-black tracking-widest uppercase">
                          Latest Attempt
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="font-display text-textMain text-6xl font-black tracking-tighter xl:text-7xl">
                          {mockHistory.length > 0
                            ? mockHistory[0].jambScore
                            : "0"}
                        </span>
                        <span className="text-textDim text-lg font-bold uppercase">
                          / 400
                        </span>
                      </div>
                    </div>
                    <div className="border-borderMuted/30 mt-6 flex items-center justify-between border-t pt-4">
                      <span className="text-textDim text-[11px] font-bold tracking-wider uppercase">
                        {mockHistory.length > 0
                          ? new Date(mockHistory[0].date).toLocaleDateString(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          : "No attempts recorded"}
                      </span>
                      {mockHistory.length > 0 &&
                        mockHistory[0].jambScore >= bestScore &&
                        bestScore > 0 && (
                          <span className="text-success bg-success/10 rounded px-2.5 py-1 text-[10px] font-black tracking-widest uppercase">
                            New Record
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="bg-bgDeep/40 rounded-brand-2xl border-borderMuted/40 relative z-10 mt-8 border p-6 lg:p-7">
                  <div className="mb-6 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-brand shadow-brand/20 flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xl">
                        <Medal size={20} />
                      </div>
                      <div>
                        <h4 className="text-textMain text-xs font-black tracking-widest uppercase">
                          Progress to Target
                        </h4>
                        <p className="text-textDim text-[11px] font-medium">
                          JAMB Admission Goal: {userTargetScore} Points
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-brand text-2xl leading-none font-black whitespace-nowrap lg:text-3xl">
                        {Math.min(
                          Math.round((bestScore / userTargetScore) * 100),
                          100,
                        )}
                        %
                      </div>
                      <span className="text-textDim text-[10px] font-bold tracking-tighter uppercase">
                        Completed
                      </span>
                    </div>
                  </div>

                  <div className="bg-bgDeep border-borderMuted/20 h-5 overflow-hidden rounded-full border p-1.5">
                    <div
                      className="from-brand/60 via-brand to-brand-light relative h-full rounded-full bg-linear-to-r shadow-[0_0_20px_rgba(123,95,255,0.5)] transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min((bestScore / userTargetScore) * 100, 100)}%`,
                      }}
                    >
                      <div className="absolute inset-0 animate-[shimmer_2s_linear_infinite] bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-size-[20px_20px]"></div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-textDim flex items-center gap-2 text-xs font-bold italic">
                      <Sparkles size={14} className="text-brand" />
                      {bestScore >= userTargetScore
                        ? "Target achieved! You're ready."
                        : `Need ${userTargetScore - bestScore} more for target.`}
                    </p>
                    <span className="text-brand bg-brand/10 rounded-full px-3 py-1 text-[11px] font-black tracking-widest uppercase">
                      Target: {userTargetScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Subject Breakdown Area */}
        {showDataSkeleton ? (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div className="bg-bgSurface skeleton-shimmer h-7 w-44 rounded" />
              <div className="bg-borderMuted/50 mx-6 hidden h-px flex-1 md:block" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className="bg-bgCard border-borderMuted rounded-2xl border p-5"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="bg-bgSurface skeleton-shimmer flex h-12 w-12 items-center justify-center rounded-xl" />
                    <div className="space-y-1">
                      <div className="bg-bgSurface skeleton-shimmer h-5 w-28 rounded" />
                      <div className="bg-bgSurface skeleton-shimmer h-3 w-32 rounded" />
                    </div>
                  </div>
                  <div className="bg-bgSurface/50 rounded-xl p-3">
                    <div className="mb-1 flex items-center gap-1.5">
                      <div className="bg-bgCard h-1.5 w-1.5 rounded-full" />
                      <div className="bg-bgCard skeleton-shimmer h-3 w-24 rounded" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="bg-bgCard skeleton-shimmer h-4 w-40 rounded" />
                      <div className="bg-bgCard skeleton-shimmer h-4 w-10 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-textMain text-2xl font-bold">
                Subject Breakdown
              </h3>
              <div className="bg-borderMuted/50 mx-6 hidden h-px flex-1 md:block" />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {userSubjects.map((subject) => {
                const subjectTopicStats = topicStats.filter(
                  (t) => t.subject === subject,
                );
                const weakestTopic =
                  subjectTopicStats.length > 0
                    ? [...subjectTopicStats].sort(
                        (a, b) => a.accuracy - b.accuracy,
                      )[0]
                    : null;

                return (
                  <div
                    key={subject}
                    className="bg-bgCard border-borderMuted hover:border-brand/30 group cursor-pointer rounded-2xl border p-5 transition-all hover:shadow-md active:scale-[0.98]"
                    onClick={() =>
                      navigate(`/quiz?subject=${encodeURIComponent(subject)}`)
                    }
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <div className="bg-brand/10 flex h-12 w-12 items-center justify-center rounded-xl text-2xl">
                        {getSubjectIcon(subject)}
                      </div>
                      <div>
                        <h4 className="font-display text-textMain group-hover:text-brand font-bold transition-colors">
                          {subject}
                        </h4>
                        <p className="text-textDim text-[11px]">
                          {subjectTopicStats.length > 0
                            ? `${subjectTopicStats.length} topics tracked`
                            : "No topics tracked yet"}
                        </p>
                      </div>
                    </div>
                    {weakestTopic && (
                      <div
                        className="bg-danger/5 border-danger/20 hover:border-danger/40 cursor-pointer rounded-xl border p-3 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/quiz?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(weakestTopic.name)}`,
                          );
                        }}
                      >
                        <p className="text-danger mb-1 flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase">
                          <span className="bg-danger h-1.5 w-1.5 rounded-full" />
                          Weakest Topic
                        </p>
                        <div className="flex items-center justify-between">
                          <p className="text-textMain group-hover:text-danger truncate text-sm font-medium transition-colors">
                            {weakestTopic.name}
                          </p>
                          <span className="text-danger text-xs font-bold">
                            {Math.round(weakestTopic.accuracy)}%
                          </span>
                        </div>
                      </div>
                    )}
                    {!weakestTopic && subjectTopicStats.length > 0 && (
                      <div className="bg-success/5 border-success/20 rounded-xl border p-3">
                        <p className="text-success flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase">
                          <span className="bg-success h-1.5 w-1.5 rounded-full" />
                          All topics are doing well!
                        </p>
                      </div>
                    )}
                    {!weakestTopic && subjectTopicStats.length === 0 && (
                      <div className="bg-bgSurface rounded-xl p-3">
                        <p className="text-textDim text-[11px] font-medium">
                          Take a quiz in this subject to start tracking topics!
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: React.ReactNode;
  iconBg: string;
  valueSize?: string;
  truncate?: boolean;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  color,
  icon,
  iconBg,
  valueSize = "text-lg lg:text-xl",
  truncate = true,
}) => (
  <div className="bg-bgCard border-borderMuted hover:border-brand/30 group relative flex h-full flex-col overflow-hidden rounded-4xl border p-6 shadow-sm transition-all hover:shadow-md lg:p-7">
    <div
      className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110 ${iconBg}`}
    >
      {icon}
    </div>
    <p className="text-textDim mb-1.5 h-6 overflow-hidden text-[10px] font-black tracking-widest text-ellipsis whitespace-nowrap uppercase lg:text-[11px]">
      {label}
    </p>
    <div className="mb-auto min-h-14">
      <h4
        className={`font-display w-full font-black tracking-tighter ${color} ${valueSize} ${truncate ? "overflow-hidden text-ellipsis whitespace-nowrap" : "wrap-break-word"}`}
        title={value}
      >
        {value}
      </h4>
    </div>
    <p className="text-textDim mt-2 text-[11px] font-medium">{sub}</p>
    <div
      className={`absolute -right-2 -bottom-2 h-12 w-12 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-40 ${iconBg.replace("/10", "/60")}`}
    />
  </div>
);

export default Performance;
