// src/routes/lazyPages.ts
//
// Single registry of every lazy-loaded page. App.tsx renders these;
// AppLayout.tsx and Sidebar.tsx import `routePrefetchProps` to warm a
// page's chunk on hover / focus / touch. Keeping them in one module means
// there is exactly one promise cache per chunk and no circular imports
// (the pages themselves are only reached through dynamic import()).
import type { ComponentType } from "react";
import { lazyRoute } from "../utils/lazyRoute";

// ── Student pages ───────────────────────────────────────────────
export const Quiz = lazyRoute(() => import("../Pages/Quiz"));
export const AllSessions = lazyRoute(() => import("../Pages/AllSessions"));
export const Performance = lazyRoute(() => import("../Pages/Performance"));
export const Subjects = lazyRoute(() => import("../Pages/Subjects"));
export const MockExam = lazyRoute(() => import("../Pages/MockExam/MockExam"));
export const Settings = lazyRoute(() => import("../Pages/Settings"));
export const StudyGroups = lazyRoute(() => import("../Pages/StudyGroups"));
export const MentorChat = lazyRoute(() => import("../Pages/MentorChat"));
export const PastQuestions = lazyRoute(() => import("../Pages/PastQuestions"));
export const ReviewScreen = lazyRoute(
  () => import("../Pages/MockExam/ReviewExam"),
);
export const ProPage = lazyRoute(() => import("../Pages/Pro"));
export const RenewPro = lazyRoute(() => import("../Pages/RenewPro"));

// ── Guest pages ─────────────────────────────────────────────────
export const GuestQuiz = lazyRoute(
  () => import("../Pages/GuestUser/GuestQuiz"),
);
export const GuestMock = lazyRoute(
  () => import("../Pages/GuestUser/GuestExam"),
);
export const GuestPastQuestions = lazyRoute(
  () => import("../Pages/GuestUser/GuestPastQuestions"),
);

// ── Admin pages — always lazy so admin JS never ships to students ──
export const AdminOverview = lazyRoute(
  () => import("../admin/pages/AdminOverview"),
);
export const AdminTopicOverview = lazyRoute(
  () => import("../admin/pages/AdminTopicOverview"),
);
export const AdminUsers = lazyRoute(() => import("../admin/pages/AdminUsers"));
export const AdminAuditLog = lazyRoute(
  () =>
    import("../admin/pages/AdminAuditLog") as Promise<{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      default: ComponentType<any>;
    }>,
);
export const AdminBroadcast = lazyRoute(
  () => import("../admin/pages/AdminBroadcast"),
);
export const Adminquestions = lazyRoute(
  () => import("../admin/pages/Adminquestions"),
);
export const AdminReports = lazyRoute(
  () => import("../admin/pages/AdminReports"),
);
export const AdminRoles = lazyRoute(() => import("../admin/pages/Adminroles"));

// ── Prefetch ────────────────────────────────────────────────────
const ROUTE_PRELOADERS: Record<string, () => Promise<void>> = {
  "/quiz": Quiz.preload,
  "/subjects": Subjects.preload,
  "/performance": Performance.preload,
  "/settings": Settings.preload,
  "/mock-exams": MockExam.preload,
  "/past-questions": PastQuestions.preload,
  "/study-groups": StudyGroups.preload,
  "/mentor": MentorChat.preload,
  "/sessions": AllSessions.preload,
  "/pro": ProPage.preload,
  "/pro/renew": RenewPro.preload,
  "/review": ReviewScreen.preload,
  "/guest/quiz": GuestQuiz.preload,
  "/guest/mock": GuestMock.preload,
  "/guest/past-questions": GuestPastQuestions.preload,
};

/** Start downloading the chunk for a path (no-op for eager / unknown paths). */
export function preloadRoute(path: string): void {
  void ROUTE_PRELOADERS[path]?.();
}

/** Spread onto a <Link> / <NavLink> to warm its chunk before the click. */
export const routePrefetchProps = (path: string) => ({
  onMouseEnter: () => preloadRoute(path),
  onFocus: () => preloadRoute(path),
  onTouchStart: () => preloadRoute(path),
});

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

let idlePrefetchStarted = false;

/**
 * Warm the most-used student routes one at a time while the browser is idle.
 * Runs once per session and is skipped on Save-Data / 2G connections so we
 * never spend a user's mobile data on pages they may not open.
 */
export function preloadCommonRoutes(): void {
  if (idlePrefetchStarted || typeof window === "undefined") return;
  idlePrefetchStarted = true;

  const connection = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection;
  if (connection?.saveData) return;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) {
    return;
  }

  const queue = [Quiz, Performance, MockExam, Subjects];

  const whenIdle = (callback: () => void) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout: 5000 });
    } else {
      setTimeout(callback, 1500);
    }
  };

  const next = () => {
    const item = queue.shift();
    if (!item) return;
    void item.preload().then(() => whenIdle(next));
  };

  whenIdle(next);
}