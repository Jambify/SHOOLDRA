/**
 * src/admin/pages/AdminUsers.tsx
 * ───────────────────────────────
 * Users management panel.
 * Actions: search, filter by status, view profile,
 *          grant/revoke Pro, freeze/unfreeze, delete.
 *
 * Owner protection: is_owner is fetched from admin_users and merged onto
 * each row. Any user who is the owner has Grant/Freeze/Delete disabled in
 * the UI — this mirrors the DB-level triggers (prevent_owner_profile_tamper,
 * prevent_owner_pro_tamper) so the buttons never even reach the server if
 * they'd fail anyway. The DB triggers are what actually enforce this;
 * this UI check is just so a non-owner admin isn't met with a confusing
 * Postgres error after clicking.
 *
 * FIX (this pass): two bugs in UserHistoryPanel —
 *   1. quiz_sessions also receives one row per subject from mock exams
 *      (see MockExam.tsx's handleFinishExam -> addQuizResult("mock", ...)),
 *      tagged mode: "mock". Those are bookkeeping writes for
 *      subject_accuracy/topic_mastery, not real practice quizzes, but the
 *      Quizzes tab was rendering them anyway with no mode filter — hence
 *      "Literature MOCK" showing up next to real "English PRACTICE" rows.
 *      Now filtered out via practiceQuizzes.
 *   2. subject_scores is actually Record<string, { correct, total, score }>
 *      (confirmed against MockHistoryService.ts's real save shape), not
 *      Record<string, number> as previously typed — String()-ing an object
 *      produced the literal "[object Object]" text. Now rendered properly
 *      as "correct/total (score%)".
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils/utils";
import {
  Search,
  RefreshCw,
  ChevronDown,
  Crown,
  ShieldOff,
  ShieldCheck,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  User,
  Mail,
  GraduationCap,
  Target,
  BookOpen,
  Calendar,
  History,
  ClipboardList,
  Timer,
  ChevronRight,
} from "lucide-react";
import PageHelmet from "../../components/SEO/PageHelmet";
import ValidatedInput from "../../components/ui/ValidatedInput";
import { truncateInput } from "../../lib/validation";
import { useUserStore } from "../../Store/useUserStore"; // Added this import!

// ── Types ─────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  university: string;
  subject_combo: string;
  target_score: string;
  exam_year: string;
  streak: number;
  overall_score: number;
  accuracy: number;
  questions_completed: number;
  is_pro: boolean;
  is_frozen: boolean;
  onboarding_complete: boolean;
  created_at: string;
  is_owner?: boolean; // merged in client-side from admin_users, not a profiles column
}

// Exact shape confirmed against MockHistoryService.ts's saveMockExamHistory —
// subject_scores is built as { [subject]: { correct, total, score } }.
interface SubjectScoreDetail {
  correct: number;
  total: number;
  score: number;
}

interface MockExamRow {
  id: string;
  taken_at: string;
  jamb_score: number;
  total_correct: number;
  total_questions: number;
  accuracy: number;
  time_taken_secs: number;
  subjects: string[];
  subject_scores: Record<string, SubjectScoreDetail> | null;
}

interface QuizSessionRow {
  id: string;
  mode: string;
  subject: string;
  total_questions: number;
  correct: number;
  accuracy: number;
  time_taken_secs: number;
  completed_at: string;
  topic_performance: Record<string, { correct: number; total: number }> | null;
}

interface StudySessionRow {
  id: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
}

type FilterStatus = "all" | "pro" | "free" | "frozen";
type ToastType = "success" | "error";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface PostgrestError {
  message: string;
}

// ── Toast helper ──────────────────────────────────────────────────────────────

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
          "animate-in slide-in-from-bottom-2 duration-200",
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

// ── Stat mini card ────────────────────────────────────────────────────────────

const StatMini: React.FC<{
  label: string;
  value: string | number;
  color?: string;
}> = ({ label, value, color }) => (
  <div className="bg-bgCard border-borderMuted rounded-brand border p-3 text-center">
    <p
      className={cn(
        "font-display text-2xl font-black tracking-tight",
        color ?? "text-textMain",
      )}
    >
      {value}
    </p>
    <p className="text-textDim mt-0.5 text-[10px] tracking-widest uppercase">
      {label}
    </p>
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDuration = (secs: number | null | undefined) => {
  if (!secs && secs !== 0) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

// Formats a subject_scores entry, which is always { correct, total, score }
// per MockHistoryService.ts. Defensive fallback kept only in case a
// legacy/malformed row (pre-dating this shape) ever slips through.
const formatSubjectScore = (
  val: SubjectScoreDetail | number | null | undefined,
): string => {
  if (val == null) return "—";
  if (typeof val === "number") return String(val);
  const { correct, total, score } = val;
  if (correct !== undefined && total !== undefined) {
    return score !== undefined
      ? `${correct}/${total} (${score}%)`
      : `${correct}/${total}`;
  }
  return score !== undefined ? `${score}%` : "—";
};

// ── User history panel (mock exams / quizzes / study sessions) ────────────────

const UserHistoryPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const [tab, setTab] = useState<"mock" | "quiz" | "study">("mock");
  const [loading, setLoading] = useState(true);
  const [mockExams, setMockExams] = useState<MockExamRow[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSessionRow[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // FIX 1: mock exams write one bookkeeping row per subject into
  // quiz_sessions (mode: "mock") purely to keep subject_accuracy /
  // topic_mastery current — those aren't real practice quizzes and are
  // already fully represented in the Mock Exams tab, so they're excluded
  // here to avoid double-showing/double-counting them as "quizzes".
  const practiceQuizzes = quizzes.filter(
    (q) => q.mode?.toLowerCase() !== "mock",
  );

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      setLoading(true);
      setErr(null);
      try {
        const [mockRes, quizRes, studyRes] = await Promise.all([
          supabase
            .from("mock_exam_history")
            .select(
              "id, taken_at, jamb_score, total_correct, total_questions, accuracy, time_taken_secs, subjects, subject_scores",
            )
            .eq("user_id", userId)
            .order("taken_at", { ascending: false })
            .limit(50),
          supabase
            .from("quiz_sessions")
            .select(
              "id, mode, subject, total_questions, correct, accuracy, time_taken_secs, completed_at, topic_performance",
            )
            .eq("user_id", userId)
            .order("completed_at", { ascending: false })
            .limit(50),
          supabase
            .from("study_sessions")
            .select("id, start_time, end_time, duration_minutes")
            .eq("user_id", userId)
            .order("start_time", { ascending: false })
            .limit(50),
        ]);

        if (mockRes.error) throw mockRes.error;
        if (quizRes.error) throw quizRes.error;
        if (studyRes.error) throw studyRes.error;

        if (!cancelled) {
          setMockExams((mockRes.data ?? []) as MockExamRow[]);
          setQuizzes((quizRes.data ?? []) as QuizSessionRow[]);
          setStudySessions((studyRes.data ?? []) as StudySessionRow[]);
        }
      } catch (e: unknown) {
        const error = e as PostgrestError;
        if (!cancelled) setErr(error.message ?? "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const totalStudyMins = studySessions.reduce(
    (sum, s) => sum + (s.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="space-y-3">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatMini
          label="Mock Exams"
          value={mockExams.length}
          color="text-brand-light"
        />
        <StatMini
          label="Quizzes"
          value={practiceQuizzes.length}
          color="text-success"
        />
        <StatMini
          label="Study Time"
          value={`${Math.round(totalStudyMins / 60)}h`}
          color="text-orange-400"
        />
      </div>

      {/* Tabs */}
      <div className="bg-bgSurface border-borderMuted rounded-brand flex gap-1 border p-1">
        {(
          [
            { key: "mock", label: "Mock Exams", icon: ClipboardList },
            { key: "quiz", label: "Quizzes", icon: History },
            { key: "study", label: "Study", icon: Timer },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all",
              tab === key
                ? "bg-bgCard text-textMain shadow-sm"
                : "text-textDim hover:text-textMain",
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="text-brand h-5 w-5 animate-spin" />
        </div>
      ) : err ? (
        <p className="text-danger px-2 py-4 text-center text-xs">{err}</p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {/* Mock exams */}
          {tab === "mock" &&
            (mockExams.length === 0 ? (
              <EmptyRow label="No mock exams taken yet" />
            ) : (
              mockExams.map((m) => (
                <div
                  key={m.id}
                  className="bg-bgSurface border-borderMuted rounded-brand border"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === m.id ? null : m.id)
                    }
                    className="flex w-full items-center justify-between gap-2 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-textMain text-sm font-semibold">
                        {m.jamb_score}
                        <span className="text-textDim font-normal"> / 400</span>
                      </p>
                      <p className="text-textDim truncate text-[11px]">
                        {fmtDate(m.taken_at)} · {m.subjects?.join(", ") || "—"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-success text-xs font-semibold">
                        {m.accuracy}%
                      </span>
                      <ChevronRight
                        className={cn(
                          "text-textDim h-3.5 w-3.5 transition-transform",
                          expandedId === m.id && "rotate-90",
                        )}
                      />
                    </div>
                  </button>
                  {expandedId === m.id && (
                    <div className="border-borderMuted space-y-1.5 border-t px-3 py-2.5">
                      <Row
                        label="Correct"
                        value={`${m.total_correct} / ${m.total_questions}`}
                      />
                      <Row
                        label="Time taken"
                        value={fmtDuration(m.time_taken_secs)}
                      />
                      <Row
                        label="Subjects"
                        value={m.subjects?.join(", ") || "—"}
                      />
                      {m.subject_scores && (
                        <div className="pt-1">
                          <p className="text-textDim mb-1 text-[10px] font-bold tracking-widest uppercase">
                            Per-subject scores
                          </p>
                          {Object.entries(m.subject_scores).map(
                            ([subj, val]) => (
                              <Row
                                key={subj}
                                label={subj}
                                value={formatSubjectScore(val)}
                              />
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ))}

          {/* Quizzes */}
          {tab === "quiz" &&
            (practiceQuizzes.length === 0 ? (
              <EmptyRow label="No quizzes taken yet" />
            ) : (
              practiceQuizzes.map((q) => (
                <div
                  key={q.id}
                  className="bg-bgSurface border-borderMuted rounded-brand border"
                >
                  <button
                    onClick={() =>
                      setExpandedId(expandedId === q.id ? null : q.id)
                    }
                    className="flex w-full items-center justify-between gap-2 p-3 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-textMain text-sm font-semibold">
                        {q.subject}
                        <span className="text-textDim ml-1.5 text-[10px] font-normal uppercase">
                          {q.mode}
                        </span>
                      </p>
                      <p className="text-textDim truncate text-[11px]">
                        {fmtDate(q.completed_at)} · {q.correct}/
                        {q.total_questions} correct
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-success text-xs font-semibold">
                        {q.accuracy}%
                      </span>
                      <ChevronRight
                        className={cn(
                          "text-textDim h-3.5 w-3.5 transition-transform",
                          expandedId === q.id && "rotate-90",
                        )}
                      />
                    </div>
                  </button>
                  {expandedId === q.id && (
                    <div className="border-borderMuted space-y-1.5 border-t px-3 py-2.5">
                      <Row label="Mode" value={q.mode} />
                      <Row
                        label="Time taken"
                        value={fmtDuration(q.time_taken_secs)}
                      />
                      {q.topic_performance && (
                        <div className="pt-1">
                          <p className="text-textDim mb-1 text-[10px] font-bold tracking-widest uppercase">
                            Topic performance
                          </p>
                          {Object.entries(q.topic_performance).map(
                            ([topic, perf]) => (
                              <Row
                                key={topic}
                                label={topic}
                                value={`${perf.correct}/${perf.total}`}
                              />
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ))}

          {/* Study sessions */}
          {tab === "study" &&
            (studySessions.length === 0 ? (
              <EmptyRow label="No study sessions logged yet" />
            ) : (
              studySessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-bgSurface border-borderMuted rounded-brand flex items-center justify-between border p-3"
                >
                  <p className="text-textMain text-sm font-medium">
                    {fmtDate(s.start_time)}
                  </p>
                  <p className="text-textDim text-xs">
                    {s.duration_minutes != null
                      ? `${s.duration_minutes} min`
                      : "In progress"}
                  </p>
                </div>
              ))
            ))}
        </div>
      )}
    </div>
  );
};

const EmptyRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
    <ClipboardList className="text-textDim h-6 w-6" />
    <p className="text-textDim text-xs">{label}</p>
  </div>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-textDim">{label}</span>
    <span className="text-textMain font-medium">{value}</span>
  </div>
);

// ── User detail drawer ────────────────────────────────────────────────────────

const UserDrawer: React.FC<{
  user: AdminUser;
  onClose: () => void;
  onAction: (action: "pro" | "freeze" | "delete", user: AdminUser) => void;
  actionLoading: string | null;
}> = ({ user, onClose, onAction, actionLoading }) => {
  const loading = (a: string) => actionLoading === `${a}-${user.id}`;
  const { id: currentUserId } = useUserStore(); // Get current user's ID
  const isOwnAccount = currentUserId === user.id; // Check if it's the admin's own account
  const isTargetOwner = !!user.is_owner; // The account being viewed IS the owner
  const actionsLocked = isOwnAccount || isTargetOwner;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="bg-bgCard animate-in slide-in-from-right relative z-10 flex h-full w-full max-w-sm flex-col shadow-2xl duration-300">
        {/* Header */}
        <div className="border-borderMuted flex shrink-0 items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-base font-semibold">User Profile</h2>
          <button
            onClick={onClose}
            className="rounded-brand hover:bg-bgSurface text-textDim hover:text-textMain p-1.5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="bg-brand/15 border-brand/25 font-display text-brand-light flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-lg font-bold">
              {user.name ? user.name.slice(0, 2).toUpperCase() : "??"}
            </div>
            <div className="min-w-0">
              <p className="text-textMain truncate font-semibold">
                {user.name || "—"}
              </p>
              <p className="text-textDim truncate text-xs">{user.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {user.is_owner && (
                  <span className="bg-warn/10 text-warn border-warn/20 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase">
                    <Crown className="h-2.5 w-2.5" />
                    Owner
                  </span>
                )}
                {user.is_pro && (
                  <span className="bg-warn/10 text-warn border-warn/20 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    PRO
                  </span>
                )}
                {user.is_frozen && (
                  <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                    FROZEN
                  </span>
                )}
                {!user.onboarding_complete && (
                  <span className="bg-textDim/10 text-textDim border-borderMuted rounded-full border px-2 py-0.5 text-[10px] font-bold">
                    INCOMPLETE
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <StatMini
              label="Best Score"
              value={user.overall_score}
              color="text-brand-light"
            />
            <StatMini
              label="Accuracy"
              value={`${user.accuracy ?? 0}%`}
              color="text-success"
            />
            <StatMini label="Questions" value={user.questions_completed} />
            <StatMini
              label="Streak"
              value={`${user.streak}d`}
              color="text-orange-400"
            />
          </div>

          {/* Profile info */}
          <div className="space-y-2.5">
            {[
              {
                icon: GraduationCap,
                label: "University",
                value: user.university || "—",
              },
              {
                icon: BookOpen,
                label: "Subjects",
                value: user.subject_combo || "—",
              },
              {
                icon: Target,
                label: "Target",
                value: user.target_score || "—",
              },
              {
                icon: Calendar,
                label: "Exam Year",
                value: user.exam_year || "—",
              },
              { icon: Mail, label: "Email", value: user.email },
              {
                icon: User,
                label: "Joined",
                value: fmtDate(user.created_at),
              },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2.5 text-sm">
                <Icon className="text-textDim mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="text-textDim w-20 shrink-0">{label}</span>
                <span className="text-textMain wrap-break">{value}</span>
              </div>
            ))}
          </div>

          {/* Exam / quiz / study history */}
          <div className="border-borderMuted border-t pt-4">
            <p className="text-textDim mb-2.5 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
              <History className="h-3 w-3" />
              Activity History
            </p>
            <UserHistoryPanel userId={user.id} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-borderMuted shrink-0 space-y-2 border-t p-4">
          {isTargetOwner && (
            <p className="bg-warn/10 text-warn border-warn/20 rounded-brand flex items-center gap-2 border px-3 py-2 text-xs">
              <Crown className="h-3.5 w-3.5 shrink-0" />
              This is the owner account — its Pro, freeze, and delete status
              can't be changed from the admin panel.
            </p>
          )}

          {/* Grant / Revoke Pro */}
          <button
            onClick={() => onAction("pro", user)}
            disabled={!!actionLoading || actionsLocked}
            className={cn(
              "rounded-brand flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all",
              actionsLocked
                ? "bg-bgSurface text-textMuted border-borderMuted cursor-not-allowed opacity-50"
                : user.is_pro
                  ? "bg-warn/10 text-warn border-warn/20 hover:bg-warn/20 border"
                  : "bg-brand hover:bg-brand-light shadow-brand/20 text-white shadow-md",
            )}
          >
            {loading("pro") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Crown className="h-4 w-4" />
            )}
            {isOwnAccount
              ? "Can't modify your own Pro access"
              : isTargetOwner
                ? "Owner account is protected"
                : user.is_pro
                  ? "Revoke Pro Access"
                  : "Grant Pro Access"}
          </button>

          {/* Freeze / Unfreeze */}
          <button
            onClick={() => onAction("freeze", user)}
            disabled={!!actionLoading || actionsLocked}
            className={cn(
              "rounded-brand flex w-full items-center justify-center gap-2 border py-2.5 text-sm font-semibold transition-all",
              actionsLocked
                ? "bg-bgSurface text-textMuted border-borderMuted cursor-not-allowed opacity-50"
                : user.is_frozen
                  ? "bg-success/10 text-success border-success/20 hover:bg-success/20"
                  : "border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
            )}
          >
            {loading("freeze") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : user.is_frozen ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            {isOwnAccount
              ? "Can't modify your own account status"
              : isTargetOwner
                ? "Owner account is protected"
                : user.is_frozen
                  ? "Unfreeze Account"
                  : "Freeze Account"}
          </button>

          {/* Delete */}
          <button
            onClick={() => onAction("delete", user)}
            disabled={!!actionLoading || actionsLocked}
            className={cn(
              "rounded-brand text-danger border-danger/20 bg-danger/10 hover:bg-danger/20 flex w-full items-center justify-center gap-2 border py-2.5 text-sm font-semibold transition-all",
              actionsLocked && "cursor-not-allowed opacity-50",
            )}
          >
            {loading("delete") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isOwnAccount
              ? "Can't delete your own account"
              : isTargetOwner
                ? "Owner account is protected"
                : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Delete confirmation modal ─────────────────────────────────────────────────

const DeleteConfirm: React.FC<{
  user: AdminUser;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}> = ({ user, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    />
    <div className="bg-bgCard border-danger/30 rounded-brand-xl animate-in fade-in zoom-in-95 relative z-10 w-full max-w-sm border p-6 shadow-2xl duration-200">
      <div className="bg-danger/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
        <Trash2 className="text-danger h-5 w-5" />
      </div>
      <h3 className="font-display mb-1 text-center text-lg font-bold">
        Delete Account?
      </h3>
      <p className="text-textDim mb-1 text-center text-sm">
        You are about to permanently delete:
      </p>
      <p className="text-textMain mb-5 text-center text-sm font-semibold">
        {user.name} ({user.email})
      </p>
      <p className="text-danger bg-danger/10 border-danger/20 rounded-brand mb-5 border px-3 py-2 text-center text-xs">
        ⚠️ This cannot be undone. All their data, quiz history, and progress
        will be permanently erased.
      </p>
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-brand bg-bgSurface border-borderMuted text-textMuted hover:text-textMain flex-1 border py-2.5 text-sm font-semibold transition-all"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="rounded-brand bg-danger hover:bg-danger/90 flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white transition-all"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Yes, Delete"
          )}
        </button>
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;
  const toastId = useRef(0);
  const { id: currentUserId } = useUserStore();

  // ── Toast helpers ──────────────────────────────────────────────────────────
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

  // ── Fetch users (+ merge is_owner from admin_users) ─────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, adminsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
            id, name, email, university, subject_combo,
            target_score, exam_year, streak, overall_score,
            accuracy, questions_completed, is_pro, is_frozen,
            onboarding_complete, created_at
          `,
          )
          .order("created_at", { ascending: false }),
        // admin_users.user_id has no FK to profiles, so this stays a
        // separate fetch + client-side merge (same pattern as AdminRoles.tsx).
        supabase.from("admin_users").select("user_id, is_owner"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (adminsRes.error) throw adminsRes.error;

      const ownerIds = new Set(
        (adminsRes.data ?? [])
          .filter((a: { user_id: string; is_owner: boolean }) => a.is_owner)
          .map((a: { user_id: string }) => a.user_id),
      );

      const merged = ((profilesRes.data ?? []) as AdminUser[]).map((u) => ({
        ...u,
        is_owner: ownerIds.has(u.id),
      }));

      setUsers(merged);
    } catch (err: unknown) {
      console.error("Failed to load users:", err);
      toast("error", "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ── Filtered + searched users ──────────────────────────────────────────────
  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.university?.toLowerCase().includes(q);

    const matchesFilter =
      filter === "all"
        ? true
        : filter === "pro"
          ? u.is_pro
          : filter === "free"
            ? !u.is_pro
            : filter === "frozen"
              ? u.is_frozen
              : true;

    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const stats = {
    total: users.length,
    pro: users.filter((u) => u.is_pro).length,
    free: users.filter((u) => !u.is_pro).length,
    frozen: users.filter((u) => u.is_frozen).length,
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const logAudit = async (
    action: string,
    target: AdminUser,
    metadata: Record<string, unknown> = {},
  ) => {
    const {
      data: { user: adminUser },
    } = await supabase.auth.getUser();
    await supabase.from("admin_audit_log").insert({
      admin_id: adminUser?.id,
      admin_email: adminUser?.email,
      action,
      target_user_id: target.id,
      target_email: target.email,
      metadata,
    });
  };

  const handleAction = async (
    action: "pro" | "freeze" | "delete",
    user: AdminUser,
  ) => {
    if (user.id === currentUserId) {
      toast("error", "You can't modify your own account!");
      return;
    }

    // Client-side guard mirroring the DB triggers (prevent_owner_profile_tamper,
    // prevent_owner_pro_tamper) — those are what actually enforce this even if
    // this check is somehow bypassed.
    if (user.is_owner) {
      toast("error", "The owner account is protected and can't be modified.");
      return;
    }

    if (action === "delete") {
      setDeleteTarget(user);
      return;
    }

    const key = `${action}-${user.id}`;
    setActionLoading(key);

    try {
      if (action === "pro") {
        const newPro = !user.is_pro;

        // Always route through pro_users — the trigger keeps profiles.is_pro in sync.
        // No more direct writes to profiles.is_pro from the admin panel.
        if (newPro) {
          // NOTE: Date.now() below only ever executes when this async function
          // runs in response to the admin clicking "Grant Pro Access" (see
          // onAction={() => onAction("pro", user)} in UserDrawer above) — it
          // never runs during render. The purity rule's static analysis can't
          // see that this whole function is only reachable via onClick, so it
          // flags it conservatively; suppressing here is correct rather than
          // restructuring already-correct event-handler code.
          // eslint-disable-next-line react-hooks/purity -- runs only inside onClick handler, never during render
          const { error } = await supabase.from("pro_users").upsert(
            {
              user_id: user.id,
              email: user.email,
              status: "active",
              plan_type: "admin_grant",
              payment_reference: `admin-grant-${Date.now()}`,
              // eslint-disable-next-line react-hooks/purity -- runs only inside onClick handler, never during render
              expires_at: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(), // 30-day comp grant; adjust as needed
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (error) throw error;
        } else {
          // Row may not exist yet (e.g. never subscribed) — upsert is safe either way
          const { error } = await supabase.from("pro_users").upsert(
            {
              user_id: user.id,
              email: user.email,
              status: "inactive",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (error) throw error;
        }

        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_pro: newPro } : u)),
        );
        if (selected?.id === user.id)
          setSelected((prev) => (prev ? { ...prev, is_pro: newPro } : null));

        await logAudit(newPro ? "grant_pro" : "revoke_pro", user, {
          previous_status: user.is_pro,
        });

        toast(
          "success",
          `Pro ${newPro ? "granted" : "revoked"} for ${user.name}`,
        );
      }

      if (action === "freeze") {
        const newFrozen = !user.is_frozen;
        const { error } = await supabase
          .from("profiles")
          .update({ is_frozen: newFrozen })
          .eq("id", user.id);
        if (error) throw error;

        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, is_frozen: newFrozen } : u,
          ),
        );
        if (selected?.id === user.id)
          setSelected((prev) =>
            prev ? { ...prev, is_frozen: newFrozen } : null,
          );

        await logAudit(newFrozen ? "freeze" : "unfreeze", user);

        toast(
          "success",
          `Account ${newFrozen ? "frozen" : "unfrozen"}: ${user.name}`,
        );
      }
    } catch (err: unknown) {
      console.error("Action failed:", err);
      toast("error", "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUserId) {
      toast("error", "You can't delete your own account!");
      setDeleteTarget(null);
      return;
    }
    if (deleteTarget.is_owner) {
      toast("error", "The owner account is protected and can't be deleted.");
      setDeleteTarget(null);
      return;
    }

    const key = `delete-${deleteTarget.id}`;
    setActionLoading(key);
    try {
      // Log BEFORE deleting — target_user_id FK would otherwise dangle after cascade
      await logAudit("delete", deleteTarget, {
        was_pro: deleteTarget.is_pro,
        university: deleteTarget.university,
      });

      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;

      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      toast("success", `Deleted: ${deleteTarget.name}`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      toast("error", "Delete failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <PageHelmet
        title="Admin Users | SCHOOLDRA"
        description="Manage Schooldra users: view profiles, exam and quiz history, grant/revoke Pro, freeze accounts, and delete users."
        canonical="https://www.schooldra.com/admin/users"
      />
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatMini label="Total Users" value={stats.total} />
        <StatMini label="Pro Users" value={stats.pro} color="text-warn" />
        <StatMini
          label="Free Users"
          value={stats.free}
          color="text-brand-light"
        />
        <StatMini label="Frozen" value={stats.frozen} color="text-blue-400" />
      </div>

      {/* Controls */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative w-full min-w-0 flex-1 sm:max-w-sm">
          <Search className="text-textDim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <ValidatedInput
            type="text"
            value={search}
            onChange={(v) => setSearch(truncateInput(v, 200))}
            placeholder="Search name, email, university…"
            className="bg-bgSurface border-borderMuted rounded-brand text-textMain placeholder:text-textDim focus:border-brand w-full border py-2.5 pr-4 pl-9 text-sm transition-colors focus:outline-none"
          />
        </div>

        {/* Filter tabs */}
        <div className="bg-bgSurface border-borderMuted rounded-brand flex shrink-0 gap-1 border p-1">
          {(["all", "pro", "free", "frozen"] as FilterStatus[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                filter === f
                  ? "bg-bgCard text-textMain shadow-sm"
                  : "text-textDim hover:text-textMain",
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="bg-bgSurface border-borderMuted rounded-brand text-textDim hover:text-textMain shrink-0 border p-2.5 transition-all"
          title="Refresh"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-bgCard border-borderMuted rounded-brand-lg overflow-hidden border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-brand h-6 w-6 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <User className="text-textDim h-10 w-10" />
            <p className="text-textDim text-sm">No users match your search</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-borderMuted bg-bgSurface/50 border-b">
                    {[
                      "User",
                      "University",
                      "Subjects",
                      "Score",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-textDim px-4 py-3 text-left text-[10px] font-bold tracking-widest uppercase first:pl-5 last:pr-5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-borderMuted divide-y">
                  {paginated.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-bgSurface/40 group transition-colors"
                    >
                      {/* User */}
                      <td className="px-4 py-3 pl-5">
                        <button
                          onClick={() => setSelected(u)}
                          className="flex w-full items-center gap-2.5 text-left"
                        >
                          <div className="bg-brand/15 text-brand-light flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                            {u.name?.slice(0, 2).toUpperCase() ?? "??"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-textMain hover:text-brand-light max-w-40 truncate font-medium transition-colors">
                                {u.name || "—"}
                              </p>
                              {u.is_owner && (
                                <Crown className="text-warn h-3 w-3 shrink-0" />
                              )}
                            </div>
                            <p className="text-textDim max-w-40 truncate text-[11px]">
                              {u.email}
                            </p>
                          </div>
                        </button>
                      </td>
                      {/* University */}
                      <td className="text-textMuted max-w-35 px-4 py-3">
                        <span className="block truncate">
                          {u.university || "—"}
                        </span>
                      </td>
                      {/* Subjects */}
                      <td className="text-textDim max-w-40 px-4 py-3">
                        <span className="block truncate text-xs">
                          {u.subject_combo || "—"}
                        </span>
                      </td>
                      {/* Score */}
                      <td className="px-4 py-3">
                        <span className="text-brand-light font-mono font-semibold">
                          {u.overall_score ?? 0}
                        </span>
                        <span className="text-textDim ml-1 text-xs">/ 400</span>
                      </td>
                      {/* Status badges */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.is_pro && (
                            <span className="bg-warn/10 text-warn border-warn/20 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                              PRO
                            </span>
                          )}
                          {u.is_frozen && (
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                              FROZEN
                            </span>
                          )}
                          {!u.is_pro && !u.is_frozen && (
                            <span className="bg-bgSurface text-textDim border-borderMuted rounded-full border px-2 py-0.5 text-[10px]">
                              FREE
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3 pr-5">
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => handleAction("pro", u)}
                            disabled={u.is_owner}
                            title={
                              u.is_owner
                                ? "Owner account is protected"
                                : u.is_pro
                                  ? "Revoke Pro"
                                  : "Grant Pro"
                            }
                            className="rounded-brand hover:bg-warn/10 text-textDim hover:text-warn disabled:hover:text-textDim p-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Crown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleAction("freeze", u)}
                            disabled={u.is_owner}
                            title={
                              u.is_owner
                                ? "Owner account is protected"
                                : u.is_frozen
                                  ? "Unfreeze"
                                  : "Freeze"
                            }
                            className="rounded-brand text-textDim disabled:hover:text-textDim p-1.5 transition-all hover:bg-blue-500/10 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            {u.is_frozen ? (
                              <ShieldCheck className="h-3.5 w-3.5" />
                            ) : (
                              <ShieldOff className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleAction("delete", u)}
                            disabled={u.is_owner}
                            title={
                              u.is_owner
                                ? "Owner account is protected"
                                : "Delete"
                            }
                            className="rounded-brand hover:bg-danger/10 text-textDim hover:text-danger disabled:hover:text-textDim p-1.5 transition-all disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-borderMuted divide-y md:hidden">
              {paginated.map((u) => (
                <div
                  key={u.id}
                  className="hover:bg-bgSurface/40 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <button
                    onClick={() => setSelected(u)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="bg-brand/15 text-brand-light flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                      {u.name?.slice(0, 2).toUpperCase() ?? "??"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-textMain truncate text-sm font-medium">
                          {u.name || "—"}
                        </p>
                        {u.is_owner && (
                          <Crown className="text-warn h-3 w-3 shrink-0" />
                        )}
                      </div>
                      <p className="text-textDim truncate text-xs">{u.email}</p>
                      <div className="mt-0.5 flex gap-1">
                        {u.is_pro && (
                          <span className="bg-warn/10 text-warn rounded-full px-1.5 py-0.5 text-[9px] font-bold">
                            PRO
                          </span>
                        )}
                        {u.is_frozen && (
                          <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold text-blue-400">
                            FROZEN
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                  <ChevronDown className="text-textDim h-4 w-4 shrink-0 -rotate-90" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-textDim text-xs">
            {filtered.length} user{filtered.length !== 1 ? "s" : ""} · Page{" "}
            {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-bgSurface border-borderMuted rounded-brand text-textMuted hover:text-textMain border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-bgSurface border-borderMuted rounded-brand text-textMuted hover:text-textMain border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* User drawer */}
      {selected && (
        <UserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <DeleteConfirm
          user={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={actionLoading === `delete-${deleteTarget.id}`}
        />
      )}

      {/* Toast notifications */}
      <ToastBar toasts={toasts} remove={removeToast} />
    </div>
  );
};

export default AdminUsers;
