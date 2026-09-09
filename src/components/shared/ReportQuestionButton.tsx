/**
 * src/components/shared/ReportQuestionButton.tsx
 * ──────────────────────────────────────────────────
 * Small "Report issue" button + modal. Drop into any question card
 * (quiz, mock exam review, past-questions browser). Requires the
 * question_reports.sql migration to be run first.
 *
 * The modal is rendered via a React Portal directly into document.body.
 * This is required because the button lives inside animated wrapper
 * divs (e.g. Tailwind's animate-in/fade-in utilities), which apply a
 * CSS transform. Any ancestor with a transform creates a new
 * "containing block" for position: fixed descendants — so without the
 * portal, the modal centers relative to that (potentially very tall,
 * for long comprehension questions) ancestor box instead of the actual
 * browser viewport, pushing it off-screen. Portaling to document.body
 * escapes that entirely.
 *
 * Usage:
 *   <ReportQuestionButton questionId={q.id} context="mock_review" />
 *   <ReportQuestionButton questionId={q.id} context="quiz" />
 *   <ReportQuestionButton questionId={q.id} context="quiz" compact /> // icon-only, for tight spaces like a meta row
 */

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabase";
import { Flag, X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils/utils";
import ValidatedInput from "../ui/ValidatedInput";
import { MAX_TEXT_LENGTH } from "../../lib/validation";

const REASONS = [
  { value: "wrong_answer", label: "The marked answer is wrong" },
  { value: "unclear", label: "Question is unclear or ambiguous" },
  { value: "typo", label: "Typo or formatting issue" },
  { value: "duplicate", label: "This looks like a duplicate" },
  { value: "other", label: "Something else" },
];

interface ReportQuestionButtonProps {
  questionId: string;
  context?: "quiz" | "mock_review" | "past-questions" | "mock_exam";
  className?: string;
  /** Icon-only rendering with no visible label — for tight spaces like a meta/badge row. Defaults to false. */
  compact?: boolean;
}

const ReportQuestionButton: React.FC<ReportQuestionButtonProps> = ({
  questionId,
  context = "quiz",
  className,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in to report a question.");

      const { error: insertError } = await supabase
        .from("question_reports")
        .insert({
          question_id: questionId,
          reported_by: user.id,
          reason,
          details: details.trim() || null,
          context,
        });
      if (insertError) throw insertError;

      setSubmitted(true);
      setTimeout(() => {
        setOpen(false);
        setSubmitted(false);
        setDetails("");
        setReason(REASONS[0].value);
      }, 1500);
    } catch (err: any) {
      console.error("Failed to submit report:", err);
      setError("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !submitting && setOpen(false)}
      />
      <div className="bg-bgCard border-borderMuted relative z-10 max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl border p-5 shadow-2xl">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="bg-success/10 flex h-12 w-12 items-center justify-center rounded-full">
              <CheckCircle2 className="text-success h-6 w-6" />
            </div>
            <p className="text-textMain text-sm font-semibold">
              Thanks — we'll take a look at this question.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold">
                Report this question
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-textDim hover:text-textMain"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-all",
                    reason === r.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-borderMuted text-textMuted hover:border-brand/30",
                  )}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="accent-brand"
                  />
                  {r.label}
                </label>
              ))}
            </div>

            <ValidatedInput
              value={details}
              onChange={(v) => setDetails(v)}
              placeholder="Anything else we should know? (optional)"
              multiline
              rows={2}
              maxLength={MAX_TEXT_LENGTH}
              className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand mb-3 w-full resize-none rounded-lg border px-3 py-2 text-xs outline-none"
            />

            {error && <p className="text-danger mb-3 text-xs">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="bg-bgSurface border-borderMuted text-textMuted hover:text-textMain flex-1 rounded-lg border py-2 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-danger hover:bg-danger/90 flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Submit Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "text-textDim hover:text-danger flex items-center transition-colors",
          compact
            ? "h-7 w-7 shrink-0 items-center justify-center rounded-full"
            : "gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
          className,
        )}
        title="Report an issue with this question"
      >
        <Flag className="h-3.5 w-3.5" />
        {!compact && "Report issue"}
      </button>

      {open && createPortal(modal, document.body)}
    </>
  );
};

export default ReportQuestionButton;
