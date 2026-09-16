/**
 * src/admin/pages/AdminOverview.tsx
 * ───────────────────────────────────
 * Quick-glance stats for the admin dashboard.
 *
 * ADDED:
 *  1. Open Reports card — count of question_reports with status = 'open',
 *     links straight to /admin/reports so backlog is visible at a glance.
 *  2. Expiring Soon card — count of active pro_users subscriptions whose
 *     expires_at falls within the next 7 days.
 *  3. Question Bank by Subject — lightweight CSS bar chart showing question
 *     counts per subject, using exact counts (not row fetches) so it's
 *     unaffected by Supabase's 1000-row-per-request cap.
 */

import React, { useEffect, useState, useCallback } from "react";
import PageHelmet from "../../components/SEO/PageHelmet";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import {
  Users,
  Crown,
  BookOpen,
  Activity,
  Wallet,
  UserPlus,
  AlertTriangle,
  Clock,
  BarChart3,
} from "lucide-react";
import { cn } from "../../lib/utils/utils";
import SectionError from "../../components/ui/SectionError";
import ErrorBanner from "../../components/ui/ErrorBanner";

interface Stats {
  totalUsers: number;
  proUsers: number;
  frozenUsers: number;
  totalQuizSessions: number;
  totalMockExams: number;
  avgAccuracy: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  activeRevenue: number;
  openReports: number; // NEW
  expiringSoon: number; // NEW
}

interface RecentSignup {
  id: string;
  name: string;
  university: string;
  created_at: string;
}

interface SubjectCount {
  subject: string;
  count: number;
}

interface ProfileRow {
  is_pro: boolean | null;
  is_frozen: boolean | null;
  accuracy: number | null;
}

interface RevenueRow {
  amount: string | number | null;
  status: string | null;
  expires_at: string | null;
}

// Must match the subject list used in AdminQuestions.tsx / questionService.ts
const SUBJECTS = [
  "English",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Government",
  "Literature",
  "CRS",
  "IRS",
  "Commerce",
  "Geography",
  "History",
];

const SUBJECT_COLORS: Record<string, string> = {
  English: "#7B5FFF",
  Mathematics: "#00C896",
  Physics: "#FFB020",
  Chemistry: "#FF4D6D",
  Biology: "#00C896",
  Economics: "#7B5FFF",
  Government: "#FFB020",
  Literature: "#7B5FFF",
  History: "#FF4D6D",
  Geography: "#00C896",
  CRS: "#7B5FFF",
  IRS: "#00C896",
  Commerce: "#FFB020",
};

const Card: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
  urgent?: boolean;
}> = ({ label, value, sub, icon, color, href, urgent }) => {
  const content = (
    <div
      className={cn(
        "bg-bgCard rounded-brand-lg flex h-full flex-col gap-3 border p-5 transition-all",
        urgent
          ? "border-danger/30 hover:border-danger/50"
          : "border-borderMuted",
        href && "hover:border-brand/40 cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-textDim text-[10px] font-bold tracking-widest uppercase">
          {label}
        </span>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            color,
          )}
        >
          {icon}
        </div>
      </div>
      <p
        className={cn(
          "font-display text-3xl font-black tracking-tight",
          urgent && Number(value) > 0 ? "text-danger" : "text-textMain",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-textDim text-xs">{sub}</p>}
    </div>
  );

  return href ? (
    <Link to={href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );
};

const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [subjectCounts, setSubjectCounts] = useState<SubjectCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsManualRefreshing(true);
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
      const weekFromNow = new Date(Date.now() + 7 * 86400_000).toISOString();

      const [
        profiles,
        sessions,
        mocks,
        newToday,
        newWeek,
        revenue,
        recent,
        openReportsRes,
        expiringRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_pro, is_frozen, accuracy", { count: "exact" }),
        supabase
          .from("quiz_sessions")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("mock_exam_history")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", today),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgo),
        supabase
          .from("pro_users")
          .select("amount, status, expires_at")
          .eq("status", "active"),
        supabase
          .from("profiles")
          .select("id, name, university, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("question_reports")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
        supabase
          .from("pro_users")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .gte("expires_at", today)
          .lte("expires_at", weekFromNow),
      ]);

      const rows = (profiles.data ?? []) as ProfileRow[];
      const proCount = rows.filter((r) => r.is_pro).length;
      const frozen = rows.filter((r) => r.is_frozen).length;
      const accs = rows.map((r) => r.accuracy ?? 0).filter(Boolean);
      const avgAcc = accs.length
        ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length)
        : 0;

      const activeRevenue = ((revenue.data ?? []) as RevenueRow[])
        .filter((r) => !r.expires_at || new Date(r.expires_at) > new Date())
        .reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

      setStats({
        totalUsers: profiles.count ?? 0,
        proUsers: proCount,
        frozenUsers: frozen,
        totalQuizSessions: sessions.count ?? 0,
        totalMockExams: mocks.count ?? 0,
        avgAccuracy: avgAcc,
        newUsersToday: newToday.count ?? 0,
        newUsersThisWeek: newWeek.count ?? 0,
        activeRevenue,
        openReports: openReportsRes.count ?? 0,
        expiringSoon: expiringRes.count ?? 0,
      });

      setRecentSignups((recent.data ?? []) as RecentSignup[]);

      const subjectResults = await Promise.all(
        SUBJECTS.map(async (subject) => {
          const { count } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("subject", subject);
          return { subject, count: count ?? 0 };
        }),
      );
      setSubjectCounts(subjectResults.sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error("[AdminOverview]", err);
      setError("Failed to load admin overview. Please try again.");
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setIsManualRefreshing(false), 600);
      }
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const handleManualRefresh = () => loadData(true);

  const hasData = stats !== null;

  const maxSubjectCount = Math.max(1, ...subjectCounts.map((s) => s.count));

  return (
    <div className="space-y-6">
      <PageHelmet
        title="Admin Overview | SCHOOLDRA"
        description="Overview of Schooldra administration stats, recent signups, and quick links to manage users, reports, and the question bank."
        canonical="https://www.schooldra.com/admin"
      />

      {error && hasData && (
        <ErrorBanner
          message={error}
          onRetry={handleManualRefresh}
          isRetrying={isManualRefreshing}
        />
      )}

      {/* Stats row - section-scoped skeleton, error, or real data */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="bg-bgCard rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="bg-bgSurface skeleton-shimmer h-10 w-10 rounded-xl" />
                <div className="bg-bgSurface skeleton-shimmer h-6 w-14 rounded-full" />
              </div>
              <div className="bg-bgSurface skeleton-shimmer mb-1 h-8 w-24 rounded" />
              <div className="bg-bgSurface skeleton-shimmer h-3 w-28 rounded" />
            </div>
          ))}
        </div>
      ) : !stats ? (
         <SectionError
          message={error || "Failed to load admin overview. Please try again."}
          onRetry={handleManualRefresh}
          isRetrying={isManualRefreshing}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card
              label="Total Users"
              value={stats.totalUsers}
              sub={`+${stats.newUsersToday} today · +${stats.newUsersThisWeek} this week`}
              icon={<Users className="text-brand h-4 w-4" />}
              color="bg-brand/10"
            />
            <Card
              label="Pro Users"
              value={stats.proUsers}
              sub={`${stats.totalUsers ? Math.round((stats.proUsers / stats.totalUsers) * 100) : 0}% of total`}
              icon={<Crown className="text-warn h-4 w-4" />}
              color="bg-warn/10"
            />
            <Card
              label="Quiz Sessions"
              value={stats.totalQuizSessions.toLocaleString()}
              sub="All time practice sessions"
              icon={<BookOpen className="text-success h-4 w-4" />}
              color="bg-success/10"
            />
            <Card
              label="Mock Exams"
              value={stats.totalMockExams.toLocaleString()}
              sub="Completed mock exams"
              icon={<Activity className="h-4 w-4 text-blue-400" />}
              color="bg-blue-500/10"
            />
          </div>

          {/* ── NEW ROW: Needs-attention cards ──────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              label="Open Reports"
              value={stats.openReports}
              sub={
                stats.openReports > 0
                  ? "Awaiting review — tap to see them"
                  : "All caught up"
              }
              icon={<AlertTriangle className="text-danger h-4 w-4" />}
              color="bg-danger/10"
              href="/admin/reports"
              urgent
            />
            <Card
              label="Expiring Soon"
              value={stats.expiringSoon}
              sub="Active subscriptions expiring within 7 days"
              icon={<Clock className="text-warn h-4 w-4" />}
              color="bg-warn/10"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card
              label="Avg Accuracy"
              value={`${stats.avgAccuracy}%`}
              sub="Across all users"
              icon={<Activity className="text-brand-light h-4 w-4" />}
              color="bg-brand/10"
            />
            <Card
              label="Frozen Accounts"
              value={stats.frozenUsers}
              sub="Currently suspended"
              icon={<Users className="h-4 w-4 text-blue-400" />}
              color="bg-blue-500/10"
            />
            <Card
              label="Free Users"
              value={stats.totalUsers - stats.proUsers}
              sub="Not yet upgraded"
              icon={<Users className="text-textDim h-4 w-4" />}
              color="bg-bgSurface"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card
              label="Active Revenue"
              value={`₦${stats.activeRevenue.toLocaleString()}`}
              sub="Sum of currently active subscriptions"
              icon={<Wallet className="text-success h-4 w-4" />}
              color="bg-success/10"
            />

            <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-textDim text-[10px] font-bold tracking-widest uppercase">
                  Recent Signups
                </span>
                <UserPlus className="text-brand h-4 w-4" />
              </div>
              {recentSignups.length === 0 ? (
                <p className="text-textDim text-xs">No signups yet</p>
              ) : (
                <div className="space-y-2">
                  {recentSignups.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0">
                        <p className="text-textMain truncate font-medium">
                          {u.name || "—"}
                        </p>
                        <p className="text-textDim truncate text-xs">
                          {u.university || "No university set"}
                        </p>
                      </div>
                      <span className="text-textDim ml-2 shrink-0 text-[10px]">
                        {new Date(u.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── NEW: Question Bank by Subject ───────────────────────────── */}
          <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-textDim text-[10px] font-bold tracking-widest uppercase">
                Question Bank by Subject
              </span>
              <BarChart3 className="text-brand h-4 w-4" />
            </div>
            <div className="space-y-3">
              {subjectCounts.map(({ subject, count }) => {
                const color = SUBJECT_COLORS[subject] || "#7B5FFF";
                const widthPct = Math.max(
                  2,
                  Math.round((count / maxSubjectCount) * 100),
                );
                return (
                  <div key={subject} className="flex items-center gap-3">
                    <span className="text-textMuted w-24 shrink-0 truncate text-xs font-medium">
                      {subject}
                    </span>
                    <div className="bg-bgSurface h-5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="text-textDim w-14 shrink-0 text-right text-xs font-semibold">
                      {count.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
            <Link
              to="/admin/Adminquestions"
              className="text-brand-light hover:text-brand mt-4 inline-block text-xs font-semibold"
            >
              Manage question bank →
            </Link>
          </div>
        </>
      )}

      <div className="bg-bgCard border-borderMuted rounded-brand-lg border p-5">
        <p className="text-textDim mb-3 text-xs font-bold tracking-widest uppercase">
          Quick Links
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "→ Manage Users", href: "/admin/users" },
            { label: "→ Flagged Reports", href: "/admin/reports" },
            { label: "→ Question Bank", href: "/admin/Adminquestions" },
          ].map(({ label, href }) => (
            <Link
              key={href}
              to={href}
              className="bg-bgSurface border-borderMuted rounded-brand text-textMuted hover:text-textMain hover:border-brand/40 border px-4 py-2 text-sm transition-all"
            >
              {label}
            </Link>
          ))}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-bgSurface border-borderMuted rounded-brand text-textMuted hover:text-textMain hover:border-brand/40 border px-4 py-2 text-sm transition-all"
          >
            → Supabase Studio
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
