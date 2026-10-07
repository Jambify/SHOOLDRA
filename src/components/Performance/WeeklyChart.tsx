// src/components/Performance/WeeklyChart.tsx

import React from "react";
import { usePerformanceStore } from "../../Store/usePerformanceStore";

const WeeklyChart: React.FC = () => {
  const { weeklyActivity } = usePerformanceStore();
  const max = Math.max(...weeklyActivity.map((d) => d.questions), 1);
  const total = weeklyActivity.reduce((s, d) => s + d.questions, 0);

  if (weeklyActivity.length === 0) {
    return (
      <div className="flex h-full min-h-50 flex-col items-center justify-center space-y-3 text-center">
        <div className="bg-bgSurface flex h-16 w-16 items-center justify-center rounded-full text-2xl opacity-50 grayscale">
          📊
        </div>
        <p className="text-textDim text-sm font-medium">
          Complete some quizzes to see your activity
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="font-display text-textMain text-2xl font-black tracking-tighter">
              {total}
            </span>
            <span className="text-brand bg-brand/10 rounded px-2 py-0.5 text-[10px] font-black tracking-widest uppercase">
              Total Qs
            </span>
          </div>
          <p className="text-textDim text-xs font-medium italic">
            Questions answered this week
          </p>
        </div>

        {/* Trend Indicator (placeholder) */}
        <div className="flex flex-col items-end">
          <div className="text-success flex items-center gap-1">
            <span className="text-xs font-black">+12%</span>
            <div className="border-b-success h-0 w-0 border-r-4 border-b-[6px] border-l-4 border-r-transparent border-l-transparent" />
          </div>
          <span className="text-textDim text-[10px] font-bold tracking-tighter uppercase">
            Vs last week
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex min-h-45 flex-1 items-end gap-3 sm:gap-4">
        {weeklyActivity.map((day) => {
          const heightPct =
            day.questions === 0 ? 8 : Math.round((day.questions / max) * 100);
          const isEmpty = day.questions === 0;
          return (
            <div
              key={day.day}
              className="group flex h-full flex-1 cursor-default flex-col items-center justify-end gap-3"
            >
              {/* Tooltip-like value */}
              <div className="relative flex w-full justify-center">
                <span className="bg-brand shadow-brand/20 pointer-events-none absolute -top-8 z-10 translate-y-2 transform rounded px-2 py-1 text-[10px] font-bold text-white opacity-0 shadow-lg transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  {day.questions} Qs
                </span>
              </div>

              <div
                className="group-hover:shadow-brand relative w-full overflow-hidden rounded-t-xl transition-all duration-1000 ease-out group-hover:brightness-125"
                style={{
                  height: `${heightPct}%`,
                  background: isEmpty
                    ? "var(--bgTrack)"
                    : `linear-gradient(to top, var(--color-brand-dim), var(--color-brand-light))`,
                  border: isEmpty ? "1px dashed var(--borderMuted)" : "none",
                }}
              >
                {!isEmpty && (
                  <div className="absolute inset-0 animate-[shimmer_4s_linear_infinite] bg-[linear-gradient(45deg,transparent_25%,color-mix(in_srgb,var(--textMain)_10%,transparent)_50%,transparent_75%)] bg-size-[40px_40px]" />
                )}
              </div>
              <span className="text-textDim group-hover:text-textMain text-[11px] font-bold tracking-tighter uppercase transition-colors">
                {day.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WeeklyChart;
