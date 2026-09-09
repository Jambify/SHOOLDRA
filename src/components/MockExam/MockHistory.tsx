import React, { useEffect, useState } from "react";
import { History, RefreshCw, BookOpen } from "lucide-react";
import {
  getMockExamHistory,
  type MockHistoryEntry,
} from "../../Services/MockHistoryService";
import MockHistoryCard from "./MockHistoryCard";
import { useUserStore } from "../../Store/useUserStore";
import SectionError from "../ui/SectionError";

const MockHistory: React.FC = () => {
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const [history, setHistory] = useState<MockHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMockExamHistory();
      setHistory(data);
    } catch (err) {
      console.error("Failed to load mock history:", err);
      setError(
        "We couldn't load your mock exam history right now. Please try again.",
      );
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  };

  useEffect(() => {
    load();
  }, [isAuthenticated]);

  return (
    <div className="bg-bgCard border-borderMuted rounded-brand-xl border p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand/10 flex h-9 w-9 items-center justify-center rounded-xl">
            <History size={18} className="text-brand" />
          </div>
          <div>
            <h3 className="font-display text-textMain font-bold">
              Exam History
            </h3>
            <p className="text-textDim text-[11px]">
              Your last 5 mock attempts
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="text-textDim hover:text-brand transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Loading — scoped skeleton only for list area, header stays always visible */}
      {isLoading && !hasFetched ? (
        <div className="space-y-4 py-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-bgSurface/50 border-borderMuted flex items-center gap-4 rounded-2xl border p-4"
            >
              <div className="bg-bgCard skeleton-shimmer flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="bg-bgCard skeleton-shimmer h-4 w-28 rounded" />
                  <div className="bg-bgCard skeleton-shimmer h-5 w-12 rounded-full" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="bg-bgCard skeleton-shimmer h-3 w-24 rounded" />
                  <div className="bg-bgCard skeleton-shimmer h-3 w-16 rounded" />
                </div>
                <div className="bg-bgCard skeleton-shimmer h-2 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : error && history.length === 0 ? (
        <SectionError message={error} onRetry={load} isRetrying={isLoading} />
      ) : hasFetched && !isLoading && history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="bg-brand/10 mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <BookOpen className="text-brand h-6 w-6" />
          </div>
          <h4 className="font-display text-textMain mb-1 font-bold">
            No Attempts Yet
          </h4>
          <p className="text-textDim max-w-48 text-sm">
            Complete your first mock exam to see your history here.
          </p>
        </div>
      ) : null}

      {/* History list */}
      {hasFetched && history.length > 0 && (
        <div className="space-y-4">
          {history.map((entry, i) => (
            <MockHistoryCard key={entry.id} entry={entry} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MockHistory;
