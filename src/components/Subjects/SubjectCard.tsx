import React from "react";
import { useNavigate } from "react-router";
import type { Subject } from "../../Types/subject";
import TopicList from "./SubjectTopic";
import { cn } from "../../lib/utils/utils";
import { getAccuracyStatus } from "../../lib/subjectInsights";
import {
  Trophy,
  AlertTriangle,
  BookOpen,
  Calculator,
  Zap,
  FlaskConical,
  Dna,
  BarChart3,
  Landmark,
  Church,
  Moon,
  Briefcase,
  ChevronDown,
} from "lucide-react";

const getSubjectIconComponent = (subject: string) => {
  const icons: Record<string, React.ElementType> = {
    English: BookOpen,
    Mathematics: Calculator,
    Physics: Zap,
    Chemistry: FlaskConical,
    Biology: Dna,
    Economics: BarChart3,
    Government: Landmark,
    "Literature in English": BookOpen,
    CRS: Church,
    IRS: Moon,
    Commerce: Briefcase,
  };
  const Icon = icons[subject] || BookOpen;
  return <Icon size={20} />;
};

interface SubjectCardProps {
  subject: Subject;
  isExpanded: boolean;
  onToggle: () => void;
  isBest?: boolean;
  isWorst?: boolean;
}

const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  isExpanded,
  onToggle,
  isBest,
  isWorst,
}) => {
  const navigate = useNavigate();

  const accuracyStatus = getAccuracyStatus(subject.accuracy);

  return (
    <div
      className={cn(
        "bg-bgCard border-borderMuted hover:border-textDim/30 overflow-hidden rounded-2xl border transition-all duration-200",
        isExpanded && "border-borderMuted ring-borderMuted ring-1",
      )}
    >
      {/* Card Top Header */}
      <div className="cursor-pointer p-5 sm:p-6" onClick={onToggle}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className="group/sub flex min-w-0 flex-1 cursor-pointer items-center gap-3.5"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/quiz?subject=${encodeURIComponent(subject.name)}`);
            }}
          >
            {/* Subject Icon Box */}
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover/sub:scale-105"
              style={{
                backgroundColor: `color-mix(in srgb, ${subject.color} 12%, transparent)`,
                color: subject.color,
              }}
            >
              {getSubjectIconComponent(subject.name)}
            </div>

            <div className="min-w-0">
              <h3 className="font-display text-textMain group-hover/sub:text-brand text-base font-bold tracking-tight transition-colors">
                {subject.name}
              </h3>
              <p className="text-textMuted mt-0.5 text-[11px] font-semibold tracking-wider uppercase">
                Rank #{subject.rank} nationally
              </p>
            </div>
          </div>

          <ChevronDown
            size={18}
            className={cn(
              "text-textMuted mt-1 shrink-0 transition-transform duration-200",
              isExpanded && "text-textMain rotate-180",
            )}
          />
        </div>

        {/* Badges Row */}
        {(isBest || isWorst || accuracyStatus) && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {isBest && (
              <span className="bg-brand/10 text-brand border-brand/30 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                <Trophy size={10} /> Best
              </span>
            )}
            {isWorst && (
              <span className="bg-warn/10 text-warn-dark dark:text-warn border-warn/30 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                <AlertTriangle size={10} /> Worst
              </span>
            )}
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase",
                accuracyStatus.badgeClassName,
              )}
            >
              {accuracyStatus.label}
            </span>
          </div>
        )}

        {/* Stats Row */}
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p
              className="font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl"
              style={{ color: accuracyStatus.color }}
            >
              {subject.accuracy}%
            </p>
            <p className="text-textMuted mt-1.5 text-[11px] font-bold tracking-wider uppercase">
              Accuracy
            </p>
          </div>

          <div className="bg-bgSurface text-textMain border-borderMuted rounded-full border px-3 py-1 text-center text-xs font-semibold">
            {subject.weakTopics.length > 0
              ? `${subject.weakTopics.length} weak topic${subject.weakTopics.length > 1 ? "s" : ""}`
              : "On track"}
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="bg-bgTrack h-2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${subject.accuracy}%`,
              backgroundColor: accuracyStatus.color,
            }}
          />
        </div>
      </div>

      {/* Expanded Topic Details & Actions Drawer */}
      {isExpanded && (
        <div className="border-borderMuted bg-bgSurface/60 animate-slideDown border-t px-5 py-5 sm:px-6">
          {subject.weakTopics.length > 0 && (
            <div className="bg-bgCard border-borderMuted mb-4 rounded-xl border p-4">
              <p className="text-danger mb-2.5 flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase">
                <span className="bg-danger inline-block h-1.5 w-1.5 rounded-full" />
                Lowest Topic
              </p>
              <TopicList
                topics={subject.weakTopics}
                color={subject.color}
                onTopicClick={(topic) => {
                  navigate(
                    `/quiz?subject=${encodeURIComponent(subject.name)}&topic=${encodeURIComponent(topic)}`,
                  );
                }}
              />
            </div>
          )}

          {/* X Style Pill Buttons */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/quiz?subject=${encodeURIComponent(subject.name)}`);
              }}
              className="bg-brand hover:bg-brand/90 rounded-full px-4 py-2.5 text-xs font-bold text-white transition-all active:scale-98"
            >
              Practise this subject
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate("/performance");
              }}
              className="border-borderMuted bg-bgCard hover:bg-bgSurface text-textMain rounded-full border px-4 py-2.5 text-xs font-bold transition-all active:scale-98"
            >
              View stats
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubjectCard;
