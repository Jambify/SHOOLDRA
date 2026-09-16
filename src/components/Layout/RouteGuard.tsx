// src/components/Layout/RouteGuard.tsx
import React, { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router";
import {
  getPostLoginDestination,
  useUserStore,
} from "../../Store/useUserStore";
import { supabase } from "../../lib/supabase";

// NOTE: "/" is handled separately below with an EXACT match, because
// `pathname.startsWith("/")` is true for every route in the app — using
// startsWith here would have swallowed every other route into the
// "public route" branch.
const PUBLIC_ROUTES = ["/signin", "/signup", "/verify", "/guest"];

// ✅ Module-level flag — survives RouteGuard remounts
let appInitialised = false;

const RouteGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const onboardingComplete = useUserStore((s) => s.onboardingComplete);
  const hasSeenWelcome = useUserStore((s) => s.hasSeenWelcome);
  const isAdmin = useUserStore((s) => s.isAdmin);
  const isModerator = useUserStore((s) => s.isModerator);
  const isOwner = useUserStore((s) => s.isOwner);
  const syncProfile = useUserStore((s) => s.syncProfile);
  const [profileExists, setProfileExists] = useState(true);
  const [isInitialising, setIsInitialising] = useState(!appInitialised);

  useEffect(() => {
    // ✅ If we've already initialised this session, skip entirely
    if (appInitialised) {
      setIsInitialising(false);
      return;
    }

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          useUserStore.setState({
            isAuthenticated: true,
            id: session.user.id,
            email: session.user.email ?? "",
          });

          const { profileExists: exists } = await syncProfile(true);
          setProfileExists(exists);
        }
      } catch (err) {
        console.error("[RouteGuard] init error:", err);
      } finally {
        appInitialised = true; // ✅ Set BEFORE setIsInitialising to avoid race
        setIsInitialising(false);
      }
    };

    init();
  }, []);

  // ✅ Also reset appInitialised when user signs out so the next
  // user gets a fresh init cycle
  const prevAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthenticated.current && !isAuthenticated) {
      appInitialised = false;
    }
    prevAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  if (isInitialising) {
    return (
      <div className="bg-bgMain flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-brand mx-auto mb-3 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
          <p className="text-textDim text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // 1. Public routes — redirect away if fully authenticated
  //    "/" is matched EXACTLY (not startsWith) so it doesn't swallow
  //    every other route in the app.
  const isPublicRoute =
    pathname === "/" || PUBLIC_ROUTES.some((r) => pathname.startsWith(r));

  if (isPublicRoute) {
    if (
      isAuthenticated &&
      onboardingComplete &&
      hasSeenWelcome &&
      (pathname === "/signin" || pathname === "/signup" || pathname === "/")
    ) {
      const dest = getPostLoginDestination({
        isAdmin,
        isModerator,
        isOwner,
        onboardingComplete,
        hasSeenWelcome,
      }).route;
      return <Navigate to={dest} replace />;
    }
    return <>{children}</>;
  }

  // 2. Must be authenticated for everything below
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (!profileExists) return <Navigate to="/onboarding" replace />;

  // 3. /onboarding — only for users who haven't finished onboarding
  if (pathname.startsWith("/onboarding")) {
    if (onboardingComplete) {
      const dest = getPostLoginDestination({
        isAdmin,
        isModerator,
        isOwner,
        onboardingComplete,
        hasSeenWelcome,
      }).route;
      return <Navigate to={dest} replace />;
    }
    return <>{children}</>;
  }
  // 4. /welcome — only for users who finished onboarding but haven't seen welcome
  if (pathname.startsWith("/welcome")) {
    if (!onboardingComplete) return <Navigate to="/onboarding" replace />;
    if (hasSeenWelcome) {
      const dest = getPostLoginDestination({
        isAdmin,
        isModerator,
        isOwner,
        onboardingComplete,
        hasSeenWelcome,
      }).route;
      return <Navigate to={dest} replace />;
    }
    return <>{children}</>;
  }

  // 5. All other protected routes — must be fully onboarded
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />;
  if (!hasSeenWelcome) return <Navigate to="/welcome" replace />;

  return <>{children}</>;
};

export default RouteGuard;
