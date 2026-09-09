/**
 * src/admin/pages/AdminTopicOverview.tsx
 * ─────────────────────────────────────
 * Read-only dashboard showing question-bank health per subject/topic —
 * built after the Aug 2026 topic consolidation to catch future
 * fragmentation early (new questions added under a stray topic name,
 * a subject drifting thin again, etc.) without needing to run SQL
 * manually each time.
 *
 * Calls the get_topic_question_counts() RPC (see migration notes) since
 * Supabase's JS client has no native GROUP BY support.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { cn } from "../../lib/utils/utils";
import PageHelmet from "../../components/SEO/PageHelmet";
import ValidatedInput from "../../components/ui/ValidatedInput";
import { truncateInput } from "../../lib/validation";
import SectionError from "../../components/ui/SectionError";
import {
  AlertTriangle,
  Loader2,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TopicRow {
  subject: string;
  topic: string;
  question_count: number;
}

interface SubjectGroup {
  subject: string;
  totalQuestions: number;
  topicCount: number;
  topics: TopicRow[];
}

// Below this, a topic can't sustain a 20-question quiz on its own —
// flagged in the UI so it's easy to spot new fragmentation before it
// grows into the mess the Aug 2026 consolidation cleaned up.
const THIN_TOPIC_THRESHOLD = 20;

const AdminTopicOverview: React.FC = () => {
  const [rows, setRows] = useState<TopicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "get_topic_question_counts",
      );
      if (rpcError) throw rpcError;
      setRows((data ?? []) as TopicRow[]);
    } catch (err: unknown) {
      console.error("Failed to load topic counts:", err);
      setError("Failed to load topic counts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const grouped: SubjectGroup[] = useMemo(() => {
    const map = new Map<string, TopicRow[]>();
    rows.forEach((r) => {
      const list = map.get(r.subject) ?? [];
      list.push(r);
      map.set(r.subject, list);
    });

    return Array.from(map.entries())
      .map(([subject, topics]) => ({
        subject,
        topics: topics.sort((a, b) => a.question_count - b.question_count),
        topicCount: topics.length,
        totalQuestions: topics.reduce((sum, t) => sum + t.question_count, 0),
      }))
      .filter((g) =>
        search
          ? g.subject.toLowerCase().includes(search.toLowerCase()) ||
            g.topics.some((t) =>
              t.topic.toLowerCase().includes(search.toLowerCase()),
            )
          : true,
      )
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [rows, search]);

  const totalThinTopics = useMemo(
    () => rows.filter((r) => r.question_count < THIN_TOPIC_THRESHOLD).length,
    [rows],
  );

  const toggleSubject = (subject: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <PageHelmet
        title="Topic Overview | SCHOOLDRA"
        description="Question bank health check — topic and question counts per subject."
        canonical="https://www.schooldra.com/admin/topics"
      />

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">
            Question Bank — Topic Overview
          </h2>
          <p className="text-textDim text-sm">
            Topic and question counts per subject. Topics below{" "}
            {THIN_TOPIC_THRESHOLD} questions are flagged — they can't sustain a
            standalone 20-question quiz.
          </p>
        </div>
        <button
          onClick={fetchCounts}
          disabled={loading}
          className="bg-bgSurface border-borderMuted text-textDim hover:text-brand flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      {!loading && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-bgCard border-borderMuted rounded-xl border p-4">
            <p className="text-textDim text-[10px] font-bold tracking-widest uppercase">
              Subjects
            </p>
            <p className="font-display mt-1 text-2xl font-bold">
              {grouped.length}
            </p>
          </div>
          <div className="bg-bgCard border-borderMuted rounded-xl border p-4">
            <p className="text-textDim text-[10px] font-bold tracking-widest uppercase">
              Total Topics
            </p>
            <p className="font-display mt-1 text-2xl font-bold">
              {rows.length}
            </p>
          </div>
          <div className="bg-bgCard border-borderMuted rounded-xl border p-4">
            <p className="text-textDim text-[10px] font-bold tracking-widest uppercase">
              Total Questions
            </p>
            <p className="font-display mt-1 text-2xl font-bold">
              {rows.reduce((sum, r) => sum + r.question_count, 0)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border p-4",
              totalThinTopics > 0
                ? "bg-warn/10 border-warn/30"
                : "bg-success/10 border-success/30",
            )}
          >
            <p
              className={cn(
                "text-[10px] font-bold tracking-widest uppercase",
                totalThinTopics > 0 ? "text-warn" : "text-success",
              )}
            >
              Thin Topics (&lt;{THIN_TOPIC_THRESHOLD})
            </p>
            <p
              className={cn(
                "font-display mt-1 text-2xl font-bold",
                totalThinTopics > 0 ? "text-warn" : "text-success",
              )}
            >
              {totalThinTopics}
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="text-textDim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <ValidatedInput
          value={search}
          onChange={(v) => setSearch(truncateInput(v, 100))}
          placeholder="Search subject or topic…"
          className="bg-bgSurface border-borderMuted text-textMain placeholder:text-textDim focus:border-brand w-full rounded-lg border py-2.5 pr-4 pl-9 text-sm outline-none"
        />
      </div>

      {/* Content */}
      <div className="bg-bgCard border-borderMuted overflow-hidden rounded-xl border">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="text-brand h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <SectionError
            message={error || ""}
            onRetry={fetchCounts}
            isRetrying={loading}
          />
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="text-textDim h-10 w-10" />
            <p className="text-textDim text-sm">No matching subjects/topics</p>
          </div>
        ) : (
          <div className="divide-borderMuted divide-y">
            {grouped.map((group) => {
              const thinCount = group.topics.filter(
                (t) => t.question_count < THIN_TOPIC_THRESHOLD,
              ).length;
              const isExpanded = expandedSubjects.has(group.subject);

              return (
                <div key={group.subject}>
                  <button
                    onClick={() => toggleSubject(group.subject)}
                    className="hover:bg-bgSurface/50 flex w-full items-center justify-between p-5 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-sm font-bold">
                        {group.subject}
                      </span>
                      <span className="bg-bgSurface text-textDim rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {group.topicCount} topics
                      </span>
                      <span className="bg-bgSurface text-textDim rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {group.totalQuestions} questions
                      </span>
                      {thinCount > 0 && (
                        <span className="bg-warn/10 text-warn border-warn/30 flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold">
                          <AlertTriangle className="h-3 w-3" />
                          {thinCount} thin
                        </span>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="text-textDim h-4 w-4" />
                    ) : (
                      <ChevronDown className="text-textDim h-4 w-4" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-borderMuted bg-bgSurface/20 border-t px-5 py-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.topics.map((t) => (
                          <div
                            key={t.topic}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2 text-xs",
                              t.question_count < THIN_TOPIC_THRESHOLD
                                ? "bg-warn/5 border-warn/20 text-warn"
                                : "bg-bgCard border-borderMuted text-textMain",
                            )}
                          >
                            <span className="truncate pr-2">{t.topic}</span>
                            <span className="shrink-0 font-mono font-bold">
                              {t.question_count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTopicOverview;
