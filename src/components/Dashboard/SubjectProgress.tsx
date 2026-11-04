import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { usePerformanceStore } from "../../Store/usePerformanceStore";
import { useUserStore } from "../../Store/useUserStore";
import {
  useSubjectStore,
  SUBJECT_COMBO_MAP,
} from "../../Store/useSubjectStore";
import {
  BookOpen,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  RefreshCw,
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  BarChart3,
  Landmark,
  Church,
  Moon,
  Briefcase,
} from "lucide-react";

const getSubjectIcon = (subject: string) => {
  const icons: Record<string, React.ElementType> = {
    English: BookOpen,
    Mathematics: Calculator,
    Physics: Zap,
    Chemistry: FlaskConical,
    Biology: Dna,
    Economics: BarChart3,
    Government: Landmark,
    "Literature in English": BookOpen,
    CRS: Church,
    IRS: Moon,
    Commerce: Briefcase,
  };
  const Icon = icons[subject] || BookOpen;
  return <Icon size={20} />;
};

const LOADING_MESSAGES = [
  "Fetching your subject progress...",
  "Still loading... Checking performance history.",
  "Almost there! Wrapping up your statistics.",
];

const SubjectProgress: React.FC = () => {
  const navigate = useNavigate();
  const {
    topicStats,
    isLoading,
    mockHistory,
    hasFetched,
    loadPerformanceData,
  } = usePerformanceStore();
  const { subjectCombo } = useUserStore();
  const { subjects } = useSubjectStore();

  const [_loadingStep, setLoadingStep] = useState(0);
  const [isTimeoutError, setIsTimeoutError] = useState(false);

  const isWaiting = isLoading && !hasFetched;

  useEffect(() => {
    let messageTimer: ReturnType<typeof setInterval>;
    let errorTimer: ReturnType<typeof setTimeout>;

    if (isWaiting) {
      setIsTimeoutError(false);
      setLoadingStep(0);

      messageTimer = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < LOADING_MESSAGES.length - 1) return prev + 1;
          clearInterval(messageTimer);
          return prev;
        });
      }, 4000);

      errorTimer = setTimeout(() => {
        setIsTimeoutError(true);
        clearInterval(messageTimer);
      }, 15000);
    }

    return () => {
      clearInterval(messageTimer);
      clearTimeout(errorTimer);
    };
  }, [isWaiting]);

  const handleRetry = () => {
    setIsTimeoutError(false);
    setLoadingStep(0);
    loadPerformanceData(true);
  };

  const userSubjects = Array.isArray(subjectCombo)
    ? subjectCombo
    : subjectCombo
      ? SUBJECT_COMBO_MAP[subjectCombo] || [subjectCombo]
      : [];

  const comboWeakestTopics = topicStats.filter(
    (t) =>
      userSubjects.some((s) => s.toLowerCase() === t.subject.toLowerCase()) &&
      t.accuracy < 50,
  );

  const hasActivity = mockHistory.length > 0 || topicStats.length > 0;

  // ── Static header chrome (always rendered) — with scoped body content below
  return (
    <div className="bg-bgCard border-borderMuted rounded-brand-xl shadow-card shadow-brand/10 flex h-full flex-col border p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-brand text-[10px] font-black tracking-[0.35em] uppercase">
            Weakest Topics
          </span>
          <p className="text-textDim text-[11px] font-medium">
            One critical area from each of your subjects
          </p>
        </div>
        <button
          onClick={() => navigate("/performance")}
          className="text-brand hover:text-brand-light group inline-flex items-center gap-1.5 text-xs font-bold tracking-[0.18em] uppercase"
        >
          View all
          <ArrowRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </button>
      </div>

      {/* ── 1. Timeout error (shown after 15s of waiting) ────────────────── */}
      {isWaiting && isTimeoutError && (
        <div className="flex h-full flex-1 flex-col items-center justify-center py-6 text-center">
          <div className="bg-danger/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <AlertTriangle className="text-danger h-6 w-6" />
          </div>
          <h3 className="font-display text-textMain mb-2 font-bold">
            Slow Network Detected
          </h3>
          <p className="text-textDim mb-6 max-w-60 text-sm">
            Your connection seems weak. Taking longer than usual to load your
            progress.
          </p>
          <button
            onClick={handleRetry}
            className="bg-brand hover:bg-brand-light flex items-center gap-2 rounded-full px-6 py-2 text-sm font-bold text-white transition-all active:scale-95"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* ── 2. Loading skeleton (while fetch is in progress) ──────────────── */}
      {isWaiting && !isTimeoutError && (
        <div className="custom-scrollbar space-y-3 overflow-y-auto pr-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-bgSurface/40 border-borderMuted flex items-center gap-3 rounded-[1.5rem] border p-4"
            >
              <div className="bg-bgCard skeleton-shimmer flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="bg-bgCard skeleton-shimmer h-4 w-36 rounded" />
                <div className="bg-bgCard skeleton-shimmer h-3 w-24 rounded" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="bg-bgCard skeleton-shimmer h-6 w-12 rounded-full" />
                <div className="bg-bgTrack skeleton-shimmer h-2.5 w-24 overflow-hidden rounded-full">
                  <div
                    className="bg-bgCard skeleton-shimmer h-full rounded-full"
                    style={{ width: `${25 + i * 15}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 3. No activity (only shown after fetch confirmed complete) ────── */}
      {!isWaiting && !hasActivity && (
        <div className="flex h-full flex-1 flex-col items-center justify-center py-6 text-center">
          <div className="bg-brand/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <BookOpen className="text-brand h-6 w-6" />
          </div>
          <h3 className="font-display text-textMain mb-2 font-bold">
            No Exam Taken Yet
          </h3>
          <p className="text-textDim mb-6 max-w-60 text-sm">
            Take your first mock exam to unlock your personalized progress
            tracking.
          </p>
          <button
            onClick={() => navigate("/mock-exams")}
            className="bg-brand hover:bg-brand-light rounded-full px-6 py-2 text-sm font-bold text-white transition-all active:scale-95"
          >
            Take Mock Exam
          </button>
        </div>
      )}

      {/* ── 4. All topics mastered ───────────────────────────────────────── */}
      {!isWaiting && hasActivity && comboWeakestTopics.length === 0 && (
        <div className="flex h-full flex-1 flex-col items-center justify-center py-6 text-center">
          <div className="bg-success/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <CheckCircle className="text-success h-6 w-6" />
          </div>
          <h3 className="font-display text-textMain mb-2 font-bold">
            All Topics Mastered!
          </h3>
          <p className="text-textDim mb-6 max-w-60 text-sm">
            You've reached over 50% accuracy in all your topics. Ready for the
            exam!
          </p>
          <button
            onClick={() => navigate("/mock-exams")}
            className="bg-success hover:bg-success-light rounded-full px-6 py-2 text-sm font-bold text-white transition-all active:scale-95"
          >
            Final Mock Exam
          </button>
        </div>
      )}

      {/* ── 5. Weakest topics list (real data) ───────────────────────────── */}
      {!isWaiting && hasActivity && comboWeakestTopics.length > 0 && (
        <div className="custom-scrollbar space-y-3 overflow-y-auto pr-1">
          {comboWeakestTopics.map((item, index) => {
            const subjectData = subjects.find((s) => s.name === item.subject);
            const progressColor =
              item.accuracy < 30 ? "var(--color-danger)" : "var(--color-warn)";

            const accuracy = Math.max(0, Math.min(100, item.accuracy));

            return (
              <div key={`${item.subject}-${item.name}-${index}`}>
                <button
                  type="button"
                  className="group w-full text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brand/10 focus-visible:ring-brand rounded-[1.5rem] focus-visible:ring-2 focus-visible:outline-none"
                  onClick={() =>
                    navigate(`/quiz?${new URLSearchParams({
                      subject: item.subject,
                      topic: item.name,
                      mode: "quick",
                    }).toString()}`)
                  }
                  aria-label={`Practice ${item.name} in ${item.subject}, ${Math.round(accuracy)} percent accuracy`}
                >
                  <div className="group-hover:border-brand/40 bg-bgCard/90 border-borderMuted grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-[1.5rem] border p-4 shadow-sm transition-all">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                        style={{
                          background: `color-mix(in srgb, ${subjectData?.color || "var(--color-brand)"} 24%, transparent)`,
                          color: subjectData?.color || "var(--color-brand)",
                        }}
                      >
                        {getSubjectIcon(item.subject)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-textMain group-hover:text-brand truncate text-sm font-bold transition-colors">
                          {item.subject}
                        </p>
                        <p className="text-textDim mt-0.5 truncate text-xs">
                          Weak topic: {item.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-14 flex-col items-end">
                      <span className="font-display text-textMain text-lg leading-none font-bold tabular-nums">
                        {Math.round(accuracy)}%
                      </span>
                      <span className="text-textDim mt-1 text-[9px] font-semibold tracking-wide uppercase">
                        accuracy
                      </span>
                    </div>
                    <div
                      className="bg-bgTrack col-span-2 h-1.5 overflow-hidden rounded-full"
                      role="progressbar"
                      aria-label={`${item.subject} topic accuracy`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(accuracy)}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          background: progressColor,
                          width: `${accuracy}%`,
                        }}
                      />
                    </div>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SubjectProgress;
