import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import PageHelmet from "../components/SEO/PageHelmet";
import AppLayout from "../components/Layout/AppLayout";
import { useSubjectStore, SUBJECT_COMBO_MAP } from "../Store/useSubjectStore";
import { useUserStore } from "../Store/useUserStore";
import { routePrefetchProps } from "../routes/lazyPages";
import { cn } from "../lib/utils/utils";
import {
  Sparkles,
  Clock,
  BookOpen,
  ArrowRight,
  FileText,
  Star,
  Zap,
  Target,
  Infinity as InfinityIcon,
} from "lucide-react";
import {
  BookOpen as SubjectBookOpen,
  Calculator,
  Zap as PhysicsIcon,
  FlaskConical,
  Dna,
  BarChart3,
  Landmark,
  Church,
  Moon,
  Briefcase,
} from "lucide-react";

const getSubjectIconComponent = (subject: string) => {
  const icons: Record<string, React.ElementType> = {
    English: SubjectBookOpen,
    Mathematics: Calculator,
    Physics: PhysicsIcon,
    Chemistry: FlaskConical,
    Biology: Dna,
    Economics: BarChart3,
    Government: Landmark,
    "Literature in English": SubjectBookOpen,
    CRS: Church,
    IRS: Moon,
    Commerce: Briefcase,
  };
  return icons[subject] || SubjectBookOpen;
};

// ── Quiz deep-link helpers ──────────────────────────────────────────────

type QuizMode = "quick" | "standard" | "marathon";

/**
 * What each quiz mode really does. Keep in sync with handleStart in
 * Quiz.tsx (question count) and its duration logic, so the numbers on these
 * cards match the quiz the student actually gets.
 */
const QUIZ_MODE_INFO: Record<
  QuizMode,
  { questions: number; minutes: number; label: string }
> = {
  quick: { questions: 10, minutes: 10, label: "Quick" },
  standard: { questions: 20, minutes: 30, label: "Standard" },
  marathon: { questions: 100, minutes: 15, label: "Marathon" },
};

// The subject store uses DB naming ("Literature in English"); the Quiz page
// uses the short question-bank name ("Literature"). Same mismatch MockExam
// reconciles with normalizeSubjectId.
const QUIZ_SUBJECT_ALIASES: Record<string, string> = {
  "Literature in English": "Literature",
};
const toQuizSubject = (name: string): string =>
  QUIZ_SUBJECT_ALIASES[name] ?? name;

const quizRoute = (params: {
  subject?: string;
  topic?: string;
  mode?: QuizMode;
}): string => {
  const search = new URLSearchParams();
  if (params.subject) search.set("subject", toQuizSubject(params.subject));
  if (params.topic) search.set("topic", params.topic);
  if (params.mode) search.set("mode", params.mode);
  const query = search.toString();
  return query ? `/quiz?${query}` : "/quiz";
};

// ── Session cards ───────────────────────────────────────────────────────

interface SessionBadge {
  label: string;
  className: string;
}

interface Session {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  questions: number;
  minutes: number;
  recommended?: boolean;
  badge: SessionBadge;
  route: string;
}

type Difficulty = "Easy" | "Medium" | "Hard";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-success/10 text-success border-success/20",
  Medium: "bg-warn/10 text-warn border-warn/20",
  Hard: "bg-danger/10 text-danger border-danger/20",
};

const MODE_BADGE_CLASS = "bg-brand/10 text-brand-light border-brand/20";

function getDifficulty(accuracy: number): Difficulty {
  if (accuracy === 0) return "Easy"; // nothing attempted yet
  if (accuracy >= 70) return "Medium";
  return "Hard";
}

const SessionCard: React.FC<{ s: Session; onClick: () => void }> = ({
  s,
  onClick,
}) => (
  <button
    onClick={onClick}
    {...routePrefetchProps(s.route.split("?")[0])}
    className="bg-bgSurface border-borderMuted rounded-brand hover:border-brand/30 group flex w-full items-center gap-3 border p-3 text-left transition-all hover:translate-x-0.5"
  >
    <div
      className={cn(
        "rounded-brand flex h-9 w-9 shrink-0 items-center justify-center text-base",
        s.iconBg,
      )}
    >
      {s.icon}
    </div>
    <div className="min-w-0 flex-1">
      {s.recommended && (
        <div className="mb-0.5 flex items-center gap-1">
          <span className="text-brand-light flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase">
            <Star size={10} /> For you
          </span>
        </div>
      )}
      <p className="truncate text-sm leading-tight font-medium">{s.name}</p>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="text-textDim flex items-center gap-1 text-[11px]">
          <BookOpen className="h-3 w-3" />
          {s.questions} Qs
        </span>
        <span className="text-textDim text-[11px]">·</span>
        <span className="text-textDim flex items-center gap-1 text-[11px]">
          <Clock className="h-3 w-3" />~{s.minutes} min
        </span>
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <span
        className={cn(
          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
          s.badge.className,
        )}
      >
        {s.badge.label}
      </span>
      <span className="text-brand-light flex items-center gap-0.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
        Start <ArrowRight className="h-3 w-3" />
      </span>
    </div>
  </button>
);

const SessionListSkeleton: React.FC = () => (
  <div className="space-y-2" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="skeleton-shimmer rounded-brand h-16 w-full" />
    ))}
  </div>
);

const AllSessions: React.FC = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const {
    subjects,
    loadSubjects,
    isInitialized: subjectsInitialized,
  } = useSubjectStore();
  const totalQuestions = useUserStore((state) => state.totalQuestions);
  const subjectCombo = useUserStore((state) => state.subjectCombo);

  // "New" means nothing attempted. (questionsCompleted is the CORRECT-answer
  // count, so a student who has answered questions but got none right used
  // to be treated as brand new.)
  const isNewUser = totalQuestions === 0;

  // The page used to read `subjects` without ever loading them, so opening
  // /sessions directly (refresh / bookmark) showed no recommendations.
  useEffect(() => {
    if (!subjectsInitialized) {
      loadSubjects();
    }
  }, [loadSubjects, subjectsInitialized]);

  // Don't show a skeleton forever if the subjects never initialise.
  const [waitedTooLong, setWaitedTooLong] = useState(false);
  useEffect(() => {
    if (subjectsInitialized) return;
    const timer = setTimeout(() => setWaitedTooLong(true), 8000);
    return () => clearTimeout(timer);
  }, [subjectsInitialized]);

  const loadingRecommendations =
    !subjectsInitialized && subjects.length === 0 && !waitedTooLong;

  const userSubjects = useMemo<string[]>(() => {
    if (Array.isArray(subjectCombo)) return subjectCombo;
    return subjectCombo ? SUBJECT_COMBO_MAP[subjectCombo] || [] : [];
  }, [subjectCombo]);

  // Only recommend the student's own subjects. If the names ever fail to
  // match (naming drift), fall back to everything rather than show nothing.
  const comboSubjects = useMemo(() => {
    if (userSubjects.length === 0) return subjects;
    const wanted = new Set(userSubjects.map((n) => n.toLowerCase()));
    const matched = subjects.filter((s) => wanted.has(s.name.toLowerCase()));
    return matched.length > 0 ? matched : subjects;
  }, [subjects, userSubjects]);

  // ── Recommended: one session per subject, weakest-first ordering ──
  const recommended = useMemo<Session[]>(() => {
    const sorted = [...comboSubjects].sort((a, b) => {
      if (a.completed === 0 && b.completed === 0) return 0;
      if (a.completed === 0) return -1;
      if (b.completed === 0) return 1;
      return a.accuracy - b.accuracy;
    });

    const quick = QUIZ_MODE_INFO.quick;

    return sorted.map((s) => {
      const difficulty = getDifficulty(s.accuracy);
      const topic = s.weakTopics[0] ?? "";
      const SubjectIcon = getSubjectIconComponent(s.name);
      return {
        id: `subj-${s.id}`,
        icon: <SubjectIcon size={18} />,
        iconBg: "bg-brand/10",
        name: `${s.name}: ${topic || "Practice"}`,
        // The quiz has no 5/8-question option: recommended sessions open as
        // a Quick Fire (10 questions), so the card says exactly that.
        questions: quick.questions,
        minutes: quick.minutes,
        recommended: true,
        badge: {
          label: difficulty,
          className: DIFFICULTY_STYLES[difficulty],
        },
        route: quizRoute({ subject: s.name, topic, mode: "quick" }),
      };
    });
  }, [comboSubjects]);

  // ── Fixed session types: quick, standard, marathon, mock ──
  const otherSessions = useMemo<Session[]>(
    () => [
      {
        id: "quick",
        icon: <Zap size={18} />,
        iconBg: "bg-brand/10",
        name: "Quick Fire",
        questions: QUIZ_MODE_INFO.quick.questions,
        minutes: QUIZ_MODE_INFO.quick.minutes,
        badge: { label: QUIZ_MODE_INFO.quick.label, className: MODE_BADGE_CLASS },
        route: quizRoute({ mode: "quick" }),
      },
      {
        id: "standard",
        icon: <Target size={18} />,
        iconBg: "bg-brand/10",
        name: "Standard Practice",
        questions: QUIZ_MODE_INFO.standard.questions,
        minutes: QUIZ_MODE_INFO.standard.minutes,
        badge: {
          label: QUIZ_MODE_INFO.standard.label,
          className: MODE_BADGE_CLASS,
        },
        route: quizRoute({ mode: "standard" }),
      },
      {
        id: "marathon",
        icon: <InfinityIcon size={18} />,
        iconBg: "bg-brand/10",
        name: "Marathon Quiz",
        questions: QUIZ_MODE_INFO.marathon.questions,
        minutes: QUIZ_MODE_INFO.marathon.minutes,
        badge: {
          label: QUIZ_MODE_INFO.marathon.label,
          className: MODE_BADGE_CLASS,
        },
        route: quizRoute({ mode: "marathon" }),
      },
      {
        // There is no "mini" mock: /mock-exams always builds the full exam
        // (60 English + 40 per other subject = 180 questions, 2 hours).
        id: "mock",
        icon: <FileText size={18} />,
        iconBg: "bg-warn/10",
        name: "Full Mock Exam",
        questions: 180,
        minutes: 120,
        badge: { label: "Exam", className: DIFFICULTY_STYLES.Medium },
        route: "/mock-exams",
      },
    ],
    [],
  );

  return (
    <AppLayout
      currentPage="sessions"
      isSidebarOpen={isSidebarOpen}
      setIsSidebarOpen={setIsSidebarOpen}
    >
      <PageHelmet
        title="All Sessions | SCHOOLDRA"
        description="Browse all recommended practice sessions, quizzes, and mock exams tailored to your JAMB UTME preparation."
        canonical="https://www.schooldra.com/sessions"
      />
      <div className="animate-fadeIn mx-auto max-w-4xl space-y-6 px-2 lg:px-4">
        <div>
          <h1 className="font-display text-textMain text-2xl font-bold tracking-tight lg:text-3xl">
            All Sessions
          </h1>
          <p className="text-textDim mt-1 text-sm">
            Every recommended session and quiz mode in one place
          </p>
        </div>

        {isNewUser && (
          <div className="bg-brand/10 border-brand/20 rounded-brand flex items-center gap-2 border px-3 py-2.5">
            <Sparkles className="text-brand-light h-3.5 w-3.5 shrink-0" />
            <p className="text-brand-light text-xs leading-snug">
              Complete your first quiz to get personalised recommendations
            </p>
          </div>
        )}

        <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
          <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="text-brand-light h-4 w-4" />
            Recommended For You
          </h3>
          {loadingRecommendations ? (
            <SessionListSkeleton />
          ) : recommended.length > 0 ? (
            <div className="space-y-2">
              {recommended.map((s) => (
                <SessionCard
                  key={s.id}
                  s={s}
                  onClick={() => navigate(s.route)}
                />
              ))}
            </div>
          ) : (
            <p className="text-textDim text-xs leading-relaxed">
              No recommendations yet. Take a quiz and your suggested sessions
              will appear here.
            </p>
          )}
        </div>

        <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
          <h3 className="font-display mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <BookOpen className="text-brand-light h-4 w-4" />
            Practice & Exam Modes
          </h3>
          <div className="space-y-2">
            {otherSessions.map((s) => (
              <SessionCard key={s.id} s={s} onClick={() => navigate(s.route)} />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AllSessions;