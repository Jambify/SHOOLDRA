/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   src/App.tsx

   Dynamic /guest/past-questions/:subject and
   /guest/past-questions/:subject/:year routes exist for SEO.
   The public /about route is also registered here.

   AUTH FIX: "/", "/signin" and "/signup" are wrapped in <RouteGuard> so
   the supabase.auth.getSession() check runs on them too. RouteGuard
   resolves the session first (loading spinner), then redirects an
   already-authenticated + fully-onboarded user straight to /dashboard.

   PERF FIX (v2): First-paint / direct-landing routes are EAGER (Landing,
   SignIn, SignUp, Onboarding, Dashboard, Welcome, About, Privacy/Terms,
   AuthCallback, Guest landing/legal) so they never flash a skeleton.
   Only heavy, deeper-in-the-app routes are lazy.

   STALE-LAYOUT FIX (v3): Guest route fallbacks are layout-free (never
   <AppLayout>), so no stale dashboard sidebar appears on /guest/*.

   LOADING FEEDBACK (v4):
   - Every lazy page is registered in ./routes/lazyPages via lazyRoute(),
     which reports "a chunk is blocking navigation" to <RoutePendingBar />
     and exposes .preload() for hover / focus / touch / idle prefetching.
   - Student and admin Suspense fallbacks render <PageLoader /> inside the
     layout instead of a blank rectangle.
   - NOTE: student→student navigation reuses the same Suspense boundary, so
     React keeps the OLD page on screen while the new chunk downloads (it
     never shows the fallback). <RoutePendingBar /> is what tells the user
     something is happening in that case.
   - <RouteGuard> stays the direct route element on student routes. Do NOT
     wrap it in a custom component: that would remount RouteGuard on every
     navigation and re-run its session check.
   - The old layoutGroupForPath/suspenseKey logic was removed: LazyRoute
     only ever rendered on /guest/*, so its key never changed. Cross-layout
     transitions work because the route elements are different component
     types at the same position, which makes React mount a fresh boundary.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import RouteGuard from "./components/Layout/RouteGuard";
import AppLayout from "./components/Layout/AppLayout";
import StudyTimeTracker from "./components/StudyTimeTracker";
import AuthErrorBoundary from "./components/ui/AuthErrorBoundary";
import ChunkErrorBoundary from "./components/ChunkErrorBoundary";
import PageLoader from "./components/ui/PageLoader";
import RoutePendingBar from "./components/ui/RoutePendingBar";
import { supabase } from "./lib/supabase";
import ScrollToTop from "./components/Scrolltotop";
import FrozenAccountGuard from "./components/auth/FrozenAccountGuard";
import ProRevokedModal from "./components/auth/ProRevokedModal";
import type { SupabaseClient } from "@supabase/supabase-js";

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

// ── LAZY pages (each is its own chunk; see src/routes/lazyPages.ts) ──
import {
  Quiz,
  AllSessions,
  Performance,
  Subjects,
  MockExam,
  Settings,
  StudyGroups,
  MentorChat,
  PastQuestions,
  ReviewScreen,
  ProPage,
  RenewPro,
  GuestQuiz,
  GuestMock,
  GuestPastQuestions,
  AdminOverview,
  AdminTopicOverview,
  AdminUsers,
  AdminAuditLog,
  AdminBroadcast,
  Adminquestions,
  AdminReports,
  AdminRoles,
} from "./routes/lazyPages";

// A neutral, CHROME-FREE loading skeleton for guest routes. Never renders a
// sidebar / AppLayout: the user may be mid-transition from a page with
// different chrome. Uses the same spinning-ring pattern as RouteGuard.tsx
// and AdminGuard.tsx so users never see two different loading styles.
const NeutralLoadingSkeleton: React.FC = () => (
  <div className="bg-bgMain flex min-h-screen items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="border-brand h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
      <p className="text-textDim text-sm">Loading…</p>
    </div>
  </div>
);

interface WithChildren {
  children: React.ReactNode;
}

/** Guest pages: no layout chrome, ever. */
const GuestPage: React.FC<WithChildren> = ({ children }) => (
  <Suspense fallback={<NeutralLoadingSkeleton />}>{children}</Suspense>
);

/**
 * Student pages. Use INSIDE <RouteGuard> (keep RouteGuard as the route
 * element). The fallback keeps the sidebar/header visible and shows a
 * skeleton in the content area.
 */
const StudentPage: React.FC<WithChildren & { currentPage: string }> = ({
  currentPage,
  children,
}) => (
  <Suspense
    fallback={
      <AppLayout currentPage={currentPage}>
        <PageLoader />
      </AppLayout>
    }
  >
    {children}
  </Suspense>
);

/** Admin pages: guard + layout around the lazy page, same chrome in the fallback. */
const AdminPage: React.FC<WithChildren & { title: string }> = ({
  title,
  children,
}) => (
  <Suspense
    fallback={
      <AdminGuard>
        <AdminLayout title={title}>
          <PageLoader />
        </AdminLayout>
      </AdminGuard>
    }
  >
    <AdminGuard>
      <AdminLayout title={title}>{children}</AdminLayout>
    </AdminGuard>
  </Suspense>
);

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
        <RoutePendingBar />
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

            {/* ── LAZY guest routes ─────────────────────────────────── */}
            <Route
              path="/guest/quiz"
              element={
                <GuestPage>
                  <GuestQuiz />
                </GuestPage>
              }
            />
            <Route
              path="/guest/mock"
              element={
                <GuestPage>
                  <GuestMock />
                </GuestPage>
              }
            />
            <Route
              path="/guest/past-questions"
              element={
                <GuestPage>
                  <GuestPastQuestions />
                </GuestPage>
              }
            />
            <Route
              path="/guest/past-questions/:subject"
              element={
                <GuestPage>
                  <GuestPastQuestions />
                </GuestPage>
              }
            />
            <Route
              path="/guest/past-questions/:subject/:year"
              element={
                <GuestPage>
                  <GuestPastQuestions />
                </GuestPage>
              }
            />

            {/* ── LAZY student routes ───────────────────────────────── */}
            <Route
              path="/quiz"
              element={
                <RouteGuard>
                  <StudentPage currentPage="quiz">
                    <Quiz />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/performance"
              element={
                <RouteGuard>
                  <StudentPage currentPage="performance">
                    <Performance />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/subjects"
              element={
                <RouteGuard>
                  <StudentPage currentPage="subjects">
                    <Subjects />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/sessions"
              element={
                <RouteGuard>
                  <StudentPage currentPage="sessions">
                    <AllSessions />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/mock-exams"
              element={
                <RouteGuard>
                  <StudentPage currentPage="mock">
                    <MockExam />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/settings"
              element={
                <RouteGuard>
                  <StudentPage currentPage="settings">
                    <Settings />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/study-groups"
              element={
                <RouteGuard>
                  <StudentPage currentPage="groups">
                    <StudyGroups />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/mentor"
              element={
                <RouteGuard>
                  <StudentPage currentPage="mentor">
                    <MentorChat />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/past-questions"
              element={
                <RouteGuard>
                  <StudentPage currentPage="past-questions">
                    <PastQuestions />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/pro"
              element={
                <RouteGuard>
                  <StudentPage currentPage="pro">
                    <ProPage />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/pro/renew"
              element={
                <RouteGuard>
                  <StudentPage currentPage="pro">
                    <RenewPro />
                  </StudentPage>
                </RouteGuard>
              }
            />
            <Route
              path="/review"
              element={
                <RouteGuard>
                  <StudentPage currentPage="Review">
                    <ReviewScreen onBack={() => window.history.back()} />
                  </StudentPage>
                </RouteGuard>
              }
            />

            {/* ── LAZY admin routes ─────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <AdminPage title="Overview">
                  <AdminOverview />
                </AdminPage>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminPage title="Users">
                  <AdminUsers />
                </AdminPage>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <AdminPage title="Audit Log">
                  <AdminAuditLog />
                </AdminPage>
              }
            />
            <Route
              path="/admin/AdminBroadcast"
              element={
                <AdminPage title="AdminBroadcast">
                  <AdminBroadcast />
                </AdminPage>
              }
            />
            <Route
              path="/admin/Adminquestions"
              element={
                <AdminPage title="Adminquestions">
                  <Adminquestions />
                </AdminPage>
              }
            />
            <Route
              path="/admin/topics"
              element={
                <AdminPage title="Topic Overview">
                  <AdminTopicOverview />
                </AdminPage>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <AdminPage title="AdminReports">
                  <AdminReports />
                </AdminPage>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <AdminPage title="AdminRoles">
                  <AdminRoles />
                </AdminPage>
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