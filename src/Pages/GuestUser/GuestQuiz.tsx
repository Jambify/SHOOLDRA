// src/Pages/Guest/GuestQuiz.tsx

import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { fetchQuestionsWithFallback } from "../../Services/questionService";
import LoadingScreen from "../../components/ui/LoadingScreen";
import type { Question } from "../../Types";
import { cn } from "../../lib/utils/utils";
import {
  ChevronLeft,
  ArrowRight,
  CheckCircle,
  XCircle,
  BookOpen,
  Sparkles,
  Shuffle,
  Trophy,
  ThumbsUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PageHelmet from "../../components/SEO/PageHelmet";
import ThemeToggle from "../../components/ui/ThemeToggle";
import schooldraLogo from "../../assets/schooldraLogo.webp";
import { SUBJECT_COLORS, getSubjectIcon } from "../../lib/subjectMeta";
import QuestionAIExplanation from "../../components/Quiz/QuestionAIExplanation";

import { useOfflineStore } from "../../Store/useOfflineStore";
import { renderQuestionText } from "../../lib/utils/renderQuestionText";
import { ExplanationText } from "../../components/shared/ExplanationText";

type Screen = "subject" | "quiz" | "results";

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
];

// Shared header — matches GuestPastQuestions.tsx exactly, so every guest
// page now has the same logo / back-link / sign-in / theme-toggle chrome.
const GuestHeader: React.FC<{ onBack: () => void; backLabel?: string }> = ({
  onBack,
  backLabel = "Back to Practice Menu",
}) => (
  <header className="border-borderMuted border-b">
    <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
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

const GuestQuiz: React.FC = () => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("subject");
  const [subject, setSubject] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showExplain, setShowExplain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleStartQuiz = async (selectedSubject: string) => {
    setSubject(selectedSubject);
    setIsLoading(true);

    try {
      // Small delay for smooth transition to loader
      await new Promise((r) => setTimeout(r, 200));

      const isOnline = navigator.onLine;
      const offlineStore = useOfflineStore.getState();

      let qs: Question[] = [];

      // Try offline first if user is offline
      if (!isOnline && selectedSubject !== "") {
        console.log(
          `📴 Guest Offline: Checking local cache for ${selectedSubject}...`,
        );
        const packs = offlineStore.downloadedPacks.filter((p) =>
          p.startsWith(selectedSubject.toLowerCase().slice(0, 3)),
        );
        if (packs.length > 0) {
          const offlineQs = await offlineStore.getOfflineQuestions(packs[0]);
          if (offlineQs.length > 0) {
            qs = offlineQs.sort(() => Math.random() - 0.5).slice(0, 10);
            console.log(
              `✅ Loaded ${qs.length} guest questions from offline pack: ${packs[0]}`,
            );
          }
        }
      }

      if (qs.length === 0) {
        qs = await fetchQuestionsWithFallback(
          selectedSubject === "" ? "Biology" : selectedSubject, // Default to Biology if random mix (for simplicity in guest mode)
          "Random",
          10,
          "All",
        );
      }

      setQuestions(qs);
      setScreen("quiz");
      setCurrent(0);
      setAnswers({});
    } catch (error) {
      console.error("Failed to load guest quiz questions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingScreen
        message="Preparing your quiz"
        variant="quiz"
        submessage={
          subject === ""
            ? "Creating a random mix for you..."
            : `Fetching ${subject} questions...`
        }
        estimatedTime={2}
      />
    );
  }

  const q = questions[current];
  const chosen = answers[current] ?? -1;
  const answered = chosen !== -1;
  const isCorrect = chosen === q?.answer;
  const score = Object.entries(answers).filter(
    ([i, a]) => a === questions[Number(i)]?.answer,
  ).length;

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setAnswers((prev) => ({ ...prev, [current]: idx }));
    setShowExplain(true);
  };

  const handleNext = () => {
    setShowExplain(false);
    if (current + 1 >= questions.length) {
      setScreen("results");
    } else {
      setCurrent((c) => c + 1);
    }
  };

  // ── Subject picker ─────────────────────────────────────────────────────
  if (screen === "subject") {
    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Free JAMB Practice Quiz | SCHOOLDRA"
          description="Take a free 10-question JAMB practice quiz — no sign-up needed."
          canonical="https://www.schooldra.com/guest/quiz"
        />
        <GuestHeader onBack={() => navigate("/guest")} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"
        >
          <div className="mb-10 text-center">
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="border-teal/25 bg-teal/10 text-teal rounded-full border px-2.5 py-1 text-[10px] font-bold">
                GUEST MODE
              </span>
            </div>
            <h2 className="font-display text-textMain mb-2 text-3xl font-black tracking-tight">
              Quick Practice
            </h2>
            <p className="text-textDim mx-auto max-w-xs text-sm leading-relaxed">
              Sharpen your skills with 10 random questions. No pressure, just
              learning.
            </p>
          </div>

          <div className="bg-bgCard border-borderMuted rounded-2xl border p-6 shadow-sm">
            <div className="text-textDim mb-6 flex items-center gap-2 text-[10px] font-black tracking-widest uppercase">
              <BookOpen size={14} className="text-brand" />
              Select a Subject
            </div>

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => handleStartQuiz("")}
                className="group bg-brand shadow-brand/20 relative overflow-hidden rounded-2xl p-5 font-bold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.98] sm:col-span-2"
              >
                <div className="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0" />
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <Shuffle className="h-6 w-6" />
                  <div className="text-left">
                    <p className="mb-1 text-sm leading-none font-black">
                      Random Mix
                    </p>
                    <p className="text-[10px] font-medium tracking-tight opacity-80">
                      Questions from across all subjects
                    </p>
                  </div>
                </div>
              </button>

              {QUIZ_SUBJECTS.map((name, idx) => {
                const Icon = getSubjectIcon(name);
                const color = SUBJECT_COLORS[name];
                return (
                  <motion.button
                    key={name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleStartQuiz(name)}
                    className="bg-bgSurface/50 border-borderMuted hover:border-brand/40 hover:bg-bgCard group flex items-center gap-4 rounded-2xl border p-4 text-sm font-bold transition-all active:scale-[0.98]"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                        color,
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-textMain group-hover:text-brand transition-colors">
                      {name}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            <div className="bg-brand/5 border-brand/20 rounded-2xl border border-dashed p-4 text-center">
              <p className="text-textMuted text-[10px] font-medium italic">
                Questions are pulled from our live JAMB database
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────────────────────────────
  if (screen === "results") {
    const pct = Math.round((score / questions.length) * 100);
    const ResultIcon = pct >= 70 ? Trophy : pct >= 50 ? ThumbsUp : BookOpen;
    const resultColor =
      pct >= 70
        ? "var(--color-warn)"
        : pct >= 50
          ? "var(--color-success)"
          : "var(--color-brand)";

    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Free JAMB Practice Quiz | SCHOOLDRA"
          description="Take a free 10-question JAMB practice quiz — no sign-up needed."
          canonical="https://www.schooldra.com/guest/quiz"
        />
        <GuestHeader onBack={() => navigate("/guest")} />

        <div className="flex flex-col items-center justify-center p-4 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center"
          >
            <div className="mb-8">
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

              <h2 className="font-display mb-2 text-4xl font-black tracking-tight">
                {score}/{questions.length}{" "}
                <span className="text-brand">Correct</span>
              </h2>

              <div className="bg-bgCard border-borderMuted mb-6 inline-block rounded-full border px-4 py-1.5 shadow-sm">
                <span className="text-textDim text-sm font-bold tracking-widest uppercase">
                  {pct}% Accuracy
                </span>
              </div>

              <p className="text-textMuted px-4 text-base leading-relaxed">
                {pct >= 80
                  ? "Incredible! You're clearly at the top of your game."
                  : pct >= 60
                    ? "Great effort! You have a solid foundation."
                    : "Keep practicing! Every mistake is a learning opportunity."}
              </p>
            </div>

            <div className="bg-bgCard border-borderMuted group relative mb-8 overflow-hidden rounded-3xl border p-8 shadow-2xl">
              <div className="bg-brand/20 group-hover:bg-brand/5 absolute top-0 left-0 h-1 w-full transition-all duration-500 group-hover:h-full" />

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-brand/10 flex h-10 w-10 items-center justify-center rounded-xl">
                    <Sparkles className="text-brand h-5 w-5" />
                  </div>
                  <p className="text-textMain text-left text-sm leading-tight font-bold">
                    Unlock the full potential of Schooldra
                  </p>
                </div>

                <p className="text-textDim mb-6 text-left text-xs leading-relaxed">
                  Create a free account to save your scores, track progress
                  across subjects, and unlock 4,000+ real JAMB questions.
                </p>

                <button
                  onClick={() => navigate("/signup")}
                  className="bg-brand hover:bg-brand-light shadow-brand/20 mb-4 w-full rounded-2xl py-4 text-sm font-black text-white shadow-xl transition-all active:scale-[0.98]"
                >
                  Create Free Account
                </button>

                <div className="text-textMuted flex items-center justify-center gap-4 text-[10px] font-bold tracking-widest uppercase">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-success" /> Save
                    Scores
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-success" /> Track
                    Progress
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => {
                  setCurrent(0);
                  setAnswers({});
                  setScreen("subject");
                }}
                className="bg-bgSurface border-borderMuted hover:border-brand/40 flex-1 rounded-2xl border py-4 text-xs font-black tracking-widest uppercase transition-all active:scale-[0.98]"
              >
                Try Another Subject
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

  // ── Quiz ─────────────────────────────────────────────────────────────────
  if (!q && screen === "quiz") {
    return (
      <div className="bg-bgMain text-textMain min-h-screen">
        <PageHelmet
          title="Free JAMB Practice Quiz | SCHOOLDRA"
          description="Take a free 10-question JAMB practice quiz — no sign-up needed."
          canonical="https://www.schooldra.com/guest/quiz"
        />
        <GuestHeader onBack={() => navigate("/guest")} />
        <div className="flex flex-col items-center justify-center p-6 py-16 text-center">
          <div className="bg-brand/10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl">
            <Sparkles className="text-brand h-8 w-8" />
          </div>
          <h2 className="font-display mb-2 text-2xl font-black">
            Session Expired
          </h2>
          <p className="text-textDim mb-8 max-w-xs text-sm">
            Your practice session was reset because of a page refresh.
          </p>
          <button
            onClick={() => setScreen("subject")}
            className="bg-brand shadow-brand/20 rounded-2xl px-8 py-4 text-sm font-black tracking-widest text-white uppercase shadow-xl transition-all active:scale-[0.98]"
          >
            Start New Session
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null; // Fallback for safety

  return (
    <div className="bg-bgMain text-textMain min-h-screen">
      <PageHelmet
        title="Free JAMB Practice Quiz | SCHOOLDRA"
        description="Take a free 10-question JAMB practice quiz — no sign-up needed."
        canonical="https://www.schooldra.com/guest/quiz"
      />
      <GuestHeader onBack={() => setScreen("subject")} backLabel="Quit Quiz" />

      <div className="flex flex-col p-4">
        {/* Question counter pill */}
        <div className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-center pt-4">
          <div className="text-textMain bg-bgCard border-borderMuted rounded-full border px-3 py-1 font-mono text-xs font-bold shadow-sm">
            {current + 1} <span className="text-textDim mx-1">/</span>{" "}
            {questions.length}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mx-auto mb-8 w-full max-w-3xl">
          <div className="bg-bgSurface border-borderMuted/30 h-1.5 overflow-hidden rounded-full border shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%`,
              }}
              className="bg-brand h-full rounded-full shadow-[0_0_10px_rgba(123,95,255,0.5)]"
              transition={{ type: "spring", stiffness: 50, damping: 20 }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mx-auto w-full max-w-3xl flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <div className="bg-bgCard border-borderMuted group relative mb-6 overflow-hidden rounded-3xl border p-6 shadow-2xl shadow-black/20 backdrop-blur-sm sm:p-8">
                <div className="bg-brand/20 group-hover:bg-brand absolute top-0 left-0 h-full w-1 transition-colors" />

                <div className="mb-4 flex items-center gap-2">
                  <span className="bg-brand/10 text-brand border-brand/20 rounded-md border px-2.5 py-1 text-[10px] font-black tracking-widest uppercase">
                    {q.subject}
                  </span>
                  <span className="bg-bgSurface text-textDim border-borderMuted rounded-md border px-2.5 py-1 text-[10px] font-black tracking-widest uppercase">
                    {q.year}
                  </span>
                </div>

                <p className="text-textMain text-lg leading-relaxed font-medium tracking-tight sm:text-xl">
                  {renderQuestionText(q.text, q.subject)}
                </p>
              </div>

              <div className="mb-8 grid grid-cols-1 gap-3">
                {q.options.map((opt, i) => {
                  const isChosen = chosen === i;
                  const isRight = i === q.answer;
                  const showRight = answered && isRight;
                  const showWrong = answered && isChosen && !isRight;

                  return (
                    <motion.button
                      key={i}
                      whileHover={!answered ? { x: 4 } : {}}
                      whileTap={!answered ? { scale: 0.98 } : {}}
                      onClick={() => handleAnswer(i)}
                      disabled={answered}
                      className={cn(
                        "group flex w-full items-center justify-between gap-4 rounded-2xl border-2 p-5 text-left text-sm font-bold transition-all sm:text-base",
                        showRight
                          ? "border-success bg-success/10 text-success shadow-success/5 shadow-lg"
                          : showWrong
                            ? "border-danger bg-danger/10 text-danger shadow-danger/5 shadow-lg"
                            : isChosen
                              ? "border-brand bg-brand/10 text-textMain"
                              : "border-borderMuted bg-bgCard hover:border-brand/40 text-textMain shadow-sm",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg font-mono text-xs transition-colors",
                            showRight
                              ? "bg-success text-white"
                              : showWrong
                                ? "bg-danger text-white"
                                : isChosen
                                  ? "bg-brand text-white"
                                  : "bg-bgDeep text-textDim group-hover:bg-brand/10 group-hover:text-brand",
                          )}
                        >
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="flex-1">
                          {renderQuestionText(opt, q.subject)}
                        </span>
                      </div>
                      {showRight && (
                        <CheckCircle className="animate-in zoom-in h-5 w-5 shrink-0 duration-300" />
                      )}
                      {showWrong && (
                        <XCircle className="animate-in zoom-in h-5 w-5 shrink-0 duration-300" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Explanation */}
              <AnimatePresence>
                {showExplain && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div
                      className={cn(
                        "rounded-3xl border-2 p-6 shadow-xl",
                        isCorrect
                          ? "bg-success/5 border-success/20 text-success shadow-success/5"
                          : "bg-danger/5 border-danger/20 text-danger shadow-danger/5",
                      )}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        {isCorrect ? (
                          <CheckCircle size={18} />
                        ) : (
                          <XCircle size={18} />
                        )}
                        <p className="text-xs font-black tracking-widest uppercase">
                          {isCorrect
                            ? "Brilliant! That's Correct"
                            : "Not quite, but keep going!"}
                        </p>
                      </div>
                      <div className="mb-4 h-px w-full bg-current opacity-10" />
                      <p className="text-textMain text-sm leading-relaxed font-medium">
                        <ExplanationText
                          text={
                            q.explanation ||
                            "No built-in explanation available."
                          }
                        />
                      </p>
                    </div>

                    {/* AI Tutor targeted explanation */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <QuestionAIExplanation
                        question={q}
                        userAnswer={chosen}
                        autoExpandOnWrong
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {answered && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleNext}
                  className="bg-brand hover:bg-brand-light shadow-brand/20 mt-8 mb-12 flex w-full items-center justify-center gap-3 rounded-2xl py-5 text-sm font-black tracking-widest text-white uppercase shadow-2xl transition-all active:scale-[0.98]"
                >
                  <span>
                    {current + 1 >= questions.length
                      ? "Finish & See Results"
                      : "Continue to Next Question"}
                  </span>
                  <ArrowRight className="h-5 w-5" />
                </motion.button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default GuestQuiz;
