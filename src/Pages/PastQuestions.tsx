import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import AppLayout from "../components/Layout/AppLayout";
import { useUserStore } from "../Store/useUserStore";
// import { SUBJECT_COMBO_MAP } from "../Store/useSubjectStore";
import QuestionAIHelper from "../components/PastQuestions/QuestionAIHelper";
import ReportQuestionButton from "../components/shared/ReportQuestionButton";
import Button from "../components/ui/Button";
import ValidatedInput from "../components/ui/ValidatedInput";
import { truncateInput } from "../lib/validation";
import { renderQuestionText } from "../lib/utils/renderQuestionText";
import { ExplanationText } from "../components/shared/ExplanationText";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Lightbulb,
  CheckCircle2,
  ArrowUp,
  RefreshCw,
} from "lucide-react";
import type { Question } from "../Types";
import PageHelmet from "../components/SEO/PageHelmet";
import {
  fetchAllQuestionsForBrowse,
  fetchTopicsBySubject,
} from "../Services/questionService";
import ProGate from "../components/PastQuestions/ProGate";
import OfflinePackCard from "../components/PastQuestions/OfflinePackCard";
import { OFFLINE_PACKS } from "../Data/offlinePacks";
import SectionError from "../components/ui/SectionError";
import ErrorBanner from "../components/ui/ErrorBanner";

export interface Filters {
  subject: string;
  year: string;
  topic: string;
  difficulty: string;
  search: string;
}

const VALID_YEARS = [
  "All",
  "2025",
  "2024",
  "2023",
  "2022",
  "2021",
  "2020",
  "2019",
  "2018",
  "2017",
  "2016",
  "2015",
  "2014",
  "2013",
] as const;

// --- ALL SUBJECTS SORTED ALPHABETICALLY ---
const ALL_SUBJECTS = [
  "Biology",
  "Chemistry",
  "Commerce",
  "CRS",
  "Economics",
  "English",
  "Geography",
  "Government",
  "History",
  "IRS",
  "Literature",
  "Mathematics",
  "Physics",
].sort();

// FIX: this page used to default to "All Subjects", which meant every
// visit with no subject picked yet fetched every subject's entire
// question set at once — exactly the expensive unbounded-fetch pattern
// we already fixed elsewhere. Now a subject is always required; this is
// the fallback used when the URL doesn't specify one.
const DEFAULT_SUBJECT = ALL_SUBJECTS[0];

const SUBJECT_COLORS: Record<string, string> = {
  English: "#7B5FFF",
  Mathematics: "#00C896",
  Physics: "#FFB020",
  Chemistry: "#FF4D6D",
  Biology: "#00C896",
  Economics: "#7B5FFF",
  Government: "#FFB020",
  Literature: "#7B5FFF",
  History: "#FF4D6D",
  Geography: "#00C896",
  CRS: "#7B5FFF",
  IRS: "#00C896",
  Commerce: "#FFB020",
};

const PAGE_SIZE = 20;

const PastQuestions = () => {
  const { isPro } = useUserStore();

  const [searchParams, setSearchParams] = useSearchParams();

  const filters: Filters = useMemo(() => {
    const subjectParam = searchParams.get("subject");
    const yearParam = searchParams.get("year");
    const topicParam = searchParams.get("topic");
    const difficultyParam = searchParams.get("difficulty");
    const searchParam = searchParams.get("q");

    return {
      subject:
        subjectParam && ALL_SUBJECTS.includes(subjectParam)
          ? subjectParam
          : DEFAULT_SUBJECT,
      year:
        yearParam && (VALID_YEARS as readonly string[]).includes(yearParam)
          ? yearParam
          : "All",
      topic: topicParam || "All",
      difficulty: difficultyParam || "All",
      search: searchParam || "",
    };
  }, [searchParams]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [availableTopics, setAvailableTopics] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  // FIX: needed for the offline-guard and the "no results" condition
  // below — same reasoning as before, no UI attached to it beyond
  // gating existing conditions.
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // FIX: loadData (manual refresh) and the old useEffect's inline
  // loadDataEffect were two separate copies of the same fetch logic —
  // one had an isMounted guard, the other didn't. Merged into one
  // function guarded by a request id so a stale response can never
  // overwrite a newer one's state.
  const requestIdRef = useRef(0);

  const loadData = useCallback(
    async (isManual = false) => {
      const thisRequestId = ++requestIdRef.current;

      if (isManual) setIsManualRefreshing(true);
      setIsLoading(true);
      setLoadingError(null);
      setQuestions([]);

      // FIX: fail fast when we already know we're offline, instead of
      // trusting whatever the fetch promise resolves with. Uses the
      // exact same error state/copy as a normal fetch failure — no
      // new UI branch.
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (thisRequestId === requestIdRef.current) {
          setLoadingError("Failed to load questions. Please try again.");
          setIsLoading(false);
          if (isManual) {
            setTimeout(() => setIsManualRefreshing(false), 600);
          }
        }
        return;
      }

      try {
        const qs = await fetchAllQuestionsForBrowse(
          filters.subject,
          filters.year,
          filters.topic,
          filters.difficulty,
        );
        if (thisRequestId !== requestIdRef.current) return; // stale response
        setQuestions(qs as Question[]);
      } catch (e) {
        if (thisRequestId !== requestIdRef.current) return; // stale response
        console.error("Error loading questions:", e);
        setLoadingError("Failed to load questions. Please try again.");
      } finally {
        if (thisRequestId === requestIdRef.current) {
          setIsLoading(false);
          if (isManual) {
            setTimeout(() => setIsManualRefreshing(false), 600);
          }
        }
      }
    },
    [filters.subject, filters.year, filters.topic, filters.difficulty],
  );

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleManualRefresh = async () => {
    await loadData(true);
  };

  useEffect(() => {
    let isMounted = true;
    const loadTopics = async () => {
      const topics = await fetchTopicsBySubject(filters.subject);
      if (isMounted) setAvailableTopics(topics);
    };
    loadTopics();
    return () => {
      isMounted = false;
    };
  }, [filters.subject]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (!filters.search) return true;
      const search = filters.search.toLowerCase();
      return (
        q.text.toLowerCase().includes(search) ||
        q.topic.toLowerCase().includes(search)
      );
    });
  }, [questions, filters.search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredQuestions.length / PAGE_SIZE),
  );
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredQuestions.slice(start, start + PAGE_SIZE);
  }, [filteredQuestions, page]);

  const handleFilterChange = useCallback(
    (next: Partial<Filters>) => {
      const merged: Filters = {
        ...filters,
        ...next,
        ...(next.subject && next.subject !== filters.subject
          ? { topic: "All" }
          : {}),
      };

      const params = new URLSearchParams();
      params.set("subject", merged.subject);
      if (merged.year !== "All") params.set("year", merged.year);
      if (merged.topic !== "All") params.set("topic", merged.topic);
      if (merged.difficulty !== "All")
        params.set("difficulty", merged.difficulty);
      if (merged.search) params.set("q", merged.search);

      setSearchParams(params, { replace: false });
      setPage(1);
      setExpandedId(null);
    },
    [filters, setSearchParams],
  );

  if (!isPro) {
    return (
      <AppLayout
        currentPage="past-questions"
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      >
        <PageHelmet
          title="Past Questions | SCHOOLDRA"
          description="Practice real JAMB past questions from 2015 to 2025. Create an account to unlock full access to every year and subject."
          canonical="https://www.schooldra.com/past-questions"
        />
        <ProGate />
      </AppLayout>
    );
  }

  return (
    <AppLayout
      currentPage="past-questions"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Past Questions | SCHOOLDRA"
        description="Practice real JAMB past questions from 2015 to 2025. Create an account to unlock full access to every year and subject."
        canonical="https://www.schooldra.com/past-questions"
      />
      <div className="mx-auto max-w-5xl space-y-6 py-6">
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="bg-brand hover:bg-brand-light fixed right-5 bottom-36 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 lg:bottom-8 lg:left-8"
            aria-label="Scroll to top"
          >
            <ArrowUp size={20} className="text-white" />
          </button>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h1 className="font-display text-textMain text-2xl font-bold tracking-tight lg:text-3xl">
                Past Questions
              </h1>
              <span className="border-warn/25 bg-warn/10 text-warn rounded-full border px-2.5 py-1 text-[10px] font-bold">
                PRO
              </span>
            </div>
            <p className="text-textDim text-sm">
              Practice real JAMB past questions from 2015 to 2025
            </p>
          </div>

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
                className={`h-2 w-2 rounded-full ${loadingError ? "bg-warning" : isLoading ? "bg-brand animate-pulse" : "bg-success animate-pulse"}`}
              />
              {loadingError
                ? "Error loading"
                : isLoading
                  ? "LOADING..."
                  : "LIVE DATA SYNCED"}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-bgCard border-borderMuted space-y-4 rounded-2xl border p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-textDim text-xs font-semibold tracking-wider uppercase">
                Subject
              </label>
              <select
                value={filters.subject}
                onChange={(e) =>
                  handleFilterChange({ subject: e.target.value })
                }
                className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border px-4 py-2.5 focus:ring-2 focus:outline-none"
              >
                {ALL_SUBJECTS.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-textDim text-xs font-semibold tracking-wider uppercase">
                Year
              </label>
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange({ year: e.target.value })}
                className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border px-4 py-2.5 focus:ring-2 focus:outline-none"
              >
                {VALID_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y === "All" ? "All Years" : y}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-textDim text-xs font-semibold tracking-wider uppercase">
                Topic
              </label>
              <select
                value={filters.topic}
                onChange={(e) => handleFilterChange({ topic: e.target.value })}
                className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border px-4 py-2.5 focus:ring-2 focus:outline-none"
              >
                <option value="All">All Topics</option>
                {availableTopics.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-textDim text-xs font-semibold tracking-wider uppercase">
                Search
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="text-textDim absolute top-1/2 left-4 -translate-y-1/2"
                />
                <ValidatedInput
                  value={filters.search}
                  onChange={(v) =>
                    handleFilterChange({ search: truncateInput(v, 200) })
                  }
                  placeholder="Search..."
                  className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border py-2.5 pr-4 pl-12 focus:ring-2 focus:outline-none"
                />
                {filters.search && (
                  <button
                    onClick={() => handleFilterChange({ search: "" })}
                    className="text-textDim hover:text-textMain absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {(() => {
          const matchingPack = OFFLINE_PACKS.find(
            (p) => p.subject === filters.subject,
          );
          if (!matchingPack) return null; // all 13 subjects are covered now, this is just a safety fallback
          return <OfflinePackCard pack={matchingPack} />;
        })()}

        {/* Loading State — scoped to data sections only, or SectionError on failure */}
        {isLoading && questions.length === 0 ? (
          <>
            <div className="flex items-center justify-between">
              <div className="bg-bgSurface skeleton-shimmer h-4 w-40 rounded" />
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map((q) => (
                <div
                  key={q}
                  className="bg-bgCard border-borderMuted overflow-hidden rounded-2xl border p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-bgSurface skeleton-shimmer flex h-10 w-10 shrink-0 items-center justify-center rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <div className="bg-bgSurface skeleton-shimmer h-5 w-20 rounded-full" />
                        <div className="bg-bgSurface skeleton-shimmer h-4 w-16 rounded" />
                        <div className="bg-bgSurface skeleton-shimmer h-4 w-20 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="bg-bgSurface skeleton-shimmer h-5 w-full rounded" />
                        <div className="bg-bgSurface skeleton-shimmer h-5 w-5/6 rounded" />
                        <div className="bg-bgSurface skeleton-shimmer h-5 w-2/3 rounded" />
                      </div>
                    </div>
                    <div className="bg-bgSurface skeleton-shimmer h-5 w-5 shrink-0 rounded" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4">
              <div className="bg-bgSurface skeleton-shimmer h-10 w-28 rounded-xl" />
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((p) => (
                  <div
                    key={p}
                    className="bg-bgSurface skeleton-shimmer h-10 w-10 rounded-xl"
                  />
                ))}
              </div>
              <div className="bg-bgSurface skeleton-shimmer h-10 w-28 rounded-xl" />
            </div>
          </>
        ) : loadingError && questions.length === 0 ? (
          <SectionError
            message={loadingError || ""}
            onRetry={handleManualRefresh}
            isRetrying={isManualRefreshing}
          />
        ) : null}

        {/* Error Banner */}
        {loadingError && questions.length > 0 && (
          <ErrorBanner
            message={loadingError || ""}
            onRetry={handleManualRefresh}
            isRetrying={isManualRefreshing}
          />
        )}

        {/* No Results — FIX: added `isOnline` so this can never render
            as a stand-in for a failed offline fetch */}
        {!isLoading && !loadingError && isOnline && paginated.length === 0 && (
          <div className="bg-bgCard border-borderMuted rounded-2xl border p-12 text-center">
            <div className="mb-4 text-5xl">📚</div>
            <h3 className="text-textMain mb-2 text-xl font-bold">
              No questions found
            </h3>
            <p className="text-textDim mb-6">
              Try adjusting your filters to find questions
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                handleFilterChange({
                  subject: DEFAULT_SUBJECT,
                  year: "All",
                  topic: "All",
                  difficulty: "All",
                  search: "",
                })
              }
            >
              Reset Filters
            </Button>
          </div>
        )}

        {/* Questions List */}
        {!isLoading && paginated.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-textDim text-sm">
                Showing{" "}
                <span className="text-textMain font-semibold">
                  {paginated.length}
                </span>{" "}
                of{" "}
                <span className="text-textMain font-semibold">
                  {filteredQuestions.length}
                </span>{" "}
                questions
              </p>
            </div>

            <div className="space-y-4">
              {paginated.map((q, idx) => {
                const color = SUBJECT_COLORS[q.subject] || "#7B5FFF";
                const isExpanded = expandedId === q.id;
                const questionNum = (page - 1) * PAGE_SIZE + idx + 1;

                return (
                  <div
                    key={q.id}
                    className="bg-bgCard border-borderMuted overflow-hidden rounded-2xl border transition-all"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="w-full p-5 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold"
                          style={{ backgroundColor: `${color}20`, color }}
                        >
                          {questionNum}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {q.subject}
                            </span>
                            <span className="text-textDim flex items-center gap-1 text-xs">
                              <Calendar size={14} /> {q.year}
                            </span>
                            <span className="text-textDim flex items-center gap-1 text-xs">
                              <Lightbulb size={14} /> {q.difficulty}
                            </span>
                          </div>
                          <p className="text-textMain leading-relaxed font-medium">
                            {renderQuestionText(q.text, q.subject)}
                          </p>
                        </div>
                        <ChevronRight
                          size={20}
                          className={`text-textDim shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                        />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-borderMuted border-t px-5 pt-1 pb-5">
                        {q.instruction && (
                          <div className="bg-bgSurface mb-4 rounded-xl p-4">
                            <p className="text-textDim text-sm">
                              <span className="text-textMain font-semibold">
                                Instruction:{" "}
                              </span>
                              {q.instruction}
                            </p>
                          </div>
                        )}

                        <div className="mb-4 space-y-2.5">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className={`flex items-center gap-3 rounded-xl border p-4 ${
                                optIdx === q.answer
                                  ? "border-success/30 bg-success/5"
                                  : "border-borderMuted bg-bgSurface"
                              }`}
                            >
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  optIdx === q.answer
                                    ? "bg-success text-white"
                                    : "bg-bgCard border-borderMuted text-textDim border"
                                }`}
                              >
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span
                                className={
                                  optIdx === q.answer
                                    ? "text-textMain font-semibold"
                                    : "text-textDim"
                                }
                              >
                                {renderQuestionText(opt, q.subject)}
                              </span>
                              {optIdx === q.answer && (
                                <CheckCircle2
                                  size={18}
                                  className="text-success ml-auto"
                                />
                              )}
                            </div>
                          ))}
                        </div>

                        <h5 className="text-brand-light mb-1 text-sm font-semibold">
                          Explanation
                        </h5>
                        <p className="text-textMain text-sm">
                          <ExplanationText text={q.explanation} />
                        </p>
                        <QuestionAIHelper question={q} />
                      </div>
                    )}
                    <ReportQuestionButton
                      questionId={q.id}
                      context="past-questions"
                    />
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft size={16} /> Previous
                </Button>
                <p className="text-textDim text-sm">
                  Page{" "}
                  <span className="text-textMain font-semibold">{page}</span> of{" "}
                  <span className="text-textMain font-semibold">
                    {totalPages}
                  </span>
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-2"
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default PastQuestions;
