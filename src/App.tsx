/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   src/App.tsx — added dynamic /guest/past-questions/:subject and
   /guest/past-questions/:subject/:year routes for SEO (see comment below).
   Also added the public /about route.

   AUTH FIX: "/", "/signin", and "/signup" used to render OUTSIDE
   <RouteGuard>, which meant the supabase.auth.getSession() check inside
   RouteGuard never ran on those routes. Landing would render blind to
   auth state, and only "became aware" once RouteGuard mounted for the
   first time on some other route. Now all three are wrapped in
   RouteGuard, which resolves the session first (showing a loading
   spinner), then redirects an already-authenticated + fully-onboarded
   user straight to /dashboard instead of showing Landing/SignIn/SignUp.

   PERF FIX (v2): First-paint / direct-landing routes are now EAGER
   (Landing, SignIn, SignUp, Onboarding, Dashboard, Welcome, About,
   Privacy/Terms pages, AuthCallback, all Guest landing/legal pages) so
   those pages never flash a skeleton — they ship in the main bundle and
   render instantly. Only genuinely heavy, deeper-in-the-app routes stay
   lazy-loaded with per-page Suspense skeletons that visually mirror the
   real page layout to avoid any jarring layout shift on swap-in.

   STALE-LAYOUT FIX (v3, cross-layout transition): Routes with DIFFERENT
   layout chrome (AppLayout-wrapped student vs. no-sidebar guest,
   AdminLayout vs. student) MUST NOT share a fallback that renders the
   OLD layout while the lazy chunk loads. React Router wraps <Link> and
   navigate() in an internal startTransition that keeps the previously
   rendered tree on screen during the navigation. Combined with Suspense
   fallbacks that used the WRONG layout chrome for guest routes (they
   were accidentally using <AppLayout>), users saw a persistent
   "Dashboard sidebar" while navigating to /guest/* on slow networks.
   Fix:
     (a) Guest route Suspense fallbacks render a NEUTRAL, layout-free
         skeleton — never <AppLayout>.
     (b) A cross-layout key is used on each per-route Suspense boundary
         (see layoutGroupForPath) so that transitioning ACROSS layout
         groups forces Suspense to fall back to the loading UI instead of
         clinging to the stale children of the previous route. Within the
         SAME layout group (student → student), the key is stable so
         React's "avoid flicker" behavior still works.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import React, { lazy, Suspense, useMemo } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import RouteGuard from "./components/Layout/RouteGuard";
import AppLayout from "./components/Layout/AppLayout";
import StudyTimeTracker from "./components/StudyTimeTracker";
import AuthErrorBoundary from "./components/ui/AuthErrorBoundary";
import ChunkErrorBoundary from "./components/ChunkErrorBoundary";
import { supabase } from "./lib/supabase";
import ScrollToTop from "./components/Scrolltotop";
import FrozenAccountGuard from "./components/auth/FrozenAccountGuard";
import ProRevokedModal from "./components/auth/ProRevokedModal";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Skeletons (only for pages that fetch data on mount) ──────

// A neutral, CHROME-FREE loading skeleton used for ANY lazy route whose
// layout chrome is DIFFERENT from the current page we're navigating from.
// Never renders a sidebar / AppLayout chrome — the user is mid-transition
// into a potentially no-layout destination, and we must not show stale
// chrome from the previous page.
//
// Uses the same spinning-ring pattern as RouteGuard.tsx and AdminGuard.tsx's
// own loading states, so a user never sees two different loading animation
// styles back-to-back during one navigation.
const NeutralLoadingSkeleton: React.FC = () => (
  <div className="bg-bgMain flex min-h-screen items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="border-brand h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      <p className="text-textDim text-sm">Loading…</p>
    </div>
  </div>
);
// ── Layout grouping for cross-layout transition detection ──────
//
// If two routes share the same layoutGroup key, transitioning between
// them is safe to show "old route content while new route resolves"
// (React Router default). If their groups DIFFER, we want a neutral
// skeleton instead, because the old page's chrome (sidebar / admin
// header / landing nav) doesn't belong on the destination page.
//
// This is intentionally a COARSE grouping — we only need 3 buckets
// because there are exactly 3 distinct chrome families in this app.
type LayoutGroup =
  | "guest" // /guest, /guest/quiz, /guest/privacy, etc — NO layout wrapper
  | "auth" // Landing, SignIn, SignUp, About — no sidebar, own chrome
  | "student" // everything authenticated except /admin — wraps AppLayout
  | "admin"; // every /admin/* — wraps AdminLayout

function layoutGroupForPath(path: string): LayoutGroup {
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/guest")) return "guest";
  if (
    path === "/" ||
    path === "/about" ||
    path === "/signin" ||
    path === "/signup" ||
    path === "/privacy-policy" ||
    path === "/terms-of-service" ||
    path === "/auth/callback" ||
    path === "/welcome" ||
    path === "/onboarding"
  ) {
    return "auth";
  }
  return "student";
}

// ── Cross-layout Suspense wrapper ──────────────────────────────
//
// Wraps a lazy page in Suspense with:
//   (1) a fallback that MATCHES the destination layout family (never the
//       source family — so student→guest never falls back to <AppLayout>)
//   (2) a `key` on Suspense that changes ONLY when the layout GROUP
//       changes, forcing Suspense to unmount stale children and show
//       the fallback instead of letting React Router's internal
//       startTransition cling to the old page across layouts.
//
// Within the SAME group (student /dashboard → student /quiz), the key
// is deliberately stable so the group's own fallback shows — preserving
// "AppLayout with skeleton" for student↔student transitions which is
// visually correct since both source and dest have AppLayout chrome.
interface LazyRouteProps {
  /** Which layout family the DESTINATION page renders in (not source). */
  destination: Exclude<LayoutGroup, "auth">;
  /** currentPage prop for AppLayout's active-nav state (student group only). */
  currentPage?: string;
  /** Actual page component render (usually <LazyPage/> but allows wrapping RouteGuard too). */
  children: React.ReactNode;
}

const LazyRoute: React.FC<LazyRouteProps> = ({ destination, currentPage, children }) => {
  const location = useLocation();

  // Build a Suspense key that changes ONLY for cross-layout transitions.
  // This forces Suspense to fall back on cross-layout navigation (stale
  // chrome from the previous page would be wrong) while keeping the same
  // key within the same layout group (same chrome = safe to show the
  // group's fallback, or even keep children if chunk is warm).
  const suspenseKey = useMemo(
    () => `${destination}::${layoutGroupForPath(location.pathname)}`,
    [destination, location.pathname],
  );

  const fallback = useMemo(() => {
    if (destination === "student") {
      return (
        <AppLayout currentPage={currentPage ?? ""}>
          <div className="bg-bgMain min-h-[60vh]" />
        </AppLayout>
      );
    }
    if (destination === "admin") {
      // Admin's own <AdminGuard> lives INSIDE each admin route. The
      // fallback is wrapped with guard+layout so auth state + sidebar
      // are consistent with the final page (admin users are rare, this
      // is still the correct fallback for /admin/* → /admin/* swaps).
      return <NeutralLoadingSkeleton />;
    }
    // destination === "guest"
    // CRITICAL: NEVER return <AppLayout> here. Guest routes have no
    // sidebar, and returning <AppLayout> here is exactly what caused
    // the persistent-stale-sidebar bug on Dashboard → /guest/quiz
    // transitions over slow networks.
    return <NeutralLoadingSkeleton />;
  }, [destination, currentPage]);

  return (
    <Suspense key={suspenseKey} fallback={fallback}>
      {children}
    </Suspense>
  );
};

// ── Admin layout/guard — kept eager, small, needed on every /admin/* route ──
import AdminGuard from "./admin/AdminGuard";
import AdminLayout from "./admin/AdminLayout";

// ── EAGER: first-paint / direct-landing pages. Ship in the main bundle,
//    render instantly, NEVER show a Suspense skeleton. ───────────────────
import Dashboard from "./Pages/Dashboard";
import Landing from "./Pages/LandingPage";
import AboutPage from "./Pages/Aboutpage";
import Onboarding from "./Pages/OnBoarding";
import SignUp from "./Pages/Authentication/SignUp";
import SignIn from "./Pages/Authentication/SignIn";
import Welcome from "./Pages/Welcome";
import AuthCallback from "./components/auth/AuthCallback";
import GuestLanding from "./Pages/GuestUser/GuestLanding";
import PrivacyPolicy from "./Pages/PrivacyPolicy";
import GuestPrivacyPolicy from "./Pages/GuestUser/GuestPrivacy";
import GuestTermsOfService from "./Pages/GuestUser/GuestLegal";
import TermsOfService from "./Pages/TermsOfService";

// ── LAZY: heavy / deeper-in-the-app routes. Each gets its own chunk and
//    its own matching Suspense skeleton (see per-route wrappers below). ──
const Quiz = lazy(() => import("./Pages/Quiz"));
const AllSessions = lazy(() => import("./Pages/AllSessions"));
const Performance = lazy(() => import("./Pages/Performance"));
const Subjects = lazy(() => import("./Pages/Subjects"));
const MockExam = lazy(() => import("./Pages/MockExam/MockExam"));
const Settings = lazy(() => import("./Pages/Settings"));
const StudyGroups = lazy(() => import("./Pages/StudyGroups"));
const MentorChat = lazy(() => import("./Pages/MentorChat"));
const PastQuestions = lazy(() => import("./Pages/PastQuestions"));
const ReviewScreen = lazy(() => import("./Pages/MockExam/ReviewExam"));
const ProPage = lazy(() => import("./Pages/Pro"));
const RenewPro = lazy(() => import("./Pages/RenewPro"));
const GuestQuiz = lazy(() => import("./Pages/GuestUser/GuestQuiz"));
const GuestMock = lazy(() => import("./Pages/GuestUser/GuestExam"));
const GuestPastQuestions = lazy(
  () => import("./Pages/GuestUser/GuestPastQuestions"),
);

// ── Admin pages — always lazy so admin JS never ships to regular students.
//    AdminOverview has section-scoped skeletons inline.
const AdminOverview = lazy(() => import("./admin/pages/AdminOverview"));
const AdminTopicOverview = lazy(
  () => import("./admin/pages/AdminTopicOverview"),
);
const AdminUsers = lazy(() => import("./admin/pages/AdminUsers"));
const AdminAuditLog = lazy(
  () =>
    import("./admin/pages/AdminAuditLog") as Promise<{
      default: React.ComponentType<any>;
    }>,
);
const AdminBroadcast = lazy(() => import("./admin/pages/AdminBroadcast"));
const Adminquestions = lazy(() => import("./admin/pages/Adminquestions"));
const AdminReports = lazy(() => import("./admin/pages/AdminReports"));
const AdminRoles = lazy(() => import("./admin/pages/Adminroles"));

declare global {
  interface Window {
    supabase?: SupabaseClient;
  }
}

if (typeof window !== "undefined") {
  window.supabase = supabase;
}

const App: React.FC = () => {
  return (
    <AuthErrorBoundary>
      <FrozenAccountGuard>
        <ProRevokedModal />
        <ScrollToTop />
        <StudyTimeTracker />

        <ChunkErrorBoundary>
          <Routes>
            {/* ── EAGER routes — no Suspense, render instantly ──────── */}
            <Route
              path="/"
              element={
                <RouteGuard>
                  <Landing />
                </RouteGuard>
              }
            />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="/signup"
              element={
                <RouteGuard>
                  <SignUp />
                </RouteGuard>
              }
            />
            <Route
              path="/signin"
              element={
                <RouteGuard>
                  <SignIn />
                </RouteGuard>
              }
            />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/guest" element={<GuestLanding />} />
            <Route
              path="/guest/privacy-policy"
              element={<GuestPrivacyPolicy />}
            />
            <Route
              path="/guest/terms-of-service"
              element={<GuestTermsOfService />}
            />
            <Route
              path="/onboarding"
              element={
                <RouteGuard>
                  <Onboarding />
                </RouteGuard>
              }
            />
            <Route
              path="/welcome"
              element={
                <RouteGuard>
                  <Welcome />
                </RouteGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RouteGuard>
                  <Dashboard />
                </RouteGuard>
              }
            />
            <Route
              path="/privacy-policy"
              element={
                <RouteGuard>
                  <PrivacyPolicy />
                </RouteGuard>
              }
            />
            <Route
              path="/terms-of-service"
              element={
                <RouteGuard>
                  <TermsOfService />
                </RouteGuard>
              }
            />

            {/* ── LAZY routes — each wrapped with its own matching skeleton ── */}
            <Route
              path="/guest/quiz"
              element={
                <LazyRoute destination="guest">
                  <GuestQuiz />
                </LazyRoute>
              }
            />
            <Route
              path="/guest/mock"
              element={
                <LazyRoute destination="guest">
                  <GuestMock />
                </LazyRoute>
              }
            />
            <Route
              path="/guest/past-questions"
              element={
                <LazyRoute destination="guest">
                  <GuestPastQuestions />
                </LazyRoute>
              }
            />
            <Route
              path="/guest/past-questions/:subject"
              element={
                <LazyRoute destination="guest">
                  <GuestPastQuestions />
                </LazyRoute>
              }
            />
            <Route
              path="/guest/past-questions/:subject/:year"
              element={
                <LazyRoute destination="guest">
                  <GuestPastQuestions />
                </LazyRoute>
              }
            />

            <Route
              path="/quiz"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="quiz">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <Quiz />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/performance"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="performance">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <Performance />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/subjects"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="subjects">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <Subjects />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/sessions"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="sessions">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <AllSessions />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/mock-exams"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="mock">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <MockExam />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="settings">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <Settings />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/study-groups"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="groups">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <StudyGroups />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/mentor"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="mentor">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <MentorChat />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/past-questions"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="past-questions">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <PastQuestions />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/pro"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="pro">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <ProPage />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/pro/renew"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="pro">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <RenewPro />
                  </Suspense>
                </RouteGuard>
              }
            />
            <Route
              path="/review"
              element={
                <RouteGuard>
                  <Suspense
                    fallback={
                      <AppLayout currentPage="Review">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AppLayout>
                    }
                  >
                    <ReviewScreen onBack={() => window.history.back()} />
                  </Suspense>
                </RouteGuard>
              }
            />

            {/* ── LAZY Admin routes — section-scoped skeletons inline in pages ── */}
            <Route
              path="/admin"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="Overview">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="Overview">
                      <AdminOverview />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/users"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="Users">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="Users">
                      <AdminUsers />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="Audit Log">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="Audit Log">
                      <AdminAuditLog />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/AdminBroadcast"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="AdminBroadcast">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="AdminBroadcast">
                      <AdminBroadcast />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/Adminquestions"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="Adminquestions">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="Adminquestions">
                      <Adminquestions />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/topics"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="Topic Overview">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="Topic Overview">
                      <AdminTopicOverview />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="AdminReports">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="AdminReports">
                      <AdminReports />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <Suspense
                  fallback={
                    <AdminGuard>
                      <AdminLayout title="AdminRoles">
                        <div className="bg-bgMain min-h-[60vh]" />
                      </AdminLayout>
                    </AdminGuard>
                  }
                >
                  <AdminGuard>
                    <AdminLayout title="AdminRoles">
                      <AdminRoles />
                    </AdminLayout>
                  </AdminGuard>
                </Suspense>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ChunkErrorBoundary>
      </FrozenAccountGuard>
    </AuthErrorBoundary>
  );
};

export default App;
