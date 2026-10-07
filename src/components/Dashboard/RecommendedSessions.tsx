import React, { useMemo } from "react";
import { useNavigate } from "react-router";
import { useSubjectStore } from "../../Store/useSubjectStore";
import { useUserStore } from "../../Store/useUserStore";
import { cn } from "../../lib/utils/utils";
import {
  Sparkles,
  Clock,
  BookOpen,
  ArrowRight,
  FileText,
  Star,
} from "lucide-react";

import {
  BookOpen as SubjectBookOpen,
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

const getSubjectIconComponent = (subject: string) => {
  const icons: Record<string, React.ElementType> = {
    English: SubjectBookOpen,
    Mathematics: Calculator,
    Physics: Zap,
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

const QUIZ_SUBJECT_ALIASES: Record<string, string> = {
  "Literature in English": "Literature",
};

const quizRoute = (subject: string, topic?: string): string => {
  const params = new URLSearchParams({
    subject: QUIZ_SUBJECT_ALIASES[subject] ?? subject,
    mode: "quick",
  });
  if (topic) params.set("topic", topic);
  return `/quiz?${params.toString()}`;
};

interface Session {
  id: string;
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  questions: number;
  minutes: number;
  tag: "recommended" | "mock" | "review";
  difficulty: "Easy" | "Medium" | "Hard";
  route: string;
  subjectColor?: string;
}

const DIFFICULTY_STYLES = {
  Easy: "bg-success/10 text-success border-success/20",
  Medium: "bg-warn/10 text-warn border-warn/20",
  Hard: "bg-danger/10 text-danger border-danger/20",
};

function getDifficulty(accuracy: number): "Easy" | "Medium" | "Hard" {
  if (accuracy === 0) return "Easy";
  if (accuracy >= 70) return "Medium";
  if (accuracy >= 45) return "Hard";
  return "Hard";
}

const RecommendedSessions: React.FC = () => {
  const navigate = useNavigate();
  const { subjects } = useSubjectStore();
  const { totalQuestions } = useUserStore();

  const sessions = useMemo<Session[]>(() => {
    // Sort subjects: weakest first (lowest accuracy), then unstarted
    const sorted = [...subjects].sort((a, b) => {
      if (a.completed === 0 && b.completed === 0) return 0;
      if (a.completed === 0) return -1;
      if (b.completed === 0) return 1;
      return a.accuracy - b.accuracy;
    });

    const built: Session[] = [];

    // Up to 2 subject-based recommendations
    for (const s of sorted.slice(0, 2)) {
      const diff = getDifficulty(s.accuracy);
      const topic = s.weakTopics[0] ?? "";
      const SubjectIcon = getSubjectIconComponent(s.name);
      built.push({
        id: `subj-${s.id}`,
        icon: <SubjectIcon size={18} />,
        iconBg: "bg-brand/10",
        name: `${s.name}: ${s.weakTopics[0] ?? "Practice"}`,
        questions: 10,
        minutes: 10,
        tag: "recommended",
        difficulty: diff,
        route: quizRoute(s.name, topic),
        subjectColor: s.color,
      });
    }

    // Always add a mock exam slot
    built.push({
      id: "mock",
      icon: <FileText size={18} />,
      iconBg: "bg-warn/10",
      name: "Full Mock Exam",
      questions: 180,
      minutes: 120,
      tag: "mock",
      difficulty: "Medium",
      route: "/mock-exams",
    });

    return built;
  }, [subjects]);

  const isNewUser = totalQuestions === 0;

  return (
    <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Sparkles className="text-brand-light h-4 w-4" />
          Recommended Sessions
        </h3>
        <button
          onClick={() => navigate("/sessions")}
          className="text-brand-light text-xs hover:underline"
        >
          See all →
        </button>
      </div>

      {/* New-user nudge banner */}
      {isNewUser && (
        <div className="bg-brand/10 border-brand/20 rounded-brand mb-3 flex items-center gap-2 border px-3 py-2.5">
          <Sparkles className="text-brand-light h-3.5 w-3.5 shrink-0" />
          <p className="text-brand-light text-xs leading-snug">
            Complete your first quiz to get personalised recommendations
          </p>
        </div>
      )}

      {/* Session cards — single column on mobile, same on desktop */}
      <div className="space-y-2">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(s.route)}
            className="bg-bgSurface border-borderMuted rounded-brand hover:border-brand/30 group flex w-full items-center gap-3 border p-3 text-left transition-all hover:translate-x-0.5"
          >
            {/* Icon */}
            <div
              className={cn(
                "rounded-brand flex h-9 w-9 shrink-0 items-center justify-center text-base",
                s.iconBg,
              )}
            >
              {s.icon}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Recommended badge */}
              {s.tag === "recommended" && (
                <div className="mb-0.5 flex items-center gap-1">
                  <span className="text-brand-light flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase">
                    <Star size={10} /> For you
                  </span>
                </div>
              )}
              <p className="truncate text-sm leading-tight font-medium">
                {s.name}
              </p>
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

            {/* Right side: difficulty + arrow */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  DIFFICULTY_STYLES[s.difficulty],
                )}
              >
                {s.difficulty}
              </span>
              <span className="text-brand-light flex items-center gap-0.5 text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Start <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecommendedSessions;
