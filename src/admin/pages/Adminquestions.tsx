/**
 * src/admin/pages/AdminQuestions.tsx
 * ─────────────────────────────────────
 * Question bank management: search, filter, add, edit, delete.
 * Requires the admin write policies in questions_admin_policies.sql to be run first.
 *
 * FIX: fetchQuestions now filters by subject/search SERVER-SIDE and pages through
 * results in chunks of 1000 (Supabase/PostgREST's hard per-request row cap), so
 * subjects whose rows fell outside the first 1000 (by created_at) are no longer
 * silently dropped.
 *
 * FIX: AdminReports links here as `/admin/Adminquestions?id=<question_id>` to
 * jump straight to a flagged question, but this page previously never read
 * that param — it always rendered the full unfiltered list regardless of the
 * URL. Now, on mount, if `?id=` is present we fetch that exact question
 * directly (independent of whatever page/filter/search state is active) and
 * open it straight in the edit modal, then strip the param from the URL so
 * refreshing the page doesn't keep reopening it.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils/utils";
import { logAdminAction } from "../../lib/utils/Auditlog";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import PageHelmet from "../../components/SEO/PageHelmet";
import ValidatedInput from "../../components/ui/ValidatedInput";
import {
  truncateInput,
  MAX_TEXT_LENGTH,
  MAX_TITLE_LENGTH,
} from "../../lib/validation";

// ── Types ─────────────────────────────────────────────────────────────

interface Question {
  id: string;
  subject: string;
  topic: string | null;
  year: number | null;
  text: string; // DB column is "text", not "question"
  options: string[];
  answer: number; // index into options
  difficulty: string; // DB enum — must match Quiz.tsx/questionService.ts: 'Easy' | 'Medium' | 'Hard'
  explanation: string | null;
  created_at: string;
}

type ToastType = "success" | "error";
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const SUBJECTS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Government",
  "Literature", // was "Literature in English" — didn't match Quiz.tsx's fetch queries
  "CRS",
  "IRS",
  "Commerce",
  "Geography",
  "History",
];

// Must match resolveDifficulty() in questionService.ts exactly (capitalized)
const DIFFICULTIES = ["Easy", "Medium", "Hard"];

const EMPTY_FORM: {
  subject: string;
  topic: string;
  year: number | null;
  text: string;
  options: string[];
  answer: number;
  difficulty: string;
  explanation: string;
} = {
  subject: SUBJECTS[0],
  topic: "",
  year: new Date().getFullYear(),
  text: "",
  options: ["", "", "", ""],
  answer: 0,
  difficulty: DIFFICULTIES[1], // "medium"
  explanation: "",
};

// Supabase/PostgREST hard cap per request — page through in chunks this size
const FETCH_CHUNK = 1000;

const QUESTION_COLUMNS =
  "id, subject, topic, year, text, options, answer, difficulty, explanation, created_at";

// ── Toast bar ─────────────────────────────────────────────────────────

const ToastBar: React.FC<{ toasts: Toast[]; remove: (id: number) => void }> = ({
  toasts,
  remove,
}) => (
  <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex flex-col gap-2">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={cn(
          "rounded-brand-lg pointer-events-auto flex items-center gap-2.5 px-4 py-3 text-sm font-medium shadow-xl",
          t.type === "success"
            ? "bg-success/10 border-success/30 text-success border"
            : "bg-danger/10 border-danger/30 text-danger border",
        )}
      >
        {t.type === "success" ? (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        )}
        <span>{t.message}</span>
        <button
          onClick={() => remove(t.id)}
          className="ml-2 opacity-60 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ))}
  </div>
);

// ── Add/Edit modal ────────────────────────────────────────────────────

const QuestionModal: React.FC<{
  initial: typeof EMPTY_FORM;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
  toast: (type: ToastType, msg: string) => void;
}> = ({ initial, editingId, onClose, onSaved, toast }) => {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);

  const setOption = (idx: number, value: string) => {
    setForm((f) => {
      const next = [...f.options];
      next[idx] = value;
      return { ...f, options: next };
    });
  };

  const handleSave = async () => {
    if (!form.text.trim() || form.options.some((o) => !o.trim())) {
      toast("error", "Question text and all 4 options are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        subject: form.subject,
        topic: form.topic.trim() || null,
        year: form.year || null,
        text: form.text.trim(),
        options: form.options.map((o) => o.trim()),
        answer: form.answer,
        difficulty: form.difficulty,
        explanation: form.explanation.trim() || null,
      };

      const targetLabel = `${payload.subject} — ${payload.text.slice(0, 60)}${payload.text.length > 60 ? "…" : ""}`;

      if (editingId) {
        const { error } = await supabase
          .from("questions")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        logAdminAction("question_updated", targetLabel, {
          question_id: editingId,
          subject: payload.subject,
        });
        toast("success", "Question updated");
      } else {
        const { data: inserted, error } = await supabase
          .from("questions")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        logAdminAction("question_added", targetLabel, {
          question_id: inserted?.id,
          subject: payload.subject,
        });
        toast("success", "Question added");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Failed to save question:", err);
      toast("error", "Failed to save question");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-bgCard border-borderMuted relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border shadow-2xl">
        <div className="border-borderMuted flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-base font-semibold">
            {editingId ? "Edit Question" : "Add Question"}
          </h2>
          <button
            onClick={onClose}
            className="text-textDim hover:text-textMain"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
                Subject
              </label>
              <select
                value={form.subject}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subject: e.target.value }))
                }
                className="bg-bgSurface border-borderMuted text-textMain focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
                Year
              </label>
              <ValidatedInput
                type="number"
                value={String(form.year ?? "")}
                onChange={(v) =>
                  setForm((f) => ({ ...f, year: v === "" ? null : Number(v) }))
                }
                className="bg-bgSurface border-borderMuted text-textMain focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
              Topic
            </label>
            <ValidatedInput
              value={form.topic}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  topic: truncateInput(v, MAX_TITLE_LENGTH),
                }))
              }
              placeholder="e.g. Ecology, Grammar, Mechanics"
              maxLength={MAX_TITLE_LENGTH}
              className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
              Question
            </label>
            <ValidatedInput
              value={form.text}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  text: truncateInput(v, MAX_TEXT_LENGTH),
                }))
              }
              rows={3}
              multiline
              maxLength={MAX_TEXT_LENGTH}
              className="bg-bgSurface border-borderMuted text-textMain focus:border-brand w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
              Difficulty
            </label>
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm((f) => ({ ...f, difficulty: e.target.value }))
              }
              className="bg-bgSurface border-borderMuted text-textMain focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
              Options (select the correct one)
            </label>
            <div className="space-y-2">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, answer: idx }))}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all",
                      form.answer === idx
                        ? "bg-success border-success text-white"
                        : "border-borderMuted text-textDim",
                    )}
                    title="Mark as correct answer"
                  >
                    {String.fromCharCode(65 + idx)}
                  </button>
                  <ValidatedInput
                    value={opt}
                    onChange={(v) => setOption(idx, truncateInput(v, 500))}
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    maxLength={500}
                    className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-textDim mb-1.5 block text-xs font-bold tracking-widest uppercase">
              Explanation (optional)
            </label>
            <ValidatedInput
              value={form.explanation}
              onChange={(v) =>
                setForm((f) => ({
                  ...f,
                  explanation: truncateInput(v, MAX_TEXT_LENGTH),
                }))
              }
              rows={2}
              placeholder="Shown to students after they answer"
              multiline
              maxLength={MAX_TEXT_LENGTH}
              className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            />
          </div>
        </div>

        <div className="border-borderMuted flex shrink-0 gap-3 border-t p-4">
          <button
            onClick={onClose}
            className="bg-bgSurface border-borderMuted text-textMuted hover:text-textMain flex-1 rounded-lg border py-2.5 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand hover:bg-brand-light flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editingId ? "Save Changes" : "Add Question"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirm ────────────────────────────────────────────────────

const DeleteConfirm: React.FC<{
  question: Question;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ question, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    />
    <div className="bg-bgCard border-danger/30 relative z-10 w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
      <div className="bg-danger/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Trash2 className="text-danger h-5 w-5" />
      </div>
      <h3 className="font-display mb-1 text-center text-lg font-bold">
        Delete Question?
      </h3>
      <p className="text-textDim mb-5 line-clamp-2 text-center text-sm">
        {question.text}
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="bg-bgSurface border-borderMuted text-textMuted hover:text-textMain flex-1 rounded-lg border py-2.5 text-sm font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="bg-danger hover:bg-danger/90 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

// ── Main page ─────────────────────────────────────────────────────────

const PER_PAGE = 20;

const AdminQuestions: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const handledDeepLinkRef = useRef(false);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  }, []);
  const removeToast = (id: number) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // Debounce the search box so we don't hit the DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      let allRows: Question[] = [];
      let from = 0;
      let grandTotal = 0;

      // Page through in chunks of FETCH_CHUNK — Supabase/PostgREST caps each
      // request's result set (default 1000 rows) regardless of table size.
      while (true) {
        let query = supabase
          .from("questions")
          .select(QUESTION_COLUMNS, { count: "exact" })
          .order("created_at", { ascending: false });

        if (subjectFilter !== "all") {
          query = query.eq("subject", subjectFilter);
        }
        if (debouncedSearch.trim()) {
          const term = debouncedSearch.trim();
          query = query.or(`text.ilike.%${term}%,topic.ilike.%${term}%`);
        }

        const { data, error, count } = await query.range(
          from,
          from + FETCH_CHUNK - 1,
        );
        if (error) throw error;

        allRows = allRows.concat((data ?? []) as Question[]);
        grandTotal = count ?? allRows.length;

        if (
          !data ||
          data.length < FETCH_CHUNK ||
          allRows.length >= grandTotal
        ) {
          break;
        }
        from += FETCH_CHUNK;
      }

      setQuestions(allRows);
      setTotalCount(grandTotal);
    } catch (err: any) {
      console.error("Failed to load questions:", err);
      toast("error", "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [toast, subjectFilter, debouncedSearch]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, subjectFilter]);

  // Deep-link handling: AdminReports sends admins here as
  // `?id=<question_id>` to jump straight to a flagged question. This is
  // independent of the normal list/pagination/search flow above — it
  // fetches that one question directly regardless of what filters are
  // active, so it always finds it even if it's on some other page or
  // doesn't match the current subject filter. Runs once per mount.
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (!idParam || handledDeepLinkRef.current) return;
    handledDeepLinkRef.current = true;

    (async () => {
      const { data, error } = await supabase
        .from("questions")
        .select(QUESTION_COLUMNS)
        .eq("id", idParam)
        .maybeSingle();

      if (error || !data) {
        toast(
          "error",
          "Couldn't find that question — it may have been deleted.",
        );
      } else {
        setEditing(data as Question);
        setModalOpen(true);
      }

      // Strip ?id= from the URL so refreshing the page (or navigating away
      // and back) doesn't keep reopening this same question's modal.
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("id");
          return next;
        },
        { replace: true },
      );
    })();
  }, [searchParams, setSearchParams, toast]);

  // Filtering is now done server-side in fetchQuestions, so `questions`
  // already reflects the current search + subject filter.
  const totalPages = Math.max(1, Math.ceil(questions.length / PER_PAGE));
  const paginated = questions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("questions")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;

      const targetLabel = `${deleteTarget.subject} — ${deleteTarget.text.slice(0, 60)}${deleteTarget.text.length > 60 ? "…" : ""}`;
      logAdminAction("question_deleted", targetLabel, {
        question_id: deleteTarget.id,
        subject: deleteTarget.subject,
      });

      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast("success", "Question deleted");
      setDeleteTarget(null);
    } catch (err: any) {
      console.error("Delete failed:", err);
      toast("error", "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setModalOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHelmet
        title="Admin Questions | SCHOOLDRA"
        description="Manage the Schooldra question bank: add, edit, delete and search questions used in practice and mock exams."
        canonical="https://www.schooldra.com/admin/questions"
      />
      {/* Header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Question Bank</h2>
          <p className="text-textDim text-sm">{totalCount} questions total</p>
        </div>
        <button
          onClick={openAdd}
          className="bg-brand hover:bg-brand-light flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Add Question
        </button>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-textDim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <ValidatedInput
            value={search}
            onChange={(v) => setSearch(truncateInput(v, 200))}
            placeholder="Search question text or topic…"
            className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm outline-none"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="bg-bgSurface border-borderMuted text-textMain focus:border-brand rounded-lg border px-3 py-2.5 text-sm outline-none"
        >
          <option value="all">All subjects</option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-bgCard border-borderMuted overflow-hidden rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-brand h-6 w-6 animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <BookOpen className="text-textDim h-10 w-10" />
            <p className="text-textDim text-sm">
              No questions match your search
            </p>
          </div>
        ) : (
          <div className="divide-borderMuted divide-y">
            {paginated.map((q) => (
              <div key={q.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="bg-brand/10 text-brand-light rounded-full px-2 py-0.5 text-[10px] font-bold">
                      {q.subject}
                    </span>
                    {q.topic && (
                      <span className="bg-bgSurface text-textDim rounded-full px-2 py-0.5 text-[10px]">
                        {q.topic}
                      </span>
                    )}
                    {q.year && (
                      <span className="text-textDim text-[10px]">{q.year}</span>
                    )}
                  </div>
                  <p className="text-textMain truncate text-sm">{q.text}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEdit(q)}
                    className="hover:bg-bgSurface text-textDim hover:text-textMain rounded-lg p-2"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(q)}
                    className="hover:bg-danger/10 text-textDim hover:text-danger rounded-lg p-2"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-textDim text-xs">
            {questions.length} question{questions.length !== 1 ? "s" : ""} ·
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-bgSurface border-borderMuted text-textMuted hover:text-textMain rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-bgSurface border-borderMuted text-textMuted hover:text-textMain rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <QuestionModal
          initial={
            editing
              ? {
                  subject: editing.subject,
                  topic: editing.topic ?? "",
                  year: editing.year ?? new Date().getFullYear(),
                  text: editing.text,
                  options: editing.options,
                  answer: editing.answer,
                  difficulty: editing.difficulty ?? DIFFICULTIES[1],
                  explanation: editing.explanation ?? "",
                }
              : EMPTY_FORM
          }
          editingId={editing?.id ?? null}
          onClose={() => setModalOpen(false)}
          onSaved={fetchQuestions}
          toast={toast}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          question={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      <ToastBar toasts={toasts} remove={removeToast} />
    </div>
  );
};

export default AdminQuestions;
