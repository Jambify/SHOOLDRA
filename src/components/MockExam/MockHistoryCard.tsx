import React from "react";
import { Trophy, Clock, Target } from "lucide-react";
import type { MockHistoryEntry } from "../../Services/MockHistoryService";

interface MockHistoryCardProps {
  entry: MockHistoryEntry;
  rank: number; // 1 = most recent
}

const formatTime = (secs: number): string => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
};

const getScoreColor = (score: number): string => {
  if (score >= 280) return "text-success";
  if (score >= 200) return "text-brand";
  if (score >= 150) return "text-warn";
  return "text-danger";
};

const MockHistoryCard: React.FC<MockHistoryCardProps> = ({ entry, rank }) => {
  const date = new Date(entry.taken_at);
  const formattedDate = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-bgCard border-borderMuted hover:border-brand/30 rounded-brand-xl border p-5 transition-all hover:shadow-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand/10 flex h-8 w-8 items-center justify-center rounded-lg">
            <span className="text-brand text-xs font-black">#{rank}</span>
          </div>
          <div>
            <p className="text-textMain text-sm font-bold">{formattedDate}</p>
            <p className="text-textDim text-[11px]">{formattedTime}</p>
          </div>
        </div>
        {/* JAMB Score */}
        <div className="text-right">
          <p
            className={`font-display text-2xl font-black tracking-tight ${getScoreColor(entry.jamb_score)}`}
          >
            {entry.jamb_score}
          </p>
          <p className="text-textDim text-[10px] font-bold uppercase">/ 400</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="bg-bgSurface rounded-lg p-2 text-center">
          <Target size={12} className="text-brand mx-auto mb-1" />
          <p className="text-textMain text-sm font-bold">{entry.accuracy}%</p>
          <p className="text-textDim text-[10px]">Accuracy</p>
        </div>
        <div className="bg-bgSurface rounded-lg p-2 text-center">
          <Trophy size={12} className="text-warn mx-auto mb-1" />
          <p className="text-textMain text-sm font-bold">
            {entry.total_correct}/{entry.total_questions}
          </p>
          <p className="text-textDim text-[10px]">Correct</p>
        </div>
        <div className="bg-bgSurface rounded-lg p-2 text-center">
          <Clock size={12} className="text-textDim mx-auto mb-1" />
          <p className="text-textMain text-sm font-bold">
            {formatTime(entry.time_taken_secs)}
          </p>
          <p className="text-textDim text-[10px]">Duration</p>
        </div>
      </div>

      {/* Subject breakdown */}
      <div className="space-y-1.5">
        {entry.subjects.map((subject) => {
          const data = entry.subject_scores[subject];
          if (!data) return null;
          const pct =
            data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
          const barColor =
            pct >= 60
              ? "var(--color-success)"
              : pct >= 40
                ? "var(--color-warn)"
                : "var(--color-danger)";

          return (
            <div key={subject} className="flex items-center gap-2">
              <span className="text-textDim w-28 truncate text-[11px]">
                {subject}
              </span>
              <div className="bg-bgTrack h-1.5 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
              <span className="text-textDim w-8 text-right text-[11px] font-bold">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MockHistoryCard;
