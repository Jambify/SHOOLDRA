/**
 * src/Pages/MockExam/ReviewExam.tsx
 * ──────────────────────────────────
 * Post-exam review screen with a real AI explanation drawer.
 * The drawer uses the same useAIChat hook as MentorChat.
 */

import React, { useState, useMemo, useEffect } from "react";
import PageHelmet from "../../components/SEO/PageHelmet";
import { useNavigate } from "react-router";
import { useMockStore } from "../../Store/useMockStore";
import AppLayout from "../../components/Layout/AppLayout";
import ProGate from "../../components/pro/ProGate";
import ReportQuestionButton from "../../components/shared/ReportQuestionButton";
import { cn } from "../../lib/utils/utils";
import AIDrawer from "../../components/MockExam/AIDrawer";
import { renderQuestionText } from "../../lib/utils/renderQuestionText";
import {
  CheckCircle,
  XCircle,
  BookOpen,
  ArrowLeft,
  Filter,
  Trophy,
  Sparkles,
  ArrowUp,
} from "lucide-react";
import Button from "../../components/Layout/Button";
import type { Question } from "../../Types";
import { ExplanationText } from "../../components/shared/ExplanationText";

// ── Main ReviewScreen ─────────────────────────────────────────────────────────
const ReviewScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { questions, answers } = useMockStore();
  const navigate = useNavigate();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "correct" | "incorrect"
  >("all");
  const [selectedAIQuestion, setSelectedAIQuestion] = useState<Question | null>(
    null,
  );
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Guard: if no questions, redirect to mock exams page
  useEffect(() => {
    if (!questions || questions.length === 0) {
      navigate("/mock-exams", { replace: true });
    }
  }, [questions, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const subjectData = useMemo(() => {
    const uniqueSubjects = Array.from(new Set(questions.map((q) => q.subject)));
    return uniqueSubjects.map((sub) => {
      const subQs = questions.filter((q) => q.subject === sub);
      const score = subQs.filter(
        (q) => answers[questions.indexOf(q)] === q.answer,
      ).length;
      return { name: sub, score, total: subQs.length };
    });
  }, [questions, answers]);

  const [activeTab, setActiveTab] = useState(subjectData[0]?.name || "");

  const filteredQuestions = useMemo(() => {
    let res = questions.filter((q) => q.subject === activeTab);
    if (statusFilter === "correct")
      res = res.filter((q) => answers[questions.indexOf(q)] === q.answer);
    if (statusFilter === "incorrect")
      res = res.filter((q) => answers[questions.indexOf(q)] !== q.answer);
    return res;
  }, [activeTab, statusFilter, questions, answers]);

  return (
    <AppLayout
      currentPage="Review"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="Review Exam | SCHOOLDRA"
        description="Review your mock exam answers with explanations and ask the AI Tutor follow-ups on tricky questions."
        canonical="https://www.schooldra.com/review"
      />

      {/*
        Full mock exam review is a Pro-only feature. ProGate uses
        useProStatus internally (fresh pro_users check, not the stale
        Zustand isPro), shows its own loading skeleton while checking,
        and shows its own paywall if not Pro. Everything below only
        mounts once that check has confirmed Pro.
      */}
      <ProGate
        title="Full Mock Exam Review"
        description="Go through every question with explanations and ask the AI Tutor about anything you missed."
      >
        <div className="relative box-border w-full max-w-full overflow-x-hidden">
          <div className="mx-auto max-w-5xl overflow-hidden  py-6 md:px-8">
            {/* Header */}
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={onBack}
                icon={<ArrowLeft size={18} />}
                className="bg-brand/10 border-brand/10 text-brand hover:bg-brand/20 shrink-0 self-start rounded-xl px-4 transition-all active:scale-95"
              >
                Back
              </Button>
              <div className="bg-brand/5 border-brand/20 flex shrink-0 items-center gap-2 self-start rounded-xl border p-2.5 sm:self-auto">
                <Trophy className="text-brand h-4 w-4" />
                <span className="font-mono text-xs font-bold">
                  Total:{" "}
                  {
                    Object.values(answers).filter(
                      (a, i) => a === questions[i]?.answer,
                    ).length
                  }
                  /{questions.length}
                </span>
              </div>
            </div>

            {/* Sticky nav */}
            <div className="bg-bgPage sticky top-0 z-20 mb-6 max-w-full space-y-3 py-2">
              <div className="no-scrollbar flex max-w-full gap-2 overflow-x-auto pb-1">
                {subjectData.map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => setActiveTab(sub.name)}
                    className={cn(
                      "flex shrink-0 items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold whitespace-nowrap transition-all",
                      activeTab === sub.name
                        ? "bg-brand border-brand text-white shadow-md"
                        : "bg-bgCard border-borderMuted text-textDim hover:border-brand/40",
                    )}
                  >
                    {sub.name}
                    <span className="text-[10px] opacity-70">
                      {sub.score}/{sub.total}
                    </span>
                  </button>
                ))}
              </div>
              <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto pb-1">
                <Filter size={12} className="text-textDim shrink-0" />
                {(["all", "correct", "incorrect"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1 text-[10px] font-bold tracking-wider uppercase transition-all",
                      statusFilter === f
                        ? "bg-textMain border-textMain text-bgCard"
                        : "border-borderMuted text-textDim bg-transparent",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="bg-borderMuted h-px w-full" />
            </div>

            {/* Questions feed */}
            <div className="max-w-full space-y-6 overflow-hidden pb-20">
              {filteredQuestions.map((q, idx) => {
                const globalIdx = questions.indexOf(q);
                const userAnswer = answers[globalIdx];
                const isCorrect = userAnswer === q.answer;

                return (
                  <article
                    key={q.id}
                    className={cn(
                      "bg-bgCard box-border w-full overflow-hidden rounded-2xl border transition-all md:rounded-3xl",
                      isCorrect
                        ? "border-l-success border-success/20 border-l-4"
                        : "border-l-danger border-danger/20 border-l-4",
                    )}
                    role="region"
                    aria-label={`Question ${idx + 1}: ${q.subject}`}
                  >
                    <div className="p-4 md:p-8">
                      {/* Question header */}
                      <header className="mb-6 flex min-w-0 items-start gap-3 md:gap-5">
                        <div
                          className={cn(
                            "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm md:h-12 md:w-12",
                            isCorrect
                              ? "bg-success/10 text-success"
                              : "bg-danger/10 text-danger",
                          )}
                          aria-hidden="true"
                        >
                          {isCorrect ? (
                            <CheckCircle size={20} />
                          ) : (
                            <XCircle size={20} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-textDim font-mono text-[10px] font-bold uppercase">
                            Q {idx + 1}
                          </span>
                          <h2 className="text-textMain mt-1 text-sm leading-snug font-bold wrap-break-word md:text-lg">
                            {renderQuestionText(q.text, q.subject)}
                          </h2>
                        </div>
                      </header>

                      {/* Options */}
                      <fieldset className="mb-6 grid grid-cols-1 gap-3 md:ml-16 md:grid-cols-2">
                        <legend className="sr-only">Answer options</legend>
                        {q.options.map((opt: string, i: number) => (
                          <div
                            key={i}
                            className={cn(
                              "flex min-w-0 items-center justify-between rounded-xl border-2 p-3 text-xs transition-all md:p-4 md:text-sm",
                              i === q.answer
                                ? "border-success bg-success/5 text-success font-bold"
                                : i === userAnswer
                                  ? "border-danger bg-danger/5 text-danger"
                                  : "border-borderMuted text-textDim opacity-80",
                            )}
                          >
                            <span className="min-w-0 flex-1 pr-2 wrap-break-word">
                              <span className="mr-1 font-mono opacity-50">
                                {String.fromCharCode(65 + i)}.
                              </span>
                              {renderQuestionText(opt, q.subject)}
                            </span>
                            {i === q.answer && (
                              <CheckCircle size={14} className="ml-2 shrink-0" aria-hidden="true" />
                            )}
                            {i === userAnswer && i !== q.answer && (
                              <XCircle size={14} className="ml-2 shrink-0" aria-hidden="true" />
                            )}
                          </div>
                        ))}
                      </fieldset>

                      {/* Explanation + AI button */}
                      <footer className="space-y-4 md:ml-16">
                        <section className="bg-bgSurface/50 border-borderMuted overflow-hidden rounded-2xl border p-4">
                          <h3 className="text-brand mb-2 flex items-center gap-2 text-[10px] font-black uppercase">
                            <BookOpen size={14} aria-hidden="true" /> Explanation
                          </h3>
                          <p className="text-textMuted text-xs leading-relaxed wrap-break-word md:text-sm">
                            <ExplanationText
                              text={q.explanation || "No explanation provided."}
                            />
                          </p>
                        </section>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedAIQuestion(q)}
                              className="bg-brand shadow-brand/20 hover:bg-brand-light flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-white shadow-lg transition-all hover:scale-105 active:scale-95"
                              aria-label={`Ask AI Tutor about question ${idx + 1}`}
                            >
                              <Sparkles size={14} aria-hidden="true" />
                              <span className="text-[11px] font-bold tracking-tight uppercase">
                                Ask AI Tutor
                              </span>
                            </button>
                            <ReportQuestionButton
                              questionId={q.id}
                              context="mock_review"
                            />
                          </div>
                          <div className="min-w-0 text-right">
                            <p className="text-textDim font-mono text-[9px] uppercase">
                              Topic
                            </p>
                            <p className="text-textMain truncate text-[10px] font-bold">
                              {q.topic || "General"}
                            </p>
                          </div>
                        </div>
                      </footer>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <button
            onClick={handleScrollToTop}
            className="bg-brand hover:bg-brand-light fixed right-6 bottom-20 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 sm:right-8 sm:bottom-8"
          >
            <ArrowUp className="h-6 w-6 text-white" />
          </button>
        )}

        {/* AI Drawer — mounts fresh per question so each gets its own chat */}
        {selectedAIQuestion &&
          (() => {
            const qIdx = questions.findIndex(
              (q) => q.id === selectedAIQuestion.id,
            );
            const userAns =
              qIdx !== -1 && answers[qIdx] !== undefined && answers[qIdx] !== -1
                ? (answers[qIdx] as number)
                : -1;
            return (
              <AIDrawer
                key={selectedAIQuestion.id}
                question={selectedAIQuestion}
                userAnswer={userAns}
                onClose={() => setSelectedAIQuestion(null)}
              />
            );
          })()}
      </ProGate>
    </AppLayout>
  );
};

export default ReviewScreen;