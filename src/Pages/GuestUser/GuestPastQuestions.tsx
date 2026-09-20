import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import PageHelmet from "../../components/SEO/PageHelmet";
import ThemeToggle from "../../components/ui/ThemeToggle";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import {
  Loader2,
  Search,
  X,
  Calendar,
  Lightbulb,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Lock,
  ArrowRight,
} from "lucide-react";
import type { Question } from "../../Types";
import { fetchAllQuestionsForBrowse } from "../../Services/questionService";
import ValidatedInput from "../../components/ui/ValidatedInput";
import { truncateInput } from "../../lib/validation";
import { renderQuestionText } from "../../lib/utils/renderQuestionText";

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
] as const;

const ALL_SUBJECTS = [
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
];

// URL slugs are lowercase (nicer URLs, matches how people type searches);
// this maps a lowercase slug back to the exact casing the rest of the app
// (and the DB `subject` column) expects.
const SUBJECT_BY_SLUG: Record<string, string> = Object.fromEntries(
  ALL_SUBJECTS.map((s) => [s.toLowerCase(), s]),
);
const VALID_YEAR_SET: Set<string> = new Set(
  VALID_YEARS.filter((y) => y !== "All"),
);

// Theme tokens, not hardcoded hex — so a future palette change (like the
// one earlier in this project) updates these automatically instead of
// needing another hunt-and-replace pass.
const SUBJECT_COLORS: Record<string, string> = {
  English: "var(--color-brand)",
  Mathematics: "var(--color-success)",
  Physics: "var(--color-warn)",
  Chemistry: "var(--color-danger)",
  Biology: "var(--color-teal)",
  Economics: "var(--color-brand)",
  Government: "var(--color-warn)",
  Literature: "var(--color-brand)",
  History: "var(--color-danger)",
  Geography: "var(--color-teal)",
  CRS: "var(--color-brand)",
  IRS: "var(--color-teal)",
  Commerce: "var(--color-warn)",
};

// Guests see up to this many questions per filter selection, then hit a
// sign-up CTA instead of endless pagination.
const FREE_PREVIEW_LIMIT = 12;

// Fetching is always scoped to a single subject — "All" is never passed to
// fetchAllQuestionsForBrowse. When the URL has no :subject param, we still
// fetch questions (rather than showing nothing) by defaulting the FETCH
// ONLY to the first entry in ALL_SUBJECTS.
const DEFAULT_FETCH_SUBJECT = ALL_SUBJECTS[0]; // "English"

const GuestPastQuestions = () => {
  const navigate = useNavigate();
  const { subject: subjectSlug, year: yearParam } = useParams<{
    subject?: string;
    year?: string;
  }>();

  // Derive subject/year from the URL. Anything that doesn't match a known
  // subject or a valid year quietly falls back to "All" rather than 404ing —
  // keeps this forgiving for typo'd or old links.
  const subject = subjectSlug
    ? (SUBJECT_BY_SLUG[subjectSlug.toLowerCase()] ?? "All")
    : "All";

  const year = yearParam && VALID_YEAR_SET.has(yearParam) ? yearParam : "All";

  // The subject actually used for fetching AND for the dropdown's displayed
  // value. Never "All" — falls back to DEFAULT_FETCH_SUBJECT so the base
  // /guest/past-questions route still shows real questions and the <select>
  // always has a valid, selectable option to display.
  const fetchSubject = subject === "All" ? DEFAULT_FETCH_SUBJECT : subject;

  // Search stays local — it's a live filter, not something worth its own URL.
  const [search, setSearch] = useState("");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setIsLoading(true);
      setLoadingError(null);
      try {
        const qs = await fetchAllQuestionsForBrowse(
          fetchSubject,
          year,
          "All",
          "All",
        );
        if (isMounted) setQuestions(qs as Question[]);
      } catch (e) {
        console.error("Error loading guest past questions:", e);
        if (isMounted)
          setLoadingError("Failed to load questions. Please try again.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [fetchSubject, year]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        q.text.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s)
      );
    });
  }, [questions, search]);

  const preview = filteredQuestions.slice(0, FREE_PREVIEW_LIMIT);
  const remainingCount = Math.max(
    0,
    filteredQuestions.length - FREE_PREVIEW_LIMIT,
  );

  // Navigation-based filter changes — each selection is a real URL, not
  // just a state update, so it's linkable, shareable, and crawlable.
  const buildPath = (nextSubject: string, nextYear: string) => {
    if (nextSubject === "All") return "/guest/past-questions";
    const base = `/guest/past-questions/${nextSubject.toLowerCase()}`;
    return nextYear === "All" ? base : `${base}/${nextYear}`;
  };

  const handleSubjectChange = (newSubject: string) => {
    navigate(buildPath(newSubject, year));
  };

  const handleYearChange = (newYear: string) => {
    // Build off fetchSubject (always a real subject) rather than the raw
    // URL-derived `subject`, so picking a year works even before the user
    // has explicitly chosen a subject in the URL (e.g. on first load at
    // the bare /guest/past-questions route).
    navigate(buildPath(fetchSubject, newYear));
  };

  const resetExpanded = () => setExpandedId(null);

  // Per-page SEO copy — this is the actual payoff of the URL restructure.
  const pageTitle =
    subject !== "All" && year !== "All"
      ? `JAMB ${subject} Past Questions ${year} | SCHOOLDRA`
      : subject !== "All"
        ? `JAMB ${subject} Past Questions | SCHOOLDRA`
        : "Free JAMB Past Questions | SCHOOLDRA";

  const pageDescription =
    subject !== "All" && year !== "All"
      ? `Practice real JAMB UTME ${subject} past questions from ${year}, free — no account required. Sign up for full access to every year and subject.`
      : subject !== "All"
        ? `Browse JAMB UTME ${subject} past questions across every year, free — no account required. Sign up for full access.`
        : "Browse real JAMB UTME past questions by subject and year, free — no account required. Sign up for full access to every year and subject.";

  const canonical = `https://www.schooldra.com${buildPath(subject, year)}`;

  return (
    <div className="bg-bgMain text-textMain min-h-screen">
      <PageHelmet
        title={pageTitle}
        description={pageDescription}
        canonical={canonical}
      />

      {/* Simple guest header — no sidebar, matches GuestLanding style */}
      <header className="border-borderMuted border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/guest" className="flex items-center gap-2.5">
            <img src={schooldraLogo} alt="Schooldra" className="h-8 w-8" />
            <span className="font-display text-lg font-bold tracking-tight">
              Schooldra
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/guest"
              className="text-textDim hover:text-textMain hidden items-center gap-1.5 text-sm font-medium transition-colors sm:flex"
            >
              <ChevronLeft className="h-4 w-4" /> Back to Practice Menu
            </Link>
            <Link
              to="/signin"
              className="text-textDim hover:text-textMain hidden text-sm font-medium transition-colors sm:block"
            >
              Sign In
            </Link>
            <ThemeToggle />
          </div>
        </div>
        {/* Mobile-only back link, shown below the logo row on small screens */}
        <div className="border-borderMuted border-t px-4 py-2 sm:hidden">
          <Link
            to="/guest"
            className="text-textDim hover:text-textMain flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="h-4 w-4" /> Back to Practice Menu
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* Page header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="font-display text-textMain text-2xl font-bold tracking-tight lg:text-3xl">
              {subject !== "All" && year !== "All"
                ? `${subject} Past Questions — ${year}`
                : subject !== "All"
                  ? `${subject} Past Questions`
                  : "Past Questions"}
            </h1>
            <span className="border-teal/25 bg-teal/10 text-teal rounded-full border px-2.5 py-1 text-[10px] font-bold">
              FREE PREVIEW
            </span>
          </div>
          <p className="text-textDim text-sm">
            Practice real JAMB past questions, free — no account needed.
            {subject === "All" && (
              <>
                {" "}
                Showing <span className="font-semibold">{DEFAULT_FETCH_SUBJECT}</span> to
                start — pick a subject below to switch.
              </>
            )}
          </p>
        </div>

        {/* Crawlable internal links to each subject — helps search engines
            discover the /guest/past-questions/:subject pages, not just the
            sitemap. Only shown on the "All subjects" base page. */}
        {subject === "All" && (
          <div className="flex flex-wrap gap-2">
            {ALL_SUBJECTS.map((s) => (
              <Link
                key={s}
                to={`/guest/past-questions/${s.toLowerCase()}`}
                className="bg-bgCard border-borderMuted text-textDim hover:text-textMain hover:border-brand/30 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                {s}
              </Link>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-bgCard border-borderMuted space-y-4 rounded-2xl border p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-textDim text-xs font-semibold tracking-wider uppercase">
                Subject
              </label>
              {/* "All Subjects" option removed — dropdown value now tracks
                  fetchSubject (always a real subject) instead of the raw
                  URL-derived `subject`, which could be "All" and would have
                  no matching option to display. */}
              <select
                value={fetchSubject}
                onChange={(e) => {
                  handleSubjectChange(e.target.value);
                  resetExpanded();
                }}
                className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border px-4 py-2.5 focus:ring-2 focus:outline-none"
              >
                {ALL_SUBJECTS.map((s) => (
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
                value={year}
                onChange={(e) => {
                  handleYearChange(e.target.value);
                  resetExpanded();
                }}
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
                Search
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="text-textDim absolute top-1/2 left-4 -translate-y-1/2"
                />
                <ValidatedInput
                  value={search}
                  onChange={(v) => {
                    setSearch(truncateInput(v, 200));
                    resetExpanded();
                  }}
                  placeholder="Search..."
                  className="bg-bgSurface border-borderMuted text-textMain focus:ring-brand/50 w-full rounded-xl border py-2.5 pr-4 pl-12 focus:ring-2 focus:outline-none"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      resetExpanded();
                    }}
                    className="text-textDim hover:text-textMain absolute top-1/2 right-3 -translate-y-1/2"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Loader2 className="text-brand h-8 w-8 animate-spin" />
            <p className="text-textDim text-sm">Loading questions...</p>
          </div>
        )}

        {/* Error */}
        {!isLoading && loadingError && (
          <div className="bg-danger/10 border-danger/30 flex flex-col items-center gap-3 rounded-xl border p-8 text-center">
            <AlertCircle className="text-danger h-8 w-8" />
            <p className="text-textMain font-semibold">
              We couldn't load questions right now
            </p>
            <p className="text-textDim text-sm">{loadingError}</p>
          </div>
        )}

        {/* No results */}
        {!isLoading && !loadingError && preview.length === 0 && (
          <div
            data-testid="no-results"
            className="bg-bgCard border-borderMuted rounded-2xl border p-12 text-center"
          >
            <h3 className="text-textMain mb-2 text-xl font-bold">
              No questions found
            </h3>
            <p className="text-textDim">Try a different subject or year.</p>
          </div>
        )}

        {/* Questions list */}
        {!isLoading && !loadingError && preview.length > 0 && (
          <>
            <p className="text-textDim text-sm">
              Showing{" "}
              <span className="text-textMain font-semibold">
                {preview.length}
              </span>{" "}
              free preview question{preview.length !== 1 ? "s" : ""}
              {remainingCount > 0 && (
                <>
                  {" "}
                  ·{" "}
                  <span className="text-textMain font-semibold">
                    {remainingCount}
                  </span>{" "}
                  more available with a free account
                </>
              )}
            </p>

            <div className="space-y-4">
              {preview.map((q, idx) => {
                const color = SUBJECT_COLORS[q.subject] || "var(--color-brand)";
                const isExpanded = expandedId === q.id;

                return (
                  <div
                    key={q.id}
                    data-testid="question-card"
                    className="bg-bgCard border-borderMuted overflow-hidden rounded-2xl border transition-all"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      className="w-full p-5 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                            color,
                          }}
                        >
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-3">
                            <span
                              className="rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                                color,
                              }}
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
                        <div className="space-y-2.5">
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sign-up CTA instead of pagination, once the free cap is hit */}
            {remainingCount > 0 && (
              <div className="border-brand/20 bg-brand/5 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center">
                <div className="bg-brand/10 flex h-12 w-12 items-center justify-center rounded-full">
                  <Lock className="text-brand h-5 w-5" />
                </div>
                <h3 className="font-display text-textMain text-lg font-bold">
                  {remainingCount} more question
                  {remainingCount !== 1 ? "s" : ""} waiting for you
                </h3>
                <p className="text-textDim max-w-sm text-sm">
                  Create a free account to unlock every past question from 2015
                  to 2025, across every subject.
                </p>
                <button
                  onClick={() => navigate("/signup")}
                  className="bg-brand hover:bg-brand-light mt-2 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white transition-all active:scale-95"
                >
                  Create Free Account <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GuestPastQuestions;