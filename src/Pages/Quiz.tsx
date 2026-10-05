import React, { useEffect, useState, useMemo } from "react";
import PageHelmet from "../components/SEO/PageHelmet";
import { useNavigate, useLocation } from "react-router";
import AppLayout from "../components/Layout/AppLayout";
import { useQuizStore } from "../Store/useQuizStore";
import QuestionCard from "../components/Quiz/QuestionCard";
import TimerBar from "../components/Quiz/TimeBar";
import ResultsScreen from "../components/Quiz/ResultScreen";
import Button from "../components/ui/Button";
import { getSubjectIcon, getSubjectColor } from "../lib/subjectMeta";

import {
  fetchQuestionsByTopic,
  fetchQuestionsWithFallback,
  LIKELY_TOPICS,
  getRecentlySeenQuestionIds, // NEW
  recordSeenQuestions, // NEW
} from "../Services/questionService";
import {
  Loader2,
  BookOpen,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  NotebookPen,
  Zap,
  Target,
  Infinity as InfinityIcon,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import LoadingScreen from "../components/ui/LoadingScreen";
import { useOfflineStore } from "../Store/useOfflineStore";
import type { Question } from "../Types";

/** Subject filter options shown on the quiz start screen with icons and colors */
const QUIZ_SUBJECTS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Government",
  "Literature",
  "History",
  "Geography",
  "CRS",
  "IRS",
  "Commerce",
].map((name) => {
  const Icon = getSubjectIcon(name);
  return {
    name,
    icon: <Icon className="h-6 w-6" />,
    color: getSubjectColor(name),
  };
});

const Quiz: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedMode, setSelectedMode] = useState<
    "quick" | "standard" | "marathon"
  >("standard");

  const topicsRef = React.useRef<HTMLDivElement>(null);

  const {
    questions,
    currentIndex,
    isStarted,
    selectedSubject,
    setSelectedSubject,
    selectedTopic,
    setSelectedTopic,
    selectedDifficulty,
    setSelectedDifficulty,
    loadQuestions,
    reset,
    resetProgress, // NEW
    isFinished,
    setSubjectAndTopic,
  } = useQuizStore();

  // NOTE: We no longer reset on mount, so we can resume the quiz if the user refreshes!

  // ── Handle Incoming Navigation Parameters ───────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const subjectParam = params.get("subject");
    const topicParam = params.get("topic");

    if (subjectParam) {
      const decodedSubject = decodeURIComponent(subjectParam);
      const decodedTopic = topicParam ? decodeURIComponent(topicParam) : "All";

      // First reset any existing quiz state to clear the timer
      reset();

      // Then set the new subject and topic
      setSubjectAndTopic(decodedSubject, decodedTopic);
    }
  }, [location.search, setSubjectAndTopic, reset]);

  const subjectsMaster = useMemo(
    () =>
      QUIZ_SUBJECTS.map((s) => ({
        name: s.name,
        topics: LIKELY_TOPICS[s.name] ?? [],
      })),
    [],
  );

  const currentSubjectData = useMemo(() => {
    return subjectsMaster.find((s) => s.name === selectedSubject);
  }, [selectedSubject, subjectsMaster]);

  const availableTopics = useMemo(() => {
    if (currentSubjectData?.topics && currentSubjectData.topics.length > 0) {
      return currentSubjectData.topics.filter((t) => t !== "All");
    }
    return [];
  }, [currentSubjectData]);

  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showSlowNetworkWarning, setShowSlowNetworkWarning] = useState(false);

  // ── Reorder Subjects based on selection ───────────────────
  const sortedQuizSubjects = useMemo(() => {
    if (!selectedSubject || selectedSubject === "All") return QUIZ_SUBJECTS;

    const selected = QUIZ_SUBJECTS.find((s) => s.name === selectedSubject);
    if (!selected) return QUIZ_SUBJECTS;

    const remaining = QUIZ_SUBJECTS.filter((s) => s.name !== selectedSubject);
    return [selected, ...remaining];
  }, [selectedSubject]);

  const visibleSubjects = showAllSubjects
    ? sortedQuizSubjects
    : sortedQuizSubjects.slice(0, 6);

  useEffect(() => {
    if (isFinished) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [isFinished]);

  useEffect(() => {
    return () => {
      const state = useQuizStore.getState();
      if (state.isFinished) {
        state.reset();
      }
    };
  }, []);

  /** Reset topic when subject changes, UNLESS coming from a URL param */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (!params.get("topic")) {
      setSelectedTopic("All");
    }

    if (selectedSubject && selectedSubject !== "All") {
      setTimeout(() => {
        topicsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [selectedSubject, setSelectedTopic, location.search]);

  useEffect(
    () => () => {
      // Resetting is now handled by the user explicitly finishing or exiting the quiz.
    },
    [],
  );

  if (isLoadingQuestions) {
    return (
      <>
        <PageHelmet
          title="Quiz | SCHOOLDRA"
          description="Take adaptive practice quizzes to sharpen your JAMB UTME readiness, with instant feedback and performance tracking."
          canonical="https://www.schooldra.com/quiz"
        />
        <LoadingScreen
          message="Preparing your quiz"
          variant="quiz"
          submessage={`Fetching ${selectedSubject} questions for your practice session...`}
          estimatedTime={2}
          showSlowNetworkWarning={showSlowNetworkWarning}
          onCancel={() => {
            setIsLoadingQuestions(false);
          }}
        />
      </>
    );
  }

  const handleStart = async () => {
    if (selectedSubject === "All") return;

    setShowExitModal(false);
    setLoadError(null);
    setIsLoadingQuestions(true);
    setShowSlowNetworkWarning(false);

    const slowNetworkTimer = setTimeout(() => {
      setShowSlowNetworkWarning(true);
    }, 5000);

    const isMarathon = selectedMode === "marathon";
    const adjustedTopic = isMarathon ? "All" : selectedTopic;
    const adjustedDifficulty = isMarathon ? "All" : selectedDifficulty;
    const targetCount = isMarathon ? 100 : selectedMode === "quick" ? 10 : 20;

    await new Promise((r) => setTimeout(r, 100));

    try {
      const isOnline = navigator.onLine;
      const offlineStore = useOfflineStore.getState();

      let qs: Question[] = [];

      if (!isOnline) {
        console.log("📴 User is offline. Checking local cache...");
        const packs = offlineStore.downloadedPacks.filter((p) =>
          p.startsWith(selectedSubject.toLowerCase().slice(0, 3)),
        );
        if (packs.length > 0) {
          const offlineQs = await offlineStore.getOfflineQuestions(packs[0]);
          if (offlineQs.length > 0) {
            qs = offlineQs
              .sort(() => Math.random() - 0.5)
              .slice(0, targetCount);
            console.log("✅ Loaded questions from offline pack:", packs[0]);
          }
        }

        if (qs.length === 0) {
          throw new Error(
            "OFFLINE: You need an internet connection to load new questions, and no offline packs were found for this subject.",
          );
        }
      }

      if (qs.length === 0) {
        // NEW — fetch this user's recently-seen question IDs for this subject
        // so we don't hand back questions they've already answered.
        // Skipped for marathon: it draws from the whole subject anyway,
        // and excluding IDs there would only slow down a 100-question pull.
        const recentIds = !isMarathon
          ? await getRecentlySeenQuestionIds(selectedSubject, adjustedTopic) // NEW: pass topic
          : [];

        try {
          if (adjustedTopic === "All") {
            qs = await fetchQuestionsWithFallback(
              selectedSubject,
              "Random",
              targetCount,
              adjustedDifficulty,
              recentIds, // NEW
            );
          } else {
            qs = await fetchQuestionsByTopic(
              selectedSubject,
              adjustedTopic,
              targetCount,
              adjustedDifficulty,
              recentIds, // NEW
            );

            if (qs.length < targetCount) {
              console.log(
                `⚠️ Only found ${qs.length} questions for topic "${adjustedTopic}". Filling remaining ${targetCount - qs.length} from subject.`,
              );

              const remainingCount = targetCount - qs.length;
              const fallbackQs = await fetchQuestionsWithFallback(
                selectedSubject,
                "Random",
                remainingCount * 2,
                adjustedDifficulty,
                recentIds, // NEW
              );

              const existingIds = new Set(qs.map((q) => q.id));
              const uniqueFallback = fallbackQs.filter(
                (q) => !existingIds.has(q.id),
              );

              qs = [...qs, ...uniqueFallback].slice(0, targetCount);
            }
          }
        } catch (err) {
          console.error("Fetch error:", err);
          throw new Error(
            "CONNECTION_ERROR: Failed to fetch questions. Please check your internet connection and try again.",
          );
        }
      }

      // Final check: if still empty or not enough, try one last broad sweep
      // (deliberately no exclusion here — this is the "give the user *something*"
      // safety net, so repeats are allowed only as an absolute last resort)
      if (qs.length < targetCount) {
        const lastResort = await fetchQuestionsWithFallback(
          selectedSubject,
          "Random",
          targetCount * 2,
          "All",
        );

        const existingIds = new Set(qs.map((q) => q.id));
        const uniqueLastResort = lastResort.filter(
          (q) => !existingIds.has(q.id),
        );
        qs = [...qs, ...uniqueLastResort].slice(0, targetCount);
      }

      if (qs.length === 0) {
        throw new Error(
          "NO_QUESTIONS: Could not find any questions for this selection. Try a different subject or year.",
        );
      }

      if (qs.length > targetCount) {
        qs = qs.slice(0, targetCount);
      }

      // NEW — fire-and-forget: don't await, so logging what was seen
      // never delays the quiz from starting.
      recordSeenQuestions(
        selectedSubject,
        qs.map((q) => q.id),
        adjustedTopic,
      ).catch(() => {}); // NEW: pass topic

      const duration = isMarathon
        ? 15 * 60
        : selectedMode === "quick"
          ? 10 * 60
          : 30 * 60;
      loadQuestions(qs, duration);
    } catch (error) {
      console.error("Failed to load quiz questions:", error);
      setLoadError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      clearTimeout(slowNetworkTimer);
      setIsLoadingQuestions(false);
      setShowSlowNetworkWarning(false);
    }
  };

  /* ── Results ───────────────────────────────────────── */
  if (showResults || isFinished) {
    return (
      <AppLayout
        currentPage="quiz"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      >
        <PageHelmet
          title="Quiz Results | SCHOOLDRA"
          description="Review your recent quiz results, retry questions, and view detailed performance insights to improve for JAMB UTME."
          canonical="https://www.schooldra.com/quiz"
        />
        <ResultsScreen
          onRetry={() => {
            resetProgress();
            handleStart();
          }}
          onHome={() => {
            reset();
            navigate("/dashboard");
          }}
          onPerformance={() => {
            reset();
            navigate("/performance");
          }}
        />
      </AppLayout>
    );
  }

  /* ── Active quiz ───────────────────────────────────── */
  if (isStarted && questions.length > 0) {
    return (
      <AppLayout
        currentPage="quiz"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      >
        <PageHelmet
          title="Quiz (In Progress) | SCHOOLDRA"
          description="Continue your active quiz session — answer questions under timed conditions and track your ongoing performance."
          canonical="https://www.schooldra.com/quiz"
        />
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setShowExitModal(true)}
            className="bg-bgCard border-borderMuted text-textMain hover:border-danger/30 hover:text-danger touch-target no-double-tap flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span>Exit Quiz</span>
          </button>

          <div className="flex flex-1 items-center justify-center gap-1">
            {questions.length <= 30 ? (
              questions.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === currentIndex ? "20px" : "6px",
                    height: "6px",
                    background:
                      i < currentIndex
                        ? "var(--color-success, #00C896)"
                        : i === currentIndex
                          ? "#7B5FFF"
                          : "var(--borderMuted)",
                  }}
                />
              ))
            ) : (
              <div className="text-textDim flex items-center gap-2 text-xs font-medium">
                <span>
                  {Math.round(((currentIndex + 1) / questions.length) * 100)}%
                  Complete
                </span>
              </div>
            )}
          </div>

          <span className="text-textDim shrink-0 font-mono text-xs">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>

        <TimerBar />
        <QuestionCard />

        {showExitModal && (
          <div className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm dark:bg-black/80">
            <div className="bg-bgCard border-borderMuted rounded-brand-xl animate-slideDown w-full max-w-sm border p-6 shadow-2xl">
              <h3 className="font-display text-textMain mb-2 text-xl font-bold">
                Quit Quiz?
              </h3>
              <p className="text-textMuted mb-6 text-sm">
                Your progress will be lost. Are you sure you want to exit the
                current session?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowExitModal(false)}
                  className="rounded-brand bg-bgSurface hover:bg-bgDeep text-textMain touch-target no-double-tap flex-1 py-3 font-medium transition-colors active:scale-95"
                >
                  Stay
                </button>
                <button
                  onClick={reset}
                  className="rounded-brand bg-danger hover:bg-danger/80 touch-target no-double-tap flex-1 py-3 font-medium text-white transition-colors active:scale-95"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </AppLayout>
    );
  }

  /* ── Start screen ──────────────────────────────────── */
  return (
    <AppLayout
      currentPage="quiz"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Quiz | SCHOOLDRA"
        description="Take adaptive practice quizzes to sharpen your JAMB UTME readiness, with instant feedback and performance tracking."
        canonical="https://www.schooldra.com/quiz"
      />
      <div className="mx-auto max-w-2xl">
        {(loadError?.includes("CONNECTION_ERROR") ||
          loadError?.includes("OFFLINE")) && (
          <div className="bg-warning/10 border-warning/30 animate-in fade-in slide-in-from-top-4 mb-6 flex flex-col gap-3 rounded-xl border p-4 duration-300 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-warning/15 text-warning flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-textMain text-sm font-semibold">
                  Unable to load questions
                </p>
                <p className="text-textDim mt-0.5 text-xs">{loadError}</p>
              </div>
            </div>
            <div className="flex gap-2 sm:flex-col-reverse">
              <button
                onClick={() => setLoadError(null)}
                className="bg-bgSurface hover:bg-bgCard text-textMuted hover:text-textMain rounded-lg px-3 py-2 text-xs font-bold transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setLoadError(null);
                  handleStart();
                }}
                className="bg-warning hover:bg-warning/90 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 sm:w-auto"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          </div>
        )}

        {loadError &&
          !loadError.includes("CONNECTION_ERROR") &&
          !loadError.includes("OFFLINE") && (
            <div className="animate-in fade-in slide-in-from-top-4 bg-danger/15 border-danger/30 text-danger dark:bg-danger/10 mb-6 rounded-2xl border p-5 shadow-sm duration-300">
              <div className="flex items-start gap-3">
                <div className="bg-danger/20 text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-danger text-sm font-black tracking-tight">
                    System Alert
                  </p>
                  <p className="text-danger/90 mt-1 text-xs leading-relaxed font-medium">
                    {loadError}
                  </p>
                  <button
                    onClick={() => setLoadError(null)}
                    className="bg-danger/10 hover:bg-danger/20 text-danger mt-3 rounded-lg px-3 py-1.5 text-[10px] font-black tracking-widest uppercase transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="mb-10 pt-4 text-center">
          <div className="bg-brand/10 border-brand/20 text-brand mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border">
            <NotebookPen size={28} />
          </div>
          <h2 className="font-display mb-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Practice Quiz
          </h2>
          <p className="text-textMuted mx-auto max-w-sm text-sm">
            {selectedMode === "quick" &&
              "10 adaptive questions · 60 seconds each · Instant explanations"}
            {selectedMode === "standard" &&
              "20 adaptive questions · 90 seconds each · Instant explanations"}
            {selectedMode === "marathon" &&
              "Unlimited adaptive questions · 15 minutes total · Instant explanations"}
          </p>
        </div>

        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-textDim flex items-center gap-2 text-[11px] font-black tracking-widest uppercase">
              <BookOpen size={14} className="text-brand" />
              1. Select Subject
            </p>
            <button
              onClick={() => setShowAllSubjects(!showAllSubjects)}
              className="text-brand hover:text-brand-light hidden text-[10px] font-black tracking-widest uppercase transition-colors sm:block"
            >
              {showAllSubjects ? "Show Less" : "Show All"}
            </button>
          </div>

          <div className="flex scrollbar-none gap-2 overflow-x-auto pb-2 sm:hidden">
            {sortedQuizSubjects.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedSubject(s.name)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-5 py-3 text-xs font-bold transition-all active:scale-95 ${
                  selectedSubject === s.name
                    ? "bg-brand border-brand shadow-brand/20 text-white shadow-lg"
                    : "bg-bgCard text-textMain border-borderMuted hover:border-brand/30 dark:hover:border-brand/40 hover:shadow-sm"
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>

          <div className="hidden grid-cols-3 gap-3 sm:grid">
            {visibleSubjects.map((s) => (
              <button
                key={s.name}
                onClick={() => setSelectedSubject(s.name)}
                className={`group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border p-4 transition-all active:scale-95 ${
                  selectedSubject === s.name
                    ? "bg-brand border-brand shadow-brand/20 -translate-y-1 shadow-xl"
                    : "bg-bgCard border-borderMuted hover:border-brand/30 dark:hover:border-brand/40 dark:hover:bg-bgSurface hover:shadow-sm"
                }`}
              >
                {selectedSubject === s.name && (
                  <div
                    className={`absolute inset-0 bg-linear-to-br opacity-20 ${s.color}`}
                  />
                )}

                <span
                  className={`mb-2 text-3xl transition-transform duration-300 group-hover:scale-110 ${selectedSubject === s.name ? "scale-110" : ""}`}
                >
                  {s.icon}
                </span>
                <span
                  className={`text-xs font-bold tracking-tight transition-colors ${selectedSubject === s.name ? "text-white" : "text-textMain"}`}
                >
                  {s.name}
                </span>

                {selectedSubject === s.name && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 size={12} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedSubject !== "All" && selectedMode !== "marathon" && (
          <div
            ref={topicsRef}
            className="animate-in fade-in slide-in-from-bottom-4 mb-10 duration-500"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-textDim flex items-center gap-2 text-[11px] font-black tracking-widest uppercase">
                <Layers size={14} className="text-brand" />
                2. Choose Topic
              </p>
              <span className="bg-brand/10 text-brand rounded-full px-2 py-0.5 text-[10px] font-bold">
                {availableTopics.length + 1} Topics Found
              </span>
            </div>

            <div className="custom-scrollbar grid max-h-75 grid-cols-1 gap-2 overflow-y-auto pr-2 sm:grid-cols-2">
              <button
                onClick={() => setSelectedTopic("All")}
                className={`relative overflow-hidden rounded-xl border px-4 py-4 text-left text-xs font-bold transition-all ${
                  selectedTopic === "All"
                    ? "bg-brand/10 border-brand text-brand ring-brand/30 ring-1"
                    : "bg-bgSurface text-textDim border-borderMuted hover:border-brand/30 hover:bg-bgCard"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${selectedTopic === "All" ? "bg-brand text-white" : "bg-bgDeep text-textDim"}`}
                  >
                    <Target size={16} />
                  </div>
                  <div>
                    <p
                      className={
                        selectedTopic === "All" ? "text-brand" : "text-textMain"
                      }
                    >
                      General (Mix)
                    </p>
                    <p className="text-[10px] font-medium opacity-60">
                      All available topics
                    </p>
                  </div>
                </div>
                {selectedTopic === "All" && (
                  <div className="bg-brand absolute top-1/2 right-3 h-1.5 w-1.5 -translate-y-1/2 animate-pulse rounded-full" />
                )}
              </button>

              {availableTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => setSelectedTopic(topic)}
                  className={`relative overflow-hidden rounded-xl border px-4 py-4 text-left text-xs font-bold transition-all ${
                    selectedTopic === topic
                      ? "bg-brand/10 border-brand text-brand ring-brand/30 ring-1"
                      : "bg-bgSurface text-textDim border-borderMuted hover:border-brand/30 hover:bg-bgCard"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg ${selectedTopic === topic ? "bg-brand text-white" : "bg-bgDeep text-textDim"}`}
                    >
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <p
                        className={`line-clamp-1 ${selectedTopic === topic ? "text-brand" : "text-textMain"}`}
                      >
                        {topic}
                      </p>
                      <p className="text-[10px] font-medium opacity-60">
                        Specific practice
                      </p>
                    </div>
                  </div>
                  {selectedTopic === topic && (
                    <div className="bg-brand absolute top-1/2 right-3 h-1.5 w-1.5 -translate-y-1/2 animate-pulse rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedSubject !== "All" && selectedMode !== "marathon" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 mb-10 duration-700">
            <p className="text-textDim mb-4 flex items-center gap-2 text-[11px] font-black tracking-widest uppercase">
              <Sparkles size={14} className="text-brand" />
              3. Select Difficulty
            </p>
            <div className="grid grid-cols-4 gap-2">
              {["All", "Easy", "Medium", "Hard"].map((d) => (
                <button
                  key={d}
                  onClick={() =>
                    setSelectedDifficulty(
                      d as "All" | "Easy" | "Medium" | "Hard",
                    )
                  }
                  className={`rounded-xl border py-3 text-[11px] font-bold transition-all active:scale-95 ${
                    selectedDifficulty === d
                      ? d === "Easy"
                        ? "bg-success/10 border-success text-success"
                        : d === "Medium"
                          ? "bg-warn/10 border-warn text-warn"
                          : d === "Hard"
                            ? "bg-danger/10 border-danger text-danger"
                            : "bg-brand/10 border-brand text-brand"
                      : "bg-bgCard border-borderMuted text-textDim hover:border-brand/20 dark:hover:border-white/20"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              id: "quick",
              Icon: Zap,
              label: "Quick Fire",
              desc: "10 Qs · 60s each",
            },
            {
              id: "standard",
              Icon: Target,
              label: "Standard",
              desc: "20 Qs · 90s each",
            },
            {
              id: "marathon",
              Icon: InfinityIcon,
              label: "Marathon Quiz",
              desc: "15 mins · Unlimited Qs",
            },
          ].map((mode) => (
            <div
              key={mode.id}
              onClick={() =>
                setSelectedMode(mode.id as "quick" | "standard" | "marathon")
              }
              className={`rounded-brand-lg cursor-pointer border p-4 transition-all ${
                selectedMode === mode.id
                  ? "bg-brand/10 border-brand shadow-brand/10 ring-brand/20 ring-1"
                  : "bg-bgSurface border-borderMuted hover:border-brand/20 dark:hover:border-white/15"
              }`}
            >
              <mode.Icon
                size={24}
                className={`mb-2 ${selectedMode === mode.id ? "text-brand" : "text-textDim"}`}
              />
              <p className="font-display text-sm font-semibold tracking-tight">
                {mode.label}
              </p>
              <p className="text-textDim mt-0.5 text-[11px]">{mode.desc}</p>
            </div>
          ))}
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleStart}
          disabled={isLoadingQuestions}
          className="shadow-brand/20 group relative overflow-hidden py-5 text-lg font-black shadow-xl"
        >
          {isLoadingQuestions ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin" />
          ) : (
            <>
              <span className="relative z-10">Start Practice Quiz</span>
              <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0"></div>
            </>
          )}
        </Button>
      </div>
    </AppLayout>
  );
};

export default Quiz;
