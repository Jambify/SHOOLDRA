// src/Pages/Guest/GuestMockExam.tsx

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { fetchQuestionsWithFallback } from "../../Services/questionService";
import LoadingScreen from "../../components/ui/LoadingScreen";
import type { Question } from "../../Types";
import { cn } from "../../lib/utils/utils";
import PageHelmet from "../../components/SEO/PageHelmet";
import ThemeToggle from "../../components/ui/ThemeToggle";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import { SUBJECT_COLORS, getSubjectIcon } from "../../lib/subjectMeta";
import {
  ChevronLeft,
  ArrowRight,
  CheckCircle,
  Timer,
  BookOpen,
  Sparkles,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  ArrowLeft,
  Target,
  Zap,
  Layers,
  Trophy,
  ThumbsUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useExamTimer } from "../../hooks/useExamTimer";
import ValidatedInput from "../../components/ui/ValidatedInput";
import { truncateInput } from "../../lib/validation";
import QuestionAIExplanation from "../../components/Quiz/QuestionAIExplanation";
import { renderQuestionText } from "../../lib/utils/renderQuestionText";
import { ExplanationText } from "../../components/shared/ExplanationText";

const MOCK_DURATION = 7200; // 2 hours in seconds

const AVAILABLE_SUBJECTS = [
  { id: "English", name: "English", questions: 60 },
  { id: "Mathematics", name: "Mathematics", questions: 40 },
  { id: "Physics", name: "Physics", questions: 40 },
  { id: "Chemistry", name: "Chemistry", questions: 40 },
  { id: "Biology", name: "Biology", questions: 40 },
  { id: "Economics", name: "Economics", questions: 40 },
  { id: "Government", name: "Government", questions: 40 },
  { id: "Literature", name: "Literature", questions: 40 },
  { id: "History", name: "History", questions: 40 },
  { id: "Geography", name: "Geography", questions: 40 },
  { id: "CRS", name: "CRS", questions: 40 },
];

const AVAILABLE_YEARS = [
  "Random",
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
];

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Shared header — matches GuestPastQuestions.tsx / GuestQuiz.tsx exactly.
const GuestHeader: React.FC<{ onBack: () => void; backLabel?: string }> = ({
  onBack,
  backLabel = "Back to Practice Menu",
}) => (
  <header className="border-borderMuted border-b">
    <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
      <Link to="/guest" className="flex items-center gap-2.5">
        <img src={schooldraLogo} alt="Schooldra" className="h-8 w-8" />
        <span className="font-display text-lg font-bold tracking-tight">
          Schooldra
        </span>
      </Link>
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-textDim hover:text-textMain hidden items-center gap-1.5 text-sm font-medium transition-colors sm:flex"
        >
          <ChevronLeft className="h-4 w-4" /> {backLabel}
        </button>
        <Link
          to="/signin"
          className="text-textDim hover:text-textMain hidden text-sm font-medium transition-colors sm:block"
        >
          Sign In
        </Link>
        <ThemeToggle />
      </div>
    </div>
    <div className="border-borderMuted border-t px-4 py-2 sm:hidden">
      <button
        onClick={onBack}
        className="text-textDim hover:text-textMain flex items-center gap-1.5 text-sm font-medium transition-colors"
      >
        <ChevronLeft className="h-4 w-4" /> {backLabel}
      </button>
    </div>
  </header>
);

interface GuestReviewItemProps {
  question: Question;
  index: number;
  userAnswer: number | -1;
}

const GuestReviewItem: React.FC<GuestReviewItemProps> = ({
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
        className="hover:bg-bgSurface/30 active:bg-bgSurface/50 flex w-full items-start gap-3 px-4 py-4 text-left transition-colors sm:px-6"
      >
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-8 sm:w-8 sm:text-sm",
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
          <p className="text-textMain line-clamp-2 text-xs font-medium sm:text-sm md:text-base">
            {renderQuestionText(q.text, q.subject)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
        <div className="border-borderMuted bg-bgSurface/20 space-y-3 border-t px-4 py-4 sm:px-8 sm:py-5">
          <div className="space-y-2">
            {q.options.map((opt, optIdx) => {
              const isCorrectOpt = optIdx === q.answer;
              const isUserOpt = !skipped && optIdx === userAns;
              return (
                <div
                  key={optIdx}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-[11px] sm:px-4 sm:py-3 sm:text-xs md:text-sm",
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
            <div className="border-brand/20 bg-brand/5 border-l-brand rounded-r-xl border border-l-[3px] px-3 py-3 sm:px-5 sm:py-4">
              <p className="text-brand mb-1 text-[10px] font-black tracking-widest uppercase">
                Built-in Explanation
              </p>
              <p className="text-textMuted text-[11px] leading-relaxed sm:text-xs md:text-sm">
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

const GuestMockExam: React.FC = () => {
  const navigate = useNavigate();

  // Exam state
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  // Setup state
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedCombination, setSelectedCombination] = useState<string[]>([
    "English",
    "",
    "",
    "",
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [activeSubject, setActiveSubject] = useState("English");
  const [jumpTo, setJumpTo] = useState("");

  // Review screen filters
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string>("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");

  // Timer logic using the persistent hook
  const { formattedTime, status } = useExamTimer({
    initialTime: MOCK_DURATION,
    onTimeUp: () => handleFinishExam(),
    isActive: isStarted && !isFinished,
    persistenceKey: "schooldra-guest-exam-timer",
  });

  // Update active subject
  useEffect(() => {
    if (isStarted && questions[currentIndex]) {
      setActiveSubject(questions[currentIndex].subject);
    }
  }, [currentIndex, isStarted, questions]);

  const handleFinishExam = () => {
    setIsFinished(true);
  };

  const handleStart = async () => {
    setError(null);
    setIsLoading(true);

    try {
      // Small delay for loader
      await new Promise((r) => setTimeout(r, 100));

      const finalQuestionsList: Question[] = [];

      for (const subjectId of selectedCombination) {
        if (!subjectId) continue;

        const config = AVAILABLE_SUBJECTS.find((s) => s.id === subjectId);
        const requiredCount = config ? config.questions : 40;

        const fetched = await fetchQuestionsWithFallback(
          subjectId,
          selectedYear,
          requiredCount,
          "All",
        );

        // Randomize options for each question to prevent memorization
        const randomized = fetched.map((q) => {
          const correctOptionText = q.options[q.answer];
          const shuffledOptions = shuffleArray(q.options);
          const newCorrectIndex = shuffledOptions.indexOf(correctOptionText);
          return { ...q, options: shuffledOptions, answer: newCorrectIndex };
        });

        finalQuestionsList.push(...randomized);
      }

      if (finalQuestionsList.length === 0) {
        throw new Error("No questions found for the selected subjects.");
      }

      setQuestions(finalQuestionsList);
      setAnswers({});
      setCurrentIndex(0);
      setIsStarted(true);
      setActiveSubject(selectedCombination[0]);
    } catch (error: unknown) {
      console.error("Guest Mock Exam Error:", error);
      setError(
        (error instanceof Error ? error.message : undefined) ||
          "Failed to load questions. Please check your connection.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <>
        <PageHelmet
          title="Free JAMB Mock Exam | SCHOOLDRA"
          description="Take a full 180-question JAMB mock exam, free, with real scoring and timing — no account required."
          canonical="https://www.schooldra.com/guest/mock"
        />
        <LoadingScreen
          message="Preparing Mock Exam"
          variant="mock-exam"
          submessage="Gathering questions for all selected subjects..."
          estimatedTime={4}
        />
      </>
    );
  }

  const updateSubject = (index: number, value: string) => {
    setError(null);
    const newComb = [...selectedCombination];
    newComb[index] = value;
    setSelectedCombination(newComb);
  };

  const submitAnswer = (idx: number, optionIndex: number) => {
    if (answers[idx] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [idx]: optionIndex }));
  };

  const nextQuestion = (index?: number) => {
    if (index !== undefined) {
      setCurrentIndex(index);
    } else if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const answeredCount = Object.keys(answers).length;
  const score = Object.entries(answers).filter(
    ([i, a]) => a === questions[Number(i)]?.answer,
  ).length;
  const jambScore = Math.round((score / questions.length) * 400);

  // ── Results Screen ─────────────────────────────────────────────────────────
  if (isFinished) {
    const pct = Math.round((score / questions.length) * 100);
    const ResultIcon = pct >= 70 ? Trophy : pct >= 50 ? ThumbsUp : BookOpen;
    const resultColor =
      pct >= 70
        ? "var(--color-warn)"
        : pct >= 50
          ? "var(--color-success)"
          : "var(--color-brand)";

    // Group scores by subject
    const subjectScores: Record<string, { correct: number; total: number }> =
      {};
    questions.forEach((q, idx) => {
      if (!subjectScores[q.subject]) {
        subjectScores[q.subject] = { correct: 0, total: 0 };
      }
      subjectScores[q.subject].total++;
      if (answers[idx] === q.answer) {
        subjectScores[q.subject].correct++;
      }
    });

    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Free JAMB Mock Exam | SCHOOLDRA"
          description="Take a full 180-question JAMB mock exam, free, with real scoring and timing — no account required."
          canonical="https://www.schooldra.com/guest/mock"
        />
        <GuestHeader onBack={() => navigate("/guest")} />

        <div className="flex flex-col items-center justify-center p-4 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl text-center"
          >
            {/* Score */}
            <div className="mb-10">
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6 flex justify-center"
              >
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${resultColor} 15%, transparent)`,
                  }}
                >
                  <ResultIcon
                    className="h-10 w-10"
                    style={{ color: resultColor }}
                  />
                </div>
              </motion.div>

              <h2 className="font-display text-textMain mb-2 text-6xl font-black tracking-tighter">
                {jambScore}
                <span className="text-brand text-3xl">/400</span>
              </h2>

              <div className="mt-4 flex items-center justify-center gap-4">
                <div className="bg-bgCard border-borderMuted rounded-full border px-4 py-1">
                  <span className="text-textDim text-xs font-bold tracking-widest uppercase">
                    {score} / {questions.length} Correct
                  </span>
                </div>
                <div className="bg-bgCard border-borderMuted rounded-full border px-4 py-1">
                  <span className="text-textDim text-xs font-bold tracking-widest uppercase">
                    {pct}% Accuracy
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Subject Breakdown */}
              <div className="bg-bgCard border-borderMuted group relative overflow-hidden rounded-3xl border p-8 text-left shadow-2xl backdrop-blur-sm">
                <div className="bg-brand/20 group-hover:bg-brand absolute top-0 left-0 h-full w-1 transition-colors" />

                <h3 className="text-brand mb-6 flex items-center gap-2 text-xs font-black tracking-[0.2em] uppercase">
                  <Target size={14} />
                  Subject Performance
                </h3>

                <div className="space-y-6">
                  {Object.entries(subjectScores).map(([subject, data]) => {
                    const subjectPct = Math.round(
                      (data.correct / data.total) * 100,
                    );
                    const Icon = getSubjectIcon(subject);
                    const color = SUBJECT_COLORS[subject];

                    return (
                      <div key={subject} className="group/item">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" style={{ color }} />
                            <span className="text-textMain text-sm font-bold">
                              {subject}
                            </span>
                          </div>
                          <span className="text-textDim font-mono text-[10px] font-black">
                            {data.correct}/{data.total}
                          </span>
                        </div>
                        <div className="bg-bgSurface border-borderMuted/30 h-2 overflow-hidden rounded-full border">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${subjectPct}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              subjectPct >= 75
                                ? "bg-success shadow-success"
                                : subjectPct >= 45
                                  ? "bg-brand shadow-brand"
                                  : "bg-danger shadow-danger",
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CTA Card */}
              <div className="bg-bgCard border-borderMuted group relative flex flex-col overflow-hidden rounded-3xl border p-8 text-left shadow-2xl backdrop-blur-sm">
                <div className="bg-brand/20 group-hover:bg-brand/5 absolute top-0 left-0 h-1 w-full transition-all duration-500 group-hover:h-full" />

                <div className="relative z-10 flex-1">
                  <div className="bg-brand/10 mb-6 flex h-12 w-12 items-center justify-center rounded-2xl">
                    <Sparkles className="text-brand h-6 w-6" />
                  </div>

                  <h3 className="font-display text-textMain mb-3 text-xl leading-tight font-black">
                    Unlock Detailed Answer Review
                  </h3>

                  <p className="text-textDim mb-8 text-xs leading-relaxed">
                    You answered{" "}
                    <span className="text-textMain font-bold">{score}</span>{" "}
                    questions correctly. Want to see which ones you missed and
                    read professional explanations for each?
                  </p>

                  <div className="mb-8 space-y-3">
                    {[
                      "View detailed answer keys",
                      "Read expert explanations",
                      "Track progress over time",
                    ].map((text, i) => (
                      <div
                        key={i}
                        className="text-textMain flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase"
                      >
                        <CheckCircle size={12} className="text-success" />
                        {text}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() =>
                    navigate("/signup", {
                      state: {
                        fromMockExam: true,
                        score: jambScore,
                        subjectScores,
                      },
                    })
                  }
                  className="bg-brand hover:bg-brand-light shadow-brand/20 relative z-10 w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl transition-all active:scale-[0.98]"
                >
                  Get Full Access — It's Free
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row">
              <button
                onClick={() => {
                  const subjects = Array.from(
                    new Set(questions.map((q) => q.subject)),
                  );
                  setActiveSubjectFilter(subjects[0] || "");
                  setReviewStatusFilter("all");
                  setShowReview(true);
                }}
                className="bg-brand hover:bg-brand-light shadow-brand/20 flex-1 rounded-2xl py-4 text-xs font-black tracking-widest text-white uppercase shadow-xl transition-all active:scale-[0.98]"
              >
                <div className="flex items-center justify-center gap-2">
                  <BookOpen size={16} />
                  Review Answers with AI
                </div>
              </button>
              <button
                onClick={() => {
                  setIsStarted(false);
                  setIsFinished(false);
                  setShowReview(false);
                  setActiveSubjectFilter("");
                  setReviewStatusFilter("all");
                  setQuestions([]);
                  setAnswers({});
                  setCurrentIndex(0);
                  setError(null);
                  setShowConfirmExit(false);
                  setActiveSubject(selectedCombination[0]);
                  setJumpTo("");
                  setSelectedCombination(["English", "", "", ""]);
                  setSelectedYear("2025");
                }}
                className="bg-bgSurface border-borderMuted hover:border-brand/40 flex-1 rounded-2xl border py-4 text-xs font-black tracking-widest uppercase transition-all active:scale-[0.98]"
              >
                Restart Simulation
              </button>
              <button
                onClick={() => navigate("/guest")}
                className="bg-bgSurface border-borderMuted hover:border-brand/40 flex-1 rounded-2xl border py-4 text-xs font-black tracking-widest uppercase transition-all active:scale-[0.98]"
              >
                Exit to Home
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Review Screen ─────────────────────────────────────────────────
  if (showReview) {
    const examSubjects = Array.from(
      new Set(questions.map((quest) => quest.subject)),
    );

    const filteredQuestions = questions.filter((q) => {
      const globalIdx = questions.indexOf(q);
      const userAns = answers[globalIdx] ?? -1;
      const matchesSubject =
        !activeSubjectFilter || q.subject === activeSubjectFilter;
      const isCorrect = userAns === q.answer;
      const skipped = userAns === -1;

      let matchesStatus = true;
      if (reviewStatusFilter === "correct") matchesStatus = isCorrect;
      if (reviewStatusFilter === "incorrect")
        matchesStatus = !isCorrect && !skipped;

      return matchesSubject && matchesStatus;
    });

    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Mock Exam Review | SCHOOLDRA"
          description="Review your mock exam answers with detailed AI explanations for each question."
          canonical="https://www.schooldra.com/guest/mock"
        />
        <GuestHeader
          onBack={() => setShowReview(false)}
          backLabel="Back to Results"
        />

        <div className="flex flex-col p-4 sm:p-6">
          {/* Header */}
          <div className="mx-auto mb-6 flex w-full max-w-6xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <button
              onClick={() => setShowReview(false)}
              className="bg-bgCard border-borderMuted hover:border-brand/30 text-brand flex shrink-0 items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-xs font-bold transition-all active:scale-95"
            >
              <ArrowLeft size={16} />
              Back to Results
            </button>
            <div className="bg-brand/5 border-brand/20 flex shrink-0 items-center gap-2 self-start rounded-xl border p-2.5 sm:self-auto">
              <Trophy className="text-brand h-4 w-4" />
              <span className="font-mono text-xs font-bold">
                Total: {score}/{questions.length} Correct · {jambScore}/400
              </span>
            </div>
          </div>

          {/* Sticky filters */}
          <div className="mx-auto mb-6 w-full max-w-6xl">
            <div className="bg-bgPage sticky top-0 z-20 space-y-3 py-2">
              <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveSubjectFilter("")}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-all",
                    activeSubjectFilter === ""
                      ? "bg-brand border-brand text-white shadow-md"
                      : "bg-bgCard border-borderMuted text-textDim hover:border-brand/40",
                  )}
                >
                  All Subjects
                  <span className="text-[10px] opacity-70">
                    {questions.length}
                  </span>
                </button>
                {examSubjects.map((sub) => {
                  const subQs = questions.filter((q) => q.subject === sub);
                  const subScore = subQs.filter(
                    (q) => answers[questions.indexOf(q)] === q.answer,
                  ).length;
                  return (
                    <button
                      key={sub}
                      onClick={() => setActiveSubjectFilter(sub)}
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-all",
                        activeSubjectFilter === sub
                          ? "bg-brand border-brand text-white shadow-md"
                          : "bg-bgCard border-borderMuted text-textDim hover:border-brand/40",
                      )}
                    >
                      {sub}
                      <span className="text-[10px] opacity-70">
                        {subScore}/{subQs.length}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                <Info size={12} className="text-textDim shrink-0" />
                {(["all", "correct", "incorrect"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setReviewStatusFilter(f)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1 text-[10px] font-bold tracking-wider uppercase transition-all",
                      reviewStatusFilter === f
                        ? "bg-textMain border-textMain text-bgCard"
                        : "border-borderMuted text-textDim bg-transparent",
                    )}
                  >
                    {f}
                  </button>
                ))}
                <span className="text-textDim ml-auto text-[10px] tracking-widest uppercase">
                  Showing {filteredQuestions.length} questions
                </span>
              </div>
              <div className="bg-borderMuted h-px w-full" />
            </div>
          </div>

          {/* Review list */}
          <div className="mx-auto w-full max-w-6xl">
            <div className="bg-bgCard border-borderMuted mb-10 overflow-hidden rounded-3xl border shadow-xl shadow-black/10 backdrop-blur-sm">
              {filteredQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="bg-bgSurface text-textDim mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
                    <BookOpen size={28} />
                  </div>
                  <h3 className="text-textMain mb-1 text-lg font-bold">
                    No questions match your filters
                  </h3>
                  <p className="text-textDim text-xs">
                    Try changing the subject or status filter above.
                  </p>
                </div>
              ) : (
                filteredQuestions.map((q) => {
                  const globalIdx = questions.indexOf(q);
                  const skipped =
                    answers[globalIdx] === undefined ||
                    answers[globalIdx] === -1;
                  const userAns = skipped ? -1 : (answers[globalIdx] as number);
                  return (
                    <GuestReviewItem
                      key={q.id}
                      question={q}
                      index={globalIdx}
                      userAnswer={userAns}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Exam Active Screen (No instant feedback!) ───────────────────
  if (isStarted && questions[currentIndex]) {
    const q = questions[currentIndex];
    const chosen = answers[currentIndex] ?? -1;
    const examSubjects = Array.from(
      new Set(questions.map((quest) => quest.subject)),
    );
    const subjectQuestions = questions.filter(
      (quest) => quest.subject === activeSubject,
    );

    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Free JAMB Mock Exam | SCHOOLDRA"
          description="Take a full 180-question JAMB mock exam, free, with real scoring and timing — no account required."
          canonical="https://www.schooldra.com/guest/mock"
        />
        <GuestHeader
          onBack={() => setShowConfirmExit(true)}
          backLabel="Exit Exam"
        />

        <div className="flex flex-col p-4 sm:p-6">
          {/* Status bar — timer + progress + finish */}
          <div className="bg-bgCard/50 border-borderMuted relative z-10 mx-auto mt-2 mb-8 flex w-full max-w-7xl items-center justify-between gap-4 rounded-3xl border p-3 shadow-xl shadow-black/10 backdrop-blur-md sm:p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowConfirmExit(true)}
                className="bg-bgSurface border-borderMuted text-textDim hover:text-danger hover:border-danger/40 group rounded-2xl border p-2.5 transition-all"
                title="Exit Exam"
              >
                <LogOut
                  size={18}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
              </button>
              <div className="bg-borderMuted/30 hidden h-8 w-px sm:block" />
              <div className="hidden flex-col sm:flex">
                <span className="text-brand mb-1 text-[10px] leading-none font-black tracking-widest uppercase">
                  CBT Simulation
                </span>
                <span className="text-textMain text-xs leading-none font-bold">
                  {selectedYear} Mock
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-5 py-2.5 shadow-inner transition-all",
                  status === "red"
                    ? "bg-danger/10 border-danger/30 text-danger animate-pulse"
                    : "bg-bgSurface border-borderMuted text-textMain",
                )}
              >
                <Timer
                  size={18}
                  className={cn(status === "red" && "animate-spin-slow")}
                />
                <span className="font-mono text-xl font-black tracking-tighter tabular-nums">
                  {formattedTime}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden flex-col items-end md:flex">
                <span className="text-textDim mb-1 text-[10px] leading-none font-black tracking-widest uppercase">
                  Progress
                </span>
                <span className="text-textMain text-xs leading-none font-bold">
                  {answeredCount} / {questions.length}
                </span>
              </div>
              <button
                onClick={() => setShowConfirmExit(true)}
                className="bg-brand hover:bg-brand-light shadow-brand/20 rounded-2xl px-6 py-2.5 text-xs font-black tracking-widest text-white uppercase shadow-lg transition-all active:scale-[0.98]"
              >
                Finish
              </button>
            </div>
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 overflow-hidden lg:flex-row">
            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-y-auto pr-1">
              {/* Subject Tabs */}
              <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-2">
                {examSubjects.map((sub) => {
                  const SubIcon = getSubjectIcon(sub);
                  return (
                    <button
                      key={sub}
                      onClick={() => {
                        setActiveSubject(sub);
                        const firstIdx = questions.findIndex(
                          (quest) => quest.subject === sub,
                        );
                        if (firstIdx !== -1) nextQuestion(firstIdx);
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black tracking-widest whitespace-nowrap uppercase shadow-sm transition-all",
                        activeSubject === sub
                          ? "bg-brand border-brand shadow-brand/20 text-white"
                          : "bg-bgCard text-textDim border-borderMuted hover:border-brand/40",
                      )}
                    >
                      <SubIcon className="h-3.5 w-3.5" />
                      {sub}
                    </button>
                  );
                })}
              </div>

              {/* Question Card */}
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-bgCard border-borderMuted group relative mb-6 overflow-hidden rounded-4xl border p-6 shadow-2xl shadow-black/10 sm:p-10"
              >
                <div className="bg-brand/20 group-hover:bg-brand absolute top-0 left-0 h-full w-1.5 transition-colors" />

                <div className="mb-8 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-brand/10 text-brand border-brand/20 rounded-xl border px-3 py-1.5 text-[10px] font-black tracking-widest uppercase">
                      Question{" "}
                      {subjectQuestions.findIndex((sq) => sq.id === q.id) + 1}
                    </span>
                    <span className="bg-bgSurface text-textDim border-borderMuted rounded-xl border px-3 py-1.5 text-[10px] font-black tracking-widest uppercase">
                      {q.subject}
                    </span>
                  </div>
                  <div className="text-textMuted font-mono text-[10px] font-bold tracking-widest uppercase">
                    Global ID: #{q.id.slice(0, 8)}
                  </div>
                </div>

                <p className="text-textMain mb-12 text-xl leading-relaxed font-medium tracking-tight sm:text-2xl">
                  {renderQuestionText(q.text, q.subject)}
                </p>

                {/* Options */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {q.options.map((opt, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => submitAnswer(currentIndex, i)}
                      className={cn(
                        "group flex w-full items-center gap-4 rounded-2xl border-2 p-5 text-left text-sm font-bold transition-all sm:text-base",
                        chosen === i
                          ? "border-brand bg-brand/10 text-textMain shadow-brand/5 shadow-lg"
                          : "border-borderMuted bg-bgSurface/50 hover:border-brand/40 text-textMain shadow-sm",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-sm transition-colors",
                          chosen === i
                            ? "bg-brand text-white"
                            : "bg-bgDeep text-textDim group-hover:bg-brand/10 group-hover:text-brand",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="flex-1 leading-tight">
                        {renderQuestionText(opt, q.subject)}
                      </span>
                      {chosen === i && (
                        <div className="bg-brand/20 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                          <div className="bg-brand h-2 w-2 rounded-full" />
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>

              {/* Navigation buttons */}
              <div className="mt-auto flex items-center justify-between gap-4 py-6">
                <button
                  onClick={prevQuestion}
                  disabled={currentIndex === 0}
                  className={cn(
                    "flex items-center gap-2 rounded-2xl px-8 py-4 text-xs font-black tracking-widest uppercase transition-all",
                    currentIndex === 0
                      ? "bg-bgSurface text-textMuted border-borderMuted cursor-not-allowed border opacity-50"
                      : "bg-bgCard border-borderMuted text-textMain hover:border-brand/40 border shadow-lg active:scale-95",
                  )}
                >
                  <ChevronLeft size={18} />
                  Previous
                </button>

                <button
                  onClick={() => {
                    if (currentIndex === questions.length - 1) {
                      setShowConfirmExit(true);
                    } else {
                      nextQuestion(currentIndex + 1);
                    }
                  }}
                  className="bg-brand hover:bg-brand-light shadow-brand/20 flex items-center gap-2 rounded-2xl px-10 py-4 text-xs font-black tracking-widest text-white uppercase shadow-2xl transition-all active:scale-[0.98]"
                >
                  {currentIndex === questions.length - 1
                    ? "Finish Exam"
                    : "Next Question"}
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Sidebar Navigator */}
            <div className="bg-bgCard border-borderMuted hidden w-80 flex-col overflow-hidden rounded-4xl border p-6 shadow-2xl lg:flex">
              <div className="mb-6 flex items-center justify-between">
                <h4 className="text-textDim text-[10px] font-black tracking-[0.2em] uppercase">
                  Question Grid
                </h4>
                <div className="flex items-center gap-4">
                  <ValidatedInput
                    value={jumpTo}
                    onChange={(v) =>
                      setJumpTo(truncateInput(v.replace(/\D/g, ""), 4))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const n = parseInt(jumpTo) - 1;
                        if (n >= 0 && n < questions.length) nextQuestion(n);
                        setJumpTo("");
                      }
                    }}
                    placeholder="#"
                    className="bg-bgSurface border-borderMuted focus:border-brand w-12 rounded-xl border px-2 py-1 text-center text-xs font-bold transition-all outline-none"
                    maxLength={4}
                  />
                </div>
              </div>

              <div className="custom-scrollbar flex-1 overflow-y-auto pr-2">
                <div className="grid grid-cols-5 gap-2 pb-4">
                  {questions.map((_, i) => {
                    const isAnswered = answers[i] !== undefined;
                    const isActive = i === currentIndex;

                    return (
                      <button
                        key={i}
                        onClick={() => nextQuestion(i)}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-xl border font-mono text-xs font-bold transition-all",
                          isActive
                            ? "bg-brand border-brand shadow-brand/20 z-10 scale-110 text-white shadow-lg"
                            : isAnswered
                              ? "bg-success/10 text-success border-success/30 hover:border-success"
                              : "bg-bgSurface text-textDim border-borderMuted hover:border-brand/40",
                        )}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-borderMuted/30 mt-6 space-y-4 border-t pt-6">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                  <span className="text-textDim">Answered</span>
                  <span className="text-success">
                    {answeredCount} questions
                  </span>
                </div>
                <div className="bg-bgSurface border-borderMuted/30 h-1.5 overflow-hidden rounded-full border">
                  <div
                    className="bg-success h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(answeredCount / questions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Confirm exit modal */}
          <AnimatePresence>
            {showConfirmExit && (
              <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-bgCard border-borderMuted relative w-full max-w-md overflow-hidden rounded-[2.5rem] border p-8 shadow-2xl sm:p-10"
                >
                  <div className="bg-brand absolute top-0 left-0 h-2 w-full" />

                  <div className="bg-brand/10 mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
                    <CheckCircle size={32} className="text-brand" />
                  </div>

                  <h3 className="font-display mb-3 text-center text-2xl font-black tracking-tight">
                    Submit Exam?
                  </h3>

                  <p className="text-textDim mb-8 text-center text-sm leading-relaxed font-medium">
                    You've answered{" "}
                    <span className="text-textMain font-bold">
                      {answeredCount}
                    </span>{" "}
                    out of{" "}
                    <span className="text-textMain font-bold">
                      {questions.length}
                    </span>{" "}
                    questions.
                    {answeredCount < questions.length ? (
                      <span className="text-danger mt-2 block font-bold">
                        ⚠️ You have {questions.length - answeredCount}{" "}
                        unanswered questions!
                      </span>
                    ) : (
                      <span className="text-success mt-2 block font-bold">
                        ✨ Great job completing all questions!
                      </span>
                    )}
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setShowConfirmExit(false)}
                      className="border-borderMuted hover:bg-bgSurface flex-1 rounded-2xl border py-4 text-xs font-black tracking-widest uppercase transition-all"
                    >
                      Keep Reviewing
                    </button>
                    <button
                      onClick={handleFinishExam}
                      className="bg-brand hover:bg-brand-light shadow-brand/20 flex-1 rounded-2xl py-4 text-xs font-black tracking-widest text-white uppercase shadow-xl transition-all"
                    >
                      Submit Now
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Setup Screen ─────────────────────────────────────────────────────────
  const FirstSubjectIcon = getSubjectIcon("English");

  return (
    <div className="bg-bgMain text-textMain min-h-screen">
      <PageHelmet
        title="Free JAMB Mock Exam | SCHOOLDRA"
        description="Take a full 180-question JAMB mock exam, free, with real scoring and timing — no account required."
        canonical="https://www.schooldra.com/guest/mock"
      />
      <GuestHeader onBack={() => navigate("/guest")} />

      <div className="flex flex-col items-center justify-center p-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid w-full max-w-5xl grid-cols-1 items-stretch gap-8 md:grid-cols-2"
        >
          {/* Setup Card */}
          <div className="bg-bgCard border-borderMuted flex flex-col rounded-3xl border p-6 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-10">
            <div className="mb-8 flex items-center justify-between">
              <span className="border-teal/25 bg-teal/10 text-teal rounded-full border px-2.5 py-1 text-[10px] font-bold">
                GUEST MOCK
              </span>
            </div>

            <div className="mb-10 text-left">
              <div className="mb-4 flex items-center gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--color-brand) 12%, transparent)",
                  }}
                >
                  <Target className="text-brand h-7 w-7" />
                </div>
                <div>
                  <h2 className="font-display text-textMain text-3xl font-black tracking-tight">
                    CBT Simulator
                  </h2>
                  <p className="text-textDim text-sm font-medium">
                    Standard JAMB 4-Subject Combination
                  </p>
                </div>
              </div>

              {error && (
                <div
                  className={cn(
                    "animate-in fade-in slide-in-from-top-4 mb-6 rounded-2xl border p-5 text-sm shadow-sm duration-300",
                    error.includes("CONNECTION_ERROR") ||
                      error.includes("OFFLINE")
                      ? "network-error-alert"
                      : "bg-danger/15 border-danger/30 text-danger dark:bg-danger/10",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm",
                        error.includes("CONNECTION_ERROR") ||
                          error.includes("OFFLINE")
                          ? "bg-warn/20 text-warn"
                          : "bg-danger/20 text-danger",
                      )}
                    >
                      <Info size={20} />
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "font-bold tracking-tight",
                          error.includes("CONNECTION_ERROR") ||
                            error.includes("OFFLINE")
                            ? "text-warn"
                            : "text-danger",
                        )}
                      >
                        {error.includes("CONNECTION_ERROR") ||
                        error.includes("OFFLINE")
                          ? "Connection Alert"
                          : "System Alert"}
                      </p>
                      <p className="mt-1 opacity-90">{error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-6">
              <div className="flex flex-col text-left">
                <label className="text-brand mb-2 px-1 text-[10px] font-black tracking-[0.15em] uppercase">
                  Examination Year
                </label>
                <div className="group relative">
                  <select
                    className="bg-bgSurface/50 border-borderMuted text-textMain focus:border-brand focus:ring-brand/20 w-full cursor-pointer appearance-none rounded-2xl border p-4 text-sm font-bold transition-all outline-none focus:ring-1"
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(e.target.value);
                      setError(null);
                    }}
                  >
                    {AVAILABLE_YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year} Exam
                      </option>
                    ))}
                  </select>
                  <div className="text-textDim group-hover:text-brand pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 transition-colors">
                    <ArrowRight className="h-4 w-4 rotate-90" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
                <div className="flex flex-col">
                  <label className="text-brand mb-2 px-1 text-[10px] font-black tracking-[0.15em] uppercase">
                    Subject 1 (Fixed)
                  </label>
                  <div className="bg-brand/5 border-brand/20 text-brand flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold">
                    <FirstSubjectIcon className="h-5 w-5" />
                    English Language
                  </div>
                </div>

                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="flex flex-col">
                    <label className="text-textDim mb-2 px-1 text-[10px] font-black tracking-[0.15em] uppercase">
                      Subject {idx + 1}
                    </label>
                    <div className="group relative">
                      <select
                        className="bg-bgSurface/50 border-borderMuted text-textMain focus:border-brand focus:ring-brand/20 w-full cursor-pointer appearance-none rounded-2xl border p-4 text-sm font-bold transition-all outline-none focus:ring-1"
                        value={selectedCombination[idx]}
                        onChange={(e) => updateSubject(idx, e.target.value)}
                      >
                        <option value="">Select subject</option>
                        {AVAILABLE_SUBJECTS.filter(
                          (s) => s.id !== "English",
                        ).map((sub) => (
                          <option
                            key={sub.id}
                            value={sub.id}
                            disabled={selectedCombination.includes(sub.id)}
                          >
                            {sub.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-textDim group-hover:text-brand pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 transition-colors">
                        <ArrowRight className="h-4 w-4 rotate-90" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={selectedCombination.some((s) => s === "") || isLoading}
              className={cn(
                "mt-10 flex w-full items-center justify-center gap-3 rounded-2xl py-5 text-sm font-black tracking-widest uppercase transition-all",
                selectedCombination.some((s) => s === "") || isLoading
                  ? "bg-bgSurface text-textMuted border-borderMuted cursor-not-allowed border"
                  : "bg-brand hover:bg-brand-light shadow-brand/20 text-white shadow-xl active:scale-[0.98]",
              )}
            >
              {isLoading ? "Preparing Exam..." : "Start Simulation"}
              <Zap className={cn("h-4 w-4", !isLoading && "fill-current")} />
            </button>
          </div>

          {/* Guidelines Card */}
          <div className="flex flex-col gap-6">
            <div className="bg-bgCard border-borderMuted border-l-brand flex-1 rounded-3xl border border-l-4 p-8 shadow-xl backdrop-blur-sm sm:p-10">
              <h3 className="text-brand mb-8 flex items-center gap-3 text-xs font-black tracking-[0.2em] uppercase">
                <Info className="h-4 w-4" />
                Exam Guidelines
              </h3>

              <div className="space-y-6">
                {[
                  {
                    label: "English",
                    value: "60 Questions",
                    icon: <BookOpen className="h-4 w-4" />,
                  },
                  {
                    label: "Other Subjects",
                    value: "40 Questions Each",
                    icon: <Target className="h-4 w-4" />,
                  },
                  {
                    label: "Total Questions",
                    value: "180 Items",
                    icon: <Layers className="h-4 w-4" />,
                  },
                  {
                    label: "Duration",
                    value: "120 Minutes",
                    icon: <Timer className="h-4 w-4" />,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="group flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-bgSurface text-textDim group-hover:text-brand flex h-8 w-8 items-center justify-center rounded-lg transition-colors">
                        {item.icon}
                      </div>
                      <span className="text-textMain text-sm font-bold">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-brand font-mono text-sm font-black">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-success/5 border-success/20 mt-12 rounded-2xl border p-6">
                <div className="mb-2 flex items-center gap-3">
                  <CheckCircle className="text-success h-4 w-4" />
                  <span className="text-success text-xs font-black tracking-widest uppercase">
                    CBT Mode Active
                  </span>
                </div>
                <p className="text-textDim text-[11px] leading-relaxed font-medium italic">
                  Answers are hidden until you submit. The timer will
                  automatically end your session if time runs out.
                </p>
              </div>
            </div>

            <div className="from-brand/20 to-brand/5 border-brand/20 group relative overflow-hidden rounded-3xl border bg-linear-to-br p-8">
              <div className="bg-brand/10 absolute -right-8 -bottom-8 h-32 w-32 rounded-full blur-3xl transition-transform duration-1000 group-hover:scale-150" />
              <div className="relative z-10">
                <p className="text-textMain mb-2 flex items-center gap-2 text-sm font-bold">
                  <Sparkles className="text-brand h-4 w-4" />
                  Want to save your progress?
                </p>
                <p className="text-textDim mb-4 text-xs leading-relaxed">
                  Guest sessions are temporary. Create a free account to track
                  your mock scores and see detailed performance analytics.
                </p>
                <button
                  onClick={() => navigate("/signup")}
                  className="text-brand flex items-center gap-2 text-xs font-black tracking-widest uppercase hover:underline"
                >
                  Join Schooldra Now <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GuestMockExam;
